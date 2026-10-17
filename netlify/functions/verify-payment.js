// Netlify Function: POST /api/verify-payment
// Verifies Razorpay payment signature, saves order in Supabase with PENDING_APPROVAL, sends invoice email

const crypto = require('crypto');
const supabase = require('./lib/supabase');
const emailService = require('../../emailService');
const shiprocket = require('../../shiprocket');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails } = JSON.parse(event.body || '{}');

    // 1. Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          verified: false,
          error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature',
        }),
      };
    }

    // 2. Verify HMAC Signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'W8IiprT1R8oKl33OVTgh1eY8';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          verified: false,
          error: 'Signature mismatch. Payment verification failed.',
        }),
      };
    }

    console.log(`[PAYMENT] ✅ Razorpay Payment Verified: ${razorpay_payment_id}`);

    // 3. Idempotency Check in Supabase DB
    try {
      const { data: existing } = await supabase
        .from('orders')
        .select('*')
        .eq('razorpay_payment_id', razorpay_payment_id)
        .maybeSingle();

      if (existing) {
        console.log(`[PAYMENT] Order with Payment ID ${razorpay_payment_id} already exists.`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            verified: true,
            message: 'Payment already processed and verified.',
            internalOrderId: existing.id,
            shipment_status: existing.shipment_status || 'PENDING_APPROVAL',
            shiprocket: {
              success: true,
              shiprocket_order_id: existing.shiprocket_order_id,
              shipment_id: existing.shiprocket_shipment_id,
              awb_code: existing.awb_code,
              courier_name: existing.courier_name,
              tracking_url: existing.tracking_url,
              shipment_status: existing.shipment_status || 'PENDING_APPROVAL'
            }
          })
        };
      }
    } catch (dbCheckErr) {
      console.warn('[PAYMENT] Supabase idempotency check notice:', dbCheckErr.message);
    }

    // 4. Extract and Normalize Order Details
    const rawOrder = orderDetails || {};
    const orderId = rawOrder.id ? String(rawOrder.id) : `SC-${Date.now().toString().slice(-6)}`;
    const custName = String(rawOrder.customerName || rawOrder.customer_name || rawOrder.name || 'Valued Customer').trim();
    const custEmail = String(rawOrder.customerEmail || rawOrder.customer_email || rawOrder.email || 'care@suryacotton.com').trim();
    const custPhone = String(rawOrder.customerPhone || rawOrder.customer_phone || rawOrder.phone || '9876543210').replace(/\D/g, '').slice(-10) || '9876543210';
    const custAddress = String(rawOrder.customerAddress || rawOrder.shipping_address || rawOrder.address || '').trim();
    const custCity = String(rawOrder.customerCity || rawOrder.city || '').trim();
    const custState = String(rawOrder.customerState || rawOrder.state || '').trim();
    const custPin = String(rawOrder.customerPin || rawOrder.pincode || rawOrder.pin || '').trim();

    const dbOrder = {
      id: orderId,
      customer_name: custName,
      customer_email: custEmail,
      customer_phone: custPhone,
      customer_alt_phone: rawOrder.customerAltPhone || null,
      shipping_address: custAddress,
      city: custCity,
      state: custState,
      pincode: custPin,
      products: rawOrder.items || rawOrder.products || [],
      subtotal: parseFloat(rawOrder.total) || 0,
      shipping_charge: 0,
      total_amount: parseFloat(rawOrder.total) || 0,
      payment_status: 'PAID',
      razorpay_order_id,
      razorpay_payment_id,
      shipment_status: 'PENDING_APPROVAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await supabase.from('orders').upsert([dbOrder]);
      console.log(`[DB] 💾 Saved Order ${orderId} to Supabase DB (Status: PAID, Shipment: PENDING_APPROVAL)`);
    } catch (saveErr) {
      console.warn('[DB] Supabase order save notice:', saveErr.message);
    }

    // 5. Push order to Shiprocket as a New Order (WITHOUT auto-scheduling pickup).
    // This allows the Admin to choose courier partner, compare prices, and schedule pickup in Shiprocket.
    let srResult = {
      success: true,
      shiprocket_order_id: null,
      shipment_id: null,
      awb_code: null,
      courier_name: 'Pending Courier Assignment',
      tracking_url: null,
      shipment_status: 'PENDING_APPROVAL'
    };

    try {
      const orderForShiprocket = {
        id: orderId,
        date: rawOrder.date || new Date().toISOString(),
        customerName: custName,
        customerEmail: custEmail,
        customerPhone: custPhone,
        customerAddress: custAddress,
        customerCity: custCity,
        customerState: custState,
        customerPin: custPin,
        shipping_address: custAddress,
        city: custCity,
        state: custState,
        pincode: custPin,
        items: rawOrder.items || rawOrder.products || [],
        total: rawOrder.total || rawOrder.total_amount,
        paymentMethod: 'Prepaid'
      };

      const srPushRes = await shiprocket.createOrder(orderForShiprocket);
      if (srPushRes.success && srPushRes.shiprocket_order_id) {
        console.log(`[SHIPROCKET] ✅ Order ${orderId} registered in Shiprocket (SR ID: ${srPushRes.shiprocket_order_id}). Auto-pickup skipped.`);
        srResult = {
          success: true,
          shiprocket_order_id: String(srPushRes.shiprocket_order_id),
          shipment_id: String(srPushRes.shipment_id || ''),
          awb_code: null,
          courier_name: 'Pending Courier Assignment',
          tracking_url: null,
          shipment_status: 'ORDER_CREATED'
        };

        try {
          await supabase.from('orders').update({
            shiprocket_order_id: srResult.shiprocket_order_id,
            shiprocket_shipment_id: srResult.shipment_id,
            shipment_status: 'ORDER_CREATED',
            updated_at: new Date().toISOString()
          }).eq('id', orderId);
        } catch (dbUpErr) {
          console.warn('[DB] Supabase order update notice:', dbUpErr.message);
        }
      } else {
        console.warn(`[SHIPROCKET] ⚠️ Order registration notice:`, srPushRes.error || 'Unknown response');
      }
    } catch (srErr) {
      console.warn(`[SHIPROCKET] ⚠️ Could not auto-register order in Shiprocket:`, srErr.message);
    }

    // 6. Send Order Confirmation Email via EmailJS
    let emailResult = { success: false, reason: 'skipped' };
    try {
      const emailPayload = {
        id: orderId,
        date: rawOrder.date || new Date().toISOString(),
        customerName: custName,
        customerEmail: custEmail,
        customerPhone: custPhone,
        customerAddress: custAddress,
        customerCity: custCity,
        customerState: custState,
        customerPin: custPin,
        items: rawOrder.items || rawOrder.products || [],
        total: rawOrder.total || rawOrder.total_amount,
        razorpay_payment_id,
        tracking_url: srResult.tracking_url,
        courier_name: srResult.courier_name,
        awb_code: srResult.awb_code
      };
      emailResult = await emailService.sendOrderConfirmationEmail(emailPayload);
    } catch (emailErr) {
      console.warn('[EMAIL] Order email dispatch notice:', emailErr.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        verified: true,
        message: 'Payment verified and order saved successfully.',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
        internalOrderId: orderId,
        shipment_status: srResult.shipment_status,
        shiprocket: srResult,
        email_sent: emailResult.success || false
      }),
    };
  } catch (err) {
    console.error('Payment verification error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ verified: false, error: 'Internal server error during verification: ' + err.message }),
    };
  }
};

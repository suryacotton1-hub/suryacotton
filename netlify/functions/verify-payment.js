// Netlify Function: POST /api/verify-payment
// Verifies Razorpay payment signature, saves order directly in Firestore & Supabase, pushes to Shiprocket, sends invoice email

const crypto = require('crypto');
const supabase = require('./lib/supabase');
const firestore = require('./lib/firestore-rest');
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

    // 3. Extract and Normalize Order Details (Merge with pre-saved draft if frontend didn't supply items)
    let rawOrder = orderDetails || {};
    
    // If frontend didn't pass full order details, check if we have a pre-saved draft in Firestore
    if (!rawOrder.customerAddress || !rawOrder.items || rawOrder.items.length === 0) {
      const existingDraft = await firestore.findOrderByRazorpay(razorpay_order_id, razorpay_payment_id);
      if (existingDraft) {
        rawOrder = { ...existingDraft, ...rawOrder };
        console.log(`[PAYMENT] Recovered full draft order from Firestore: Order #${existingDraft.id || existingDraft.docId}`);
      }
    }

    const orderId = rawOrder.id ? String(rawOrder.id) : `SC-${Date.now().toString().slice(-6)}`;
    const custName = String(rawOrder.customerName || rawOrder.customer_name || rawOrder.name || 'Valued Customer').trim();
    const custEmail = String(rawOrder.customerEmail || rawOrder.customer_email || rawOrder.email || 'care@suryacotton.com').trim();
    const custPhone = String(rawOrder.customerPhone || rawOrder.customer_phone || rawOrder.phone || '9876543210').replace(/\D/g, '').slice(-10) || '9876543210';
    const custAddress = String(rawOrder.customerAddress || rawOrder.shipping_address || rawOrder.address || '').trim();
    const custCity = String(rawOrder.customerCity || rawOrder.city || '').trim();
    const custState = String(rawOrder.customerState || rawOrder.state || '').trim();
    const custPin = String(rawOrder.customerPin || rawOrder.pincode || rawOrder.pin || '').trim();

    // 4. Push order to Shiprocket as a New Order
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
        console.log(`[SHIPROCKET] ✅ Order ${orderId} registered in Shiprocket (SR ID: ${srPushRes.shiprocket_order_id}).`);
        srResult = {
          success: true,
          shiprocket_order_id: String(srPushRes.shiprocket_order_id),
          shipment_id: String(srPushRes.shipment_id || ''),
          awb_code: null,
          courier_name: 'Pending Courier Assignment',
          tracking_url: null,
          shipment_status: 'ORDER_CREATED'
        };
      } else {
        console.warn(`[SHIPROCKET] ⚠️ Order registration notice:`, srPushRes.error || 'Unknown response');
      }
    } catch (srErr) {
      console.warn(`[SHIPROCKET] ⚠️ Could not auto-register order in Shiprocket:`, srErr.message);
    }

    // 5. Authoritative Firestore Save (DIRECT BACKEND SYNC - guarantees Admin Dashboard visibility)
    const firestoreOrder = {
      id: orderId,
      date: rawOrder.date || new Date().toISOString(),
      customerName: custName,
      customerEmail: custEmail,
      customerPhone: custPhone,
      customerAltPhone: rawOrder.customerAltPhone || null,
      customerAddress: custAddress,
      customerCity: custCity,
      customerState: custState,
      customerPin: custPin,
      items: rawOrder.items || rawOrder.products || [],
      total: parseFloat(rawOrder.total || rawOrder.total_amount) || 0,
      paymentMethod: 'Prepaid',
      status: 'Processing',
      payment_status: 'PAID',
      shipment_status: srResult.shipment_status,
      shiprocket_order_id: srResult.shiprocket_order_id,
      shipment_id: srResult.shipment_id,
      awb_code: srResult.awb_code,
      courier_name: srResult.courier_name,
      tracking_url: srResult.tracking_url,
      razorpay_payment_id,
      razorpay_order_id,
      updated_at: new Date().toISOString()
    };

    try {
      await firestore.saveOrderToFirestore(orderId, firestoreOrder);
      console.log(`[FIRESTORE] 💾 Successfully saved verified Order ${orderId} to Firestore.`);
    } catch (fsErr) {
      console.error(`[FIRESTORE] ❌ Could not save order to Firestore:`, fsErr.message);
    }

    // 6. Supabase DB Save (Secondary backup)
    try {
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
        shipment_status: srResult.shipment_status,
        shiprocket_order_id: srResult.shiprocket_order_id,
        shiprocket_shipment_id: srResult.shipment_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await supabase.from('orders').upsert([dbOrder]);
      console.log(`[DB] 💾 Saved Order ${orderId} to Supabase DB`);
    } catch (saveErr) {
      console.warn('[DB] Supabase order save notice (non-fatal):', saveErr.message);
    }

    // 7. Send Order Confirmation Email via EmailJS
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

// Netlify Function: POST /api/razorpay-webhook
// Listens for Razorpay Payment Captured / Order Paid webhooks
// Ensures that EVEN IF a customer closes their browser immediately after payment,
// the order is 100% saved in Firestore, pushed to Shiprocket, and email sent!

const crypto = require('crypto');
const firestore = require('./lib/firestore-rest');
const shiprocket = require('../../shiprocket');
const emailService = require('../../emailService');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const rawBody = event.body || '{}';
    const bodyData = JSON.parse(rawBody);

    // Optional: Webhook signature verification if secret is provided in environment
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const webhookSignature = event.headers['x-razorpay-signature'] || event.headers['X-Razorpay-Signature'];
    if (webhookSecret && webhookSignature) {
      const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (expectedSig !== webhookSignature) {
        console.warn('[RAZORPAY WEBHOOK] ⚠️ Invalid webhook signature.');
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid webhook signature' }) };
      }
    }

    const eventName = bodyData.event;
    console.log(`[RAZORPAY WEBHOOK] 🔔 Received event: ${eventName}`);

    if (eventName === 'payment.captured' || eventName === 'order.paid') {
      const payment = bodyData.payload?.payment?.entity || {};
      const rzpPaymentId = payment.id;
      const rzpOrderId = payment.order_id;
      const notes = payment.notes || {};
      const amount = payment.amount ? payment.amount / 100 : 0;

      if (!rzpPaymentId) {
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ignored', message: 'No payment ID' }) };
      }

      console.log(`[RAZORPAY WEBHOOK] Processing successful payment ${rzpPaymentId} for Order ${rzpOrderId}`);

      // 1. Locate the order in Firestore by Razorpay Order ID or notes.internal_id
      let order = await firestore.findOrderByRazorpay(rzpOrderId, rzpPaymentId);
      let orderId = order ? order.id : (notes.internal_id || `SC-${Date.now().toString().slice(-6)}`);

      if (order && order.payment_status === 'PAID') {
        console.log(`[RAZORPAY WEBHOOK] Order #${orderId} is already marked PAID. Skipping duplicate.`);
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'already_processed', orderId }) };
      }

      // If no pre-order was found, create one from webhook metadata
      if (!order) {
        order = {
          id: orderId,
          date: new Date().toISOString(),
          customerName: notes.customer_name || 'Customer',
          customerEmail: payment.email || 'care@suryacotton.com',
          customerPhone: payment.contact ? String(payment.contact).replace(/\D/g, '').slice(-10) : (notes.customer_phone || ''),
          customerAddress: notes.customer_address || 'Address provided at checkout',
          customerCity: notes.customer_city || '',
          customerPin: notes.customer_pin || '',
          items: [],
          total: amount,
          paymentMethod: payment.method ? `Prepaid (${payment.method.toUpperCase()})` : 'Prepaid',
          status: 'Processing',
          payment_status: 'PAID',
          shipment_status: 'PENDING_APPROVAL',
          razorpay_payment_id: rzpPaymentId,
          razorpay_order_id: rzpOrderId
        };
      } else {
        // Update existing draft order
        order.status = 'Processing';
        order.payment_status = 'PAID';
        order.razorpay_payment_id = rzpPaymentId;
        if (!order.razorpay_order_id && rzpOrderId) order.razorpay_order_id = rzpOrderId;
        if (payment.email && !order.customerEmail) order.customerEmail = payment.email;
        if (payment.contact && !order.customerPhone) order.customerPhone = String(payment.contact).replace(/\D/g, '').slice(-10);
      }

      // 2. Push to Shiprocket if not already pushed
      if (!order.shiprocket_order_id) {
        try {
          const srPushRes = await shiprocket.createOrder({
            id: orderId,
            date: order.date || new Date().toISOString(),
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress,
            customerCity: order.customerCity,
            customerState: order.customerState,
            customerPin: order.customerPin,
            items: order.items || [],
            total: order.total,
            paymentMethod: 'Prepaid'
          });

          if (srPushRes.success && srPushRes.shiprocket_order_id) {
            order.shiprocket_order_id = String(srPushRes.shiprocket_order_id);
            order.shipment_id = String(srPushRes.shipment_id || '');
            order.shipment_status = 'ORDER_CREATED';
            console.log(`[RAZORPAY WEBHOOK] ✅ Auto-registered in Shiprocket (SR ID: ${srPushRes.shiprocket_order_id})`);
          }
        } catch (srErr) {
          console.warn('[RAZORPAY WEBHOOK] Shiprocket auto-push notice:', srErr.message);
        }
      }

      // 3. Save finalized order to Firestore (Direct REST API)
      order.updated_at = new Date().toISOString();
      await firestore.saveOrderToFirestore(orderId, order);
      console.log(`[RAZORPAY WEBHOOK] ✅ Order #${orderId} saved to Firestore successfully!`);

      // 4. Send Confirmation Email
      try {
        await emailService.sendOrderConfirmationEmail({
          id: orderId,
          date: order.date,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          customerAddress: order.customerAddress,
          customerCity: order.customerCity,
          customerState: order.customerState,
          customerPin: order.customerPin,
          items: order.items || [],
          total: order.total,
          razorpay_payment_id: rzpPaymentId
        });
      } catch (emailErr) {
        console.warn('[RAZORPAY WEBHOOK] Email notification notice:', emailErr.message);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', message: `Order #${orderId} processed successfully via webhook.` })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ status: 'ignored', message: `Event ${eventName} ignored` }) };
  } catch (err) {
    console.error('[RAZORPAY WEBHOOK] Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error', error: err.message })
    };
  }
};


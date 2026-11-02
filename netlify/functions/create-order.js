// Netlify Function: POST /api/create-order
// Creates a Razorpay order using the Razorpay Node SDK and preserves pre-order delivery draft in Firestore

const Razorpay = require('razorpay');
const firestore = require('./lib/firestore-rest');

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
    const { amount, currency = 'INR', receipt, orderDetails } = JSON.parse(event.body || '{}');

    // Validate amount (minimum 100 paise = ₹1)
    if (!amount || isNaN(amount) || Number(amount) < 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid amount. Minimum is 100 paise (₹1).' }),
      };
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_TMheDs5vqXN9S7',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'W8IiprT1R8oKl33OVTgh1eY8',
    });

    const rawOrder = orderDetails || {};
    const internalId = rawOrder.id ? String(rawOrder.id) : String(Math.floor(100000 + Math.random() * 900000));

    const options = {
      amount: Number(amount),
      currency,
      receipt: receipt || `rcpt_${internalId}`,
      notes: {
        internal_id: internalId,
        customer_name: String(rawOrder.customerName || rawOrder.name || '').slice(0, 40),
        customer_phone: String(rawOrder.customerPhone || rawOrder.phone || '').slice(0, 15),
        customer_pin: String(rawOrder.customerPin || rawOrder.pin || '').slice(0, 10),
        customer_city: String(rawOrder.customerCity || rawOrder.city || '').slice(0, 30)
      }
    };

    const order = await razorpay.orders.create(options);

    // CRITICAL SECURITY & DATA PRESERVATION:
    // Pre-save order details & shipping address to Firestore before user enters payment!
    // If the customer pays and closes the tab/app, the address and items are ALREADY SAFE in Firestore!
    if (orderDetails) {
      try {
        const draftOrder = {
          id: internalId,
          date: rawOrder.date || new Date().toISOString(),
          customerName: rawOrder.customerName || rawOrder.name || 'Valued Customer',
          customerEmail: rawOrder.customerEmail || rawOrder.email || '',
          customerPhone: rawOrder.customerPhone || rawOrder.phone || '',
          customerAltPhone: rawOrder.customerAltPhone || null,
          customerAddress: rawOrder.customerAddress || rawOrder.address || '',
          customerCity: rawOrder.customerCity || rawOrder.city || '',
          customerState: rawOrder.customerState || rawOrder.state || '',
          customerPin: rawOrder.customerPin || rawOrder.pin || '',
          items: rawOrder.items || [],
          total: parseFloat(rawOrder.total) || (Number(amount) / 100),
          paymentMethod: 'Prepaid',
          status: 'Payment Pending',
          payment_status: 'PENDING',
          shipment_status: 'PENDING_APPROVAL',
          razorpay_order_id: order.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await firestore.saveOrderToFirestore(internalId, draftOrder);
      } catch (draftErr) {
        console.warn('[PRE-ORDER] Draft save notice:', draftErr.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        order_id: order.id,
        internalOrderId: internalId,
        amount: order.amount,
        currency: order.currency,
      }),
    };
  } catch (err) {
    console.error('Razorpay create-order error:', err);

    if (err.statusCode === 401) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Razorpay authentication failed. Check credentials.' }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create Razorpay order.', details: err.message }),
    };
  }
};

// Netlify Function: POST /api/create-order
// Creates a Razorpay order using the Razorpay Node SDK

const Razorpay = require('razorpay');

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
    const { amount, currency = 'INR', receipt } = JSON.parse(event.body || '{}');

    // Validate amount (minimum 100 paise = ₹1)
    if (!amount || isNaN(amount) || Number(amount) < 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid amount. Minimum is 100 paise (₹1).' }),
      };
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: Number(amount),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        order_id: order.id,
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

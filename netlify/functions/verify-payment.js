// Netlify Function: POST /api/verify-payment
// Verifies Razorpay payment signature using HMAC-SHA256

const crypto = require('crypto');

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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = JSON.parse(event.body || '{}');

    // Validate required fields
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

    // Generate expected signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          verified: true,
          message: 'Payment verified successfully.',
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          verified: false,
          error: 'Signature mismatch. Payment verification failed.',
        }),
      };
    }
  } catch (err) {
    console.error('Payment verification error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ verified: false, error: 'Internal server error during verification.' }),
    };
  }
};

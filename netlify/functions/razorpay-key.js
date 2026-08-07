// Netlify Function: GET /api/razorpay-key
// Returns the publishable Razorpay key_id (never the secret)

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ key_id: process.env.RAZORPAY_KEY_ID }),
  };
};

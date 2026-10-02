const shiprocket = require('../../shiprocket');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  try {
    const orderData = JSON.parse(event.body || '{}');
    if (!orderData || !orderData.id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid order payload. Missing order ID.' })
      };
    }

    const result = await shiprocket.createOrder(orderData);
    return {
      statusCode: result.success ? 200 : 400,
      headers,
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('Netlify shiprocket-order error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

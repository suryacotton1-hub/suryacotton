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
    const bodyData = JSON.parse(event.body || '{}');
    const update = shiprocket.parseWebhook(bodyData);
    console.log('📡 Netlify Shiprocket Webhook Event Received:', update);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true, update })
    };
  } catch (err) {
    console.error('Netlify shiprocket-webhook error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

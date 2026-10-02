const shiprocket = require('../../shiprocket');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = event.queryStringParameters || {};
    const trackId = params.id || params.awb || params.order_id;

    if (!trackId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing trackId query parameter (id/awb/order_id).' })
      };
    }

    const trackingResult = await shiprocket.trackShipment(trackId);
    return {
      statusCode: trackingResult.success ? 200 : 400,
      headers,
      body: JSON.stringify(trackingResult)
    };
  } catch (err) {
    console.error('Netlify shiprocket-track error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

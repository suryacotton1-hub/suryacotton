// Netlify Function: GET /api/ping or /api/health

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ status: 'ok', serverless: true, time: Date.now() })
  };
};

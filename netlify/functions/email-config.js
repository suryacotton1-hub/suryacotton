// Netlify Function: GET /api/email-config
// Returns the publishable EmailJS configuration

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      serviceId: process.env.EMAILJS_SERVICE_ID || 'service_daknf95',
      templateId: process.env.EMAILJS_TEMPLATE_ID || 'template_j0udqht',
      publicKey: process.env.EMAILJS_PUBLIC_KEY || 'XyD2BSBIHw8JUf2gK'
    }),
  };
};

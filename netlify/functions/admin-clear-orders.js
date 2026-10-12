// Netlify Function: POST /api/admin/clear-orders
// Clears orders from Supabase DB

const supabase = require('./lib/supabase');

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
    const { error } = await supabase
      .from('orders')
      .delete()
      .neq('id', '___NON_EXISTENT_ID___');

    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'All orders cleared from database.' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

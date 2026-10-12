// Netlify Function: GET /api/orders
// Retrieves orders from Supabase DB for Admin Dashboard

const supabase = require('./lib/supabase');

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

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, orders: data || [] })
    };
  } catch (err) {
    console.warn('Orders fetch error:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, orders: [], error: err.message })
    };
  }
};

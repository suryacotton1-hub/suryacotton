// Netlify Function: POST /api/admin/retry-shiprocket
// Retries Shiprocket fulfillment and AWB generation for an order

const supabase = require('./lib/supabase');
const shiprocket = require('../../shiprocket');

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
    const { orderId, order } = JSON.parse(event.body || '{}');
    if (!orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing orderId' })
      };
    }

    let orderToRetry = order;
    if (!orderToRetry) {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (data) {
        orderToRetry = {
          id: data.id,
          customerName: data.customer_name,
          customerEmail: data.customer_email,
          customerPhone: data.customer_phone,
          customerAddress: data.shipping_address,
          customerCity: data.city,
          customerState: data.state,
          customerPin: data.pincode,
          shipping_address: data.shipping_address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          items: data.products,
          total: data.total_amount,
          paymentMethod: 'Prepaid',
          shipment_id: data.shiprocket_shipment_id
        };
      }
    }

    if (!orderToRetry) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Order details not found.' })
      };
    }

    let result;
    if (orderToRetry.shipment_id) {
      const targetPin = orderToRetry.customerPin || orderToRetry.pincode || orderToRetry.pin || '600001';
      const serviceRes = await shiprocket.checkServiceability('638001', targetPin);
      const courierId = serviceRes.success ? serviceRes.courier_company_id : null;
      const awbRes = await shiprocket.generateAWB(orderToRetry.shipment_id, courierId);

      if (awbRes.success && awbRes.awb_code) {
        result = {
          success: true,
          shipment_id: orderToRetry.shipment_id,
          awb_code: awbRes.awb_code,
          courier_name: awbRes.courier_name,
          shipment_status: 'READY_TO_SHIP',
          tracking_url: awbRes.tracking_url
        };
      } else {
        result = {
          success: false,
          error: awbRes.error || 'AWB generation failed on retry.'
        };
      }
    } else {
      result = await shiprocket.createOrder(orderToRetry);
    }

    if (result.success && result.awb_code) {
      try {
        await supabase.from('orders').update({
          shiprocket_order_id: result.shiprocket_order_id || orderToRetry.shiprocket_order_id,
          shiprocket_shipment_id: result.shipment_id || orderToRetry.shipment_id,
          awb_code: result.awb_code,
          courier_name: result.courier_name,
          shipment_status: 'READY_TO_SHIP',
          tracking_url: result.tracking_url,
          error_log: null,
          updated_at: new Date().toISOString()
        }).eq('id', orderId);
      } catch (e) {
        console.warn("DB update failed on retry:", e.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('Admin retry error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

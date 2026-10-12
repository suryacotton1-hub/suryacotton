// Netlify Function: POST /api/shiprocket/webhook
// Webhook listener for Shiprocket status updates

const supabase = require('./lib/supabase');
const shiprocket = require('../../shiprocket');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
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
    console.log('[SHIPROCKET SYNC] Webhook received:', update);

    if (update && (update.orderId || update.awbCode || update.shipmentId)) {
      try {
        const orFilters = [];
        if (update.orderId) {
          orFilters.push(`id.eq.${update.orderId}`, `id.eq.SC-${update.orderId}`, `shiprocket_order_id.eq.${update.orderId}`);
        }
        if (update.shipmentId) {
          orFilters.push(`shiprocket_shipment_id.eq.${update.shipmentId}`);
        }
        if (update.awbCode) {
          orFilters.push(`awb_code.eq.${update.awbCode}`);
        }

        const { data: matchedOrder } = await supabase
          .from('orders')
          .select('id, shipment_status, awb_code')
          .or(orFilters.join(','))
          .maybeSingle();

        if (matchedOrder) {
          const existingStatus = (matchedOrder.shipment_status || '').toUpperCase();
          if (existingStatus !== update.status) {
            const updatePayload = {
              shipment_status: update.status,
              updated_at: new Date().toISOString()
            };
            if (update.courierName) updatePayload.courier_name = update.courierName;
            if (update.awbCode) {
              updatePayload.awb_code = update.awbCode;
              updatePayload.tracking_url = `https://shiprocket.co/tracking/${update.awbCode}`;
            }

            await supabase.from('orders').update(updatePayload).eq('id', matchedOrder.id);
            console.log(`[SHIPROCKET SYNC] Supabase updated for Order ${matchedOrder.id}`);
          }
        }
      } catch (dbErr) {
        console.warn('[SHIPROCKET SYNC] Webhook DB sync error:', dbErr.message);
      }
    }

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

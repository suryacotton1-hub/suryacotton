// Netlify Function: GET /api/admin/sync-shiprocket-status
// Syncs latest Shiprocket statuses to Supabase DB

const supabase = require('./lib/supabase');
const shiprocket = require('../../shiprocket');

function normalizeShipmentStatus(rawStatus) {
  if (!rawStatus) return null;
  const s = String(rawStatus).toUpperCase().trim();
  if (s.includes('CANCEL')) return 'CANCELLED';
  if (s.includes('DELIVER') && !s.includes('OUT')) return 'DELIVERED';
  if (s.includes('OUT FOR DELIVERY') || s === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (s.includes('TRANSIT') || s.includes('DISPATCH') || s.includes('SHIPPED')) return 'IN_TRANSIT';
  if (s.includes('PICKUP') && s.includes('SCHEDUL')) return 'PICKUP_SCHEDULED';
  if (s.includes('AWB') || s.includes('ASSIGN') || s.includes('READY')) return 'READY_TO_SHIP';
  if (s === 'NEW' || s === 'ORDER_CREATED') return 'ORDER_CREATED';
  return s;
}

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
    const params = event.queryStringParameters || {};
    const singleOrderId = params.orderId;
    const changes = [];

    if (singleOrderId) {
      const rawSearch = String(singleOrderId).trim();
      const cleanNum = rawSearch.replace(/^SC-/, '');

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${rawSearch},id.eq.${cleanNum},id.eq.SC-${cleanNum},shiprocket_order_id.eq.${rawSearch},shiprocket_shipment_id.eq.${rawSearch},awb_code.eq.${rawSearch}`)
        .maybeSingle();

      if (!order) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ success: false, error: `Order ${singleOrderId} not found.` })
        };
      }

      if (order.awb_code || order.shiprocket_shipment_id) {
        const searchId = order.awb_code || `SC-${order.shiprocket_shipment_id}`;
        try {
          const trackResult = await shiprocket.trackShipment(searchId);
          if (trackResult.success && trackResult.current_status) {
            const liveStatus = normalizeShipmentStatus(trackResult.current_status);
            const dbStatus = (order.shipment_status || '').toUpperCase();
            if (liveStatus && liveStatus !== dbStatus) {
              await supabase.from('orders').update({
                shipment_status: liveStatus,
                updated_at: new Date().toISOString()
              }).eq('id', order.id);
              changes.push({ order_id: order.id, from: dbStatus, to: liveStatus });
            }
          }
        } catch (e) {}
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, synced: changes.length, changes })
      };
    }

    // Batch sync: check up to 10 active orders
    const terminalStatuses = ['DELIVERED', 'CANCELLED'];
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, shipment_status, shiprocket_shipment_id, awb_code')
      .not('shiprocket_shipment_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!activeOrders || activeOrders.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, synced: 0, changes: [], message: 'No active Shiprocket orders to sync.' })
      };
    }

    const ordersToCheck = activeOrders.filter(o => !terminalStatuses.includes((o.shipment_status || '').toUpperCase()));

    for (const order of ordersToCheck) {
      const searchId = order.awb_code || (order.shiprocket_shipment_id ? `SC-${order.shiprocket_shipment_id}` : null);
      if (!searchId) continue;

      try {
        const trackResult = await shiprocket.trackShipment(searchId);
        if (trackResult.success && trackResult.current_status) {
          const liveStatus = normalizeShipmentStatus(trackResult.current_status);
          const dbStatus = (order.shipment_status || '').toUpperCase();
          if (liveStatus && liveStatus !== dbStatus && liveStatus !== 'ORDER_CREATED') {
            await supabase.from('orders').update({
              shipment_status: liveStatus,
              updated_at: new Date().toISOString()
            }).eq('id', order.id);
            changes.push({ order_id: order.id, from: dbStatus, to: liveStatus });
          }
        }
      } catch (e) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, synced: changes.length, changes })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

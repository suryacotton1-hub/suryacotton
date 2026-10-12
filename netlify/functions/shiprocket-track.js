// Netlify Function: GET /api/shiprocket/track
// Real-time tracking with Supabase DB lookup & live status auto-sync

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
    const trackId = params.id || params.awb || params.order_id;

    if (!trackId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing trackId query parameter (id/awb/order_id).' })
      };
    }

    const rawSearch = String(trackId).trim();
    const cleanNum = rawSearch.replace(/^SC-/, '');
    let dbRecord = null;

    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${rawSearch},id.eq.${cleanNum},id.eq.SC-${cleanNum},shiprocket_order_id.eq.${rawSearch},shiprocket_shipment_id.eq.${rawSearch},shiprocket_shipment_id.eq.${cleanNum},awb_code.eq.${rawSearch},razorpay_order_id.eq.${rawSearch},razorpay_payment_id.eq.${rawSearch}`)
        .maybeSingle();

      if (data) {
        dbRecord = data;
      }
    } catch (e) {
      console.warn('[TRACK] DB lookup notice:', e.message);
    }

    let searchId = rawSearch;
    if (dbRecord) {
      if (dbRecord.awb_code) {
        searchId = dbRecord.awb_code;
      } else if (dbRecord.shiprocket_shipment_id) {
        searchId = `SC-${dbRecord.shiprocket_shipment_id}`;
      }
    }

    const trackingResult = await shiprocket.trackShipment(searchId);

    // Auto-sync live status to Supabase if changed
    if (dbRecord && trackingResult.success && trackingResult.current_status) {
      const liveStatus = normalizeShipmentStatus(trackingResult.current_status);
      const dbStatus = (dbRecord.shipment_status || '').toUpperCase();
      if (liveStatus && liveStatus !== dbStatus && liveStatus !== 'ORDER_CREATED') {
        try {
          await supabase.from('orders').update({
            shipment_status: liveStatus,
            updated_at: new Date().toISOString()
          }).eq('id', dbRecord.id);
        } catch (syncErr) {
          console.warn('[TRACK] Live status sync error:', syncErr.message);
        }
      }
    }

    // Merge response if DB record has AWB
    if (dbRecord && dbRecord.awb_code) {
      const effectiveStatus = (trackingResult.scans && trackingResult.scans.length > 0)
        ? trackingResult.current_status
        : (dbRecord.shipment_status || 'READY_TO_SHIP');

      const mergedResponse = {
        success: true,
        order_id: dbRecord.id,
        awb_code: dbRecord.awb_code,
        courier_name: dbRecord.courier_name || trackingResult.courier_name || 'Blue Dart Air',
        current_status: effectiveStatus,
        shipment_status: normalizeShipmentStatus(effectiveStatus) || dbRecord.shipment_status,
        tracking_url: dbRecord.tracking_url || `https://shiprocket.co/tracking/${dbRecord.awb_code}`,
        scans: trackingResult.scans || [],
        message: trackingResult.message || 'Manifest created & AWB assigned. Shipment is ready for courier pickup.'
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(mergedResponse)
      };
    }

    return {
      statusCode: trackingResult.success ? 200 : 400,
      headers,
      body: JSON.stringify(trackingResult)
    };
  } catch (err) {
    console.error('Netlify tracking error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

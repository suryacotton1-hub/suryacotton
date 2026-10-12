// Netlify Function: POST /api/admin/schedule-pickup
// Manual Admin Approval & Courier Pickup Scheduling Pipeline

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
    const { orderId, phase } = JSON.parse(event.body || '{}');
    if (!orderId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing orderId parameter.' })
      };
    }

    console.log(`[ADMIN] 📦 Schedule Pickup ${phase === 'confirm' ? 'CONFIRM' : 'VERIFY'} for Order: ${orderId}`);

    // Lookup order in Supabase
    const rawSearch = String(orderId).trim();
    const cleanNum = rawSearch.replace(/^SC-/, '');

    let dbOrder = null;
    try {
      const orFilters = [
        `id.eq.${rawSearch}`,
        `id.eq.${cleanNum}`,
        `id.eq.SC-${cleanNum}`,
        `shiprocket_order_id.eq.${rawSearch}`,
        `shiprocket_order_id.eq.${cleanNum}`,
        `shiprocket_shipment_id.eq.${rawSearch}`,
        `shiprocket_shipment_id.eq.${cleanNum}`,
        `awb_code.eq.${rawSearch}`
      ];
      const { data } = await supabase
        .from('orders')
        .select('*')
        .or(orFilters.join(','))
        .maybeSingle();
      dbOrder = data;
    } catch (lookupErr) {
      console.warn('[ADMIN] Schedule-pickup DB lookup error:', lookupErr.message);
    }

    if (!dbOrder && /^\d+$/.test(cleanNum)) {
      try {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .or(`id.eq.${cleanNum},shiprocket_order_id.eq.${cleanNum},shiprocket_shipment_id.eq.${cleanNum}`)
          .maybeSingle();
        dbOrder = data;
      } catch (fallbackErr) {
        console.warn('[ADMIN] Schedule-pickup fallback lookup error:', fallbackErr.message);
      }
    }

    if (!dbOrder) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Order "${orderId}" not found in database. Cannot schedule pickup for an unverified order.`
        })
      };
    }

    let shipmentId = dbOrder.shiprocket_shipment_id;
    let realAwb = dbOrder.awb_code;
    const currentStatus = (dbOrder.shipment_status || 'PENDING_APPROVAL').toUpperCase();

    if (currentStatus === 'PICKUP_SCHEDULED' || currentStatus === 'IN_TRANSIT' ||
        currentStatus === 'OUT_FOR_DELIVERY' || currentStatus === 'DELIVERED' ||
        currentStatus === 'CANCELLED') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Order ${dbOrder.id} is not eligible for pickup scheduling. Current status: ${currentStatus}.`,
          db_order_id: dbOrder.id,
          shipment_status: currentStatus
        })
      };
    }

    // Phase 1: Verify
    if (phase !== 'confirm') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          phase: 'verify',
          message: 'Order verified. Confirm to approve and schedule courier pickup with Shiprocket.',
          db_order_id: dbOrder.id,
          shiprocket_order_id: dbOrder.shiprocket_order_id || null,
          shiprocket_shipment_id: shipmentId || 'Will be created upon approval',
          awb_code: realAwb || 'Will be generated upon approval',
          courier_name: dbOrder.courier_name || 'Will be assigned upon approval',
          shipment_status: currentStatus,
          customer_name: dbOrder.customer_name || 'N/A'
        })
      };
    }

    // Phase 2: Confirm
    console.log(`[ADMIN] 📦 Order ${dbOrder.id} APPROVED by Admin. Proceeding with Shiprocket fulfillment...`);

    // 1. If not yet in Shiprocket, register order now
    if (!shipmentId) {
      const orderForShiprocket = {
        id: dbOrder.id,
        date: dbOrder.created_at || new Date().toISOString(),
        customerName: dbOrder.customer_name,
        customerEmail: dbOrder.customer_email,
        customerPhone: dbOrder.customer_phone,
        customerAddress: dbOrder.shipping_address,
        customerCity: dbOrder.city,
        customerState: dbOrder.state,
        customerPin: dbOrder.pincode,
        shipping_address: dbOrder.shipping_address,
        city: dbOrder.city,
        state: dbOrder.state,
        pincode: dbOrder.pincode,
        items: dbOrder.products || [],
        total: dbOrder.total_amount,
        paymentMethod: 'Prepaid'
      };

      const srCreateRes = await shiprocket.createOrder(orderForShiprocket);
      if (!srCreateRes.success) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Failed to register order in Shiprocket: ${srCreateRes.error}`,
            db_order_id: dbOrder.id
          })
        };
      }

      shipmentId = srCreateRes.shipment_id;
      dbOrder.shiprocket_order_id = srCreateRes.shiprocket_order_id;
      dbOrder.shiprocket_shipment_id = shipmentId;
      try {
        await supabase.from('orders').update({
          shiprocket_order_id: srCreateRes.shiprocket_order_id,
          shiprocket_shipment_id: shipmentId,
          updated_at: new Date().toISOString()
        }).eq('id', dbOrder.id);
      } catch(e) {}
    }

    // 2. Generate AWB if needed
    if (!realAwb && shipmentId) {
      try {
        const targetPin = dbOrder.pincode || dbOrder.customerPin || '600001';
        const serviceRes = await shiprocket.checkServiceability('638001', targetPin);
        const courierId = serviceRes.success ? serviceRes.courier_company_id : null;
        const awbRes = await shiprocket.generateAWB(shipmentId, courierId);

        if (awbRes.success && awbRes.awb_code) {
          realAwb = awbRes.awb_code;
          dbOrder.awb_code = realAwb;
          dbOrder.courier_name = awbRes.courier_name || serviceRes.courier_name || dbOrder.courier_name;
          try {
            await supabase.from('orders').update({
              awb_code: realAwb,
              courier_name: dbOrder.courier_name,
              shipment_status: 'READY_TO_SHIP',
              tracking_url: awbRes.tracking_url,
              updated_at: new Date().toISOString()
            }).eq('id', dbOrder.id);
          } catch(e) {}
        }
      } catch (awbErr) {
        console.warn('[ADMIN] AWB generation error:', awbErr.message);
      }
    }

    // 3. Request Courier Pickup
    const pickupRes = await shiprocket.requestPickup(shipmentId);

    if (pickupRes.success) {
      try {
        await supabase.from('orders').update({
          shipment_status: 'PICKUP_SCHEDULED',
          updated_at: new Date().toISOString()
        }).eq('id', dbOrder.id);
      } catch (dbErr) {
        console.warn('[ADMIN] DB status update notice:', dbErr.message);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          phase: 'confirm',
          message: pickupRes.message || 'Pickup scheduled successfully with courier.',
          shipment_status: 'PICKUP_SCHEDULED',
          db_order_id: dbOrder.id,
          awb_code: realAwb,
          shiprocket_shipment_id: shipmentId
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: pickupRes.error || 'Failed to schedule pickup with Shiprocket.',
        db_order_id: dbOrder.id
      })
    };
  } catch (err) {
    console.error('Admin schedule-pickup error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

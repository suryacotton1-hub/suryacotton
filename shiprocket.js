/* =========================================================
   SURYA COTTANS — SHIPROCKET API INTEGRATION MODULE
   Auto Authentication, Order Push, AWB Generation & Real-time Tracking
   ========================================================= */

require('dotenv').config();

class ShiprocketService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
    this.baseUrl = 'https://apiv2.shiprocket.in/v1/external';
  }

  /**
   * Get valid Shiprocket JWT Auth Token (Cached or freshly logged in)
   */
  async getToken() {
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.token;
    }

    const email = process.env.SHIPROCKET_EMAIL;
    const password = process.env.SHIPROCKET_PASSWORD;

    if (!email || !password || email.includes('YOUR_') || password.includes('YOUR_')) {
      console.warn('⚠️ Shiprocket credentials missing or default in .env file!');
      throw new Error('Shiprocket API credentials (SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD) are not configured in .env file.');
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        throw new Error(data.message || 'Shiprocket authentication failed. Check credentials.');
      }

      this.token = data.token;
      this.tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;
      console.log('✅ Shiprocket API Authenticated Successfully!');
      return this.token;
    } catch (err) {
      console.error('❌ Shiprocket Auth Error:', err.message);
      throw err;
    }
  }

  /**
   * Check Courier Serviceability for Pincode
   */
  async checkServiceability(pickupPostcode = '638001', deliveryPostcode = '600001', weight = 0.5, isCOD = 0) {
    try {
      const token = await this.getToken();
      const pPin = String(pickupPostcode || '638001').trim();
      const dPin = String(deliveryPostcode || '600001').trim();

      console.log(`[SHIPROCKET] Checking Courier Serviceability from ${pPin} to ${dPin}...`);

      const url = `${this.baseUrl}/courier/serviceability/?pickup_postcode=${encodeURIComponent(pPin)}&delivery_postcode=${encodeURIComponent(dPin)}&weight=${weight}&cod=${isCOD}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const resData = await response.json();
      if (response.ok && resData.data && resData.data.available_courier_companies && resData.data.available_courier_companies.length > 0) {
        const couriers = resData.data.available_courier_companies;
        const selectedCourier = resData.data.recommended_courier_company_id
          ? (couriers.find(c => String(c.courier_company_id) === String(resData.data.recommended_courier_company_id)) || couriers[0])
          : couriers[0];

        console.log(`[SHIPROCKET] Selected Courier Partner: ${selectedCourier.courier_name} (ID: ${selectedCourier.courier_company_id})`);
        return {
          success: true,
          courier_company_id: selectedCourier.courier_company_id,
          courier_name: selectedCourier.courier_name,
          freight_charge: selectedCourier.freight_charge,
          etd: selectedCourier.etd || '3-5 Days'
        };
      } else {
        console.warn('[SHIPROCKET] Serviceability warning:', resData.message || 'No couriers available for this route.');
        return { success: false, courier_company_id: null, error: resData.message || 'No serviceability' };
      }
    } catch (err) {
      console.error('[SHIPROCKET] Serviceability Error:', err.message);
      return { success: false, courier_company_id: null, error: err.message };
    }
  }

  /**
   * Fetch verified Pickup Location nickname from Shiprocket account
   */
  async getPickupLocation() {
    try {
      const token = await this.getToken();
      const response = await fetch(`${this.baseUrl}/settings/company/pickup`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.data && data.data.shipping_address && data.data.shipping_address.length > 0) {
        // Find primary or first verified pickup location
        const addresses = data.data.shipping_address;
        const primary = addresses.find(a => a.is_primary_location === 1) || addresses[0];
        const nickname = primary.pickup_location || primary.name || 'work';
        console.log(`[SHIPROCKET] ✅ Verified Pickup Location from account: "${nickname}" (ID: ${primary.id})`);
        return nickname;
      }
    } catch (err) {
      console.warn('[SHIPROCKET] Could not fetch pickup locations:', err.message);
    }

    // Fallback to env var
    return process.env.SHIPROCKET_PICKUP_LOCATION || 'work';
  }

  /**
   * Create Adhoc Order in Shiprocket
   */
  async createOrder(order) {
    try {
      const token = await this.getToken();

      // CRITICAL: Fetch the EXACT pickup location nickname from the Shiprocket account
      // The API error "Please add billing/shipping address first" is often caused by
      // pickup_location not matching any configured address in the Shiprocket dashboard
      const pickupLocation = await this.getPickupLocation();

      const dateObj = order.date ? new Date(order.date) : new Date();
      const formattedDate = dateObj.toISOString().replace('T', ' ').substring(0, 16);

      // Extract & Normalize Address, Contact & Customer Fields
      const rawName = String(order.customerName || order.customer_name || order.name || 'Valued Customer').trim();
      const nameParts = rawName.split(' ');
      const firstName = nameParts[0] || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || 'Customer';

      const address = String(order.customerAddress || order.shipping_address || order.address || '').trim();
      const city = String(order.customerCity || order.city || '').trim();
      const state = String(order.customerState || order.state || '').trim();
      const pin = String(order.customerPin || order.pincode || order.pin || '').trim();

      const rawEmail = String(order.customerEmail || order.customer_email || order.email || '').trim();
      const validEmail = (rawEmail && rawEmail !== 'N/A' && rawEmail.includes('@')) ? rawEmail : 'care@suryacottans.com';

      const rawPhone = String(order.customerPhone || order.customer_phone || order.phone || '9876543210');
      const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10) || '9876543210';

      // Safe Debug Logging (No sensitive personal data logged)
      console.log('[SHIPROCKET] Address Field Presence Verification:', {
        hasFirstName: Boolean(firstName),
        hasLastName: Boolean(lastName),
        hasAddress: Boolean(address && address.length >= 3),
        addressCharLength: address ? address.length : 0,
        hasCity: Boolean(city),
        cityLength: city.length,
        hasState: Boolean(state),
        stateValue: state,
        hasPin: Boolean(pin && pin.length >= 6),
        pinLength: pin.length,
        hasEmail: Boolean(validEmail),
        hasPhone: Boolean(cleanPhone && cleanPhone.length === 10),
        pickupLocation: pickupLocation
      });

      // Verification before constructing Shiprocket payload
      const missingFields = [];
      if (!firstName || firstName.length < 1) missingFields.push('billing_customer_name');
      if (!address || address.length < 3) missingFields.push('billing_address');
      if (!city || city.length < 2) missingFields.push('billing_city');
      if (!state || state.length < 2) missingFields.push('billing_state');
      if (!pin || pin.length < 6) missingFields.push('billing_pincode');
      if (!cleanPhone || cleanPhone.length !== 10) missingFields.push('billing_phone');

      if (missingFields.length > 0) {
        const errNotice = `Shiprocket Order Creation Aborted. Missing or invalid fields: ${missingFields.join(', ')}`;
        console.error(`❌ [SHIPROCKET] ${errNotice}`);
        throw new Error(errNotice);
      }

      const orderItems = (order.items || order.products || []).map((item, index) => ({
        name: String(item.name || `Item ${index + 1}`),
        sku: String(`SKU-${item.id || index + 1}-${(item.size || 'STD').toUpperCase()}`),
        units: parseInt(item.qty) || 1,
        selling_price: Number(parseFloat(item.price) || 0),
        discount: 0,
        tax: 0,
        hsn: 6205
      }));

      if (orderItems.length === 0) {
        throw new Error('Order must contain at least one item.');
      }

      const subTotal = Number(parseFloat(order.total) || 0);

      // Construct Complete Payload - Shiprocket /orders/create/adhoc format
      // IMPORTANT: Do NOT send channel_id as empty string - omit it entirely
      const payload = {
        order_id: String(order.id).startsWith('SC-') ? String(order.id) : `SC-${order.id || Date.now()}`,
        order_date: formattedDate,
        pickup_location: pickupLocation,
        comment: "SuryaCottans Online Store Order",

        // Billing Details (all required by Shiprocket)
        billing_customer_name: firstName,
        billing_last_name: lastName,
        billing_address: address,
        billing_address_2: "",
        billing_city: city,
        billing_pincode: pin,
        billing_state: state,
        billing_country: "India",
        billing_email: validEmail,
        billing_phone: cleanPhone,

        // Shipping Details - explicitly provided even with shipping_is_billing=true
        // because Shiprocket's validator sometimes requires them
        shipping_is_billing: true,
        shipping_customer_name: firstName,
        shipping_last_name: lastName,
        shipping_address: address,
        shipping_address_2: "",
        shipping_city: city,
        shipping_pincode: pin,
        shipping_state: state,
        shipping_country: "India",
        shipping_email: validEmail,
        shipping_phone: cleanPhone,

        order_items: orderItems,
        payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
        shipping_charges: 0,
        giftwrap_charges: 0,
        transaction_charges: 0,
        total_discount: 0,
        sub_total: subTotal,
        length: 15,
        breadth: 15,
        height: 10,
        weight: 0.5
      };

      // SANITIZED Payload Structure Dump (masks PII but shows exact field names, types, and structure)
      const sanitizedPayload = {
        order_id: payload.order_id,
        order_date: payload.order_date,
        pickup_location: payload.pickup_location,
        comment: '[present]',
        billing_customer_name: `[string, len=${firstName.length}]`,
        billing_last_name: `[string, len=${lastName.length}]`,
        billing_address: `[string, len=${address.length}]`,
        billing_address_2: `[string, len=0]`,
        billing_city: `[string, len=${city.length}]`,
        billing_pincode: `[string, val_type=${typeof pin}, len=${pin.length}]`,
        billing_state: state,
        billing_country: payload.billing_country,
        billing_email: `[string, has@=${validEmail.includes('@')}]`,
        billing_phone: `[string, len=${cleanPhone.length}]`,
        shipping_is_billing: payload.shipping_is_billing,
        shipping_customer_name: `[string, len=${firstName.length}]`,
        shipping_address: `[string, len=${address.length}]`,
        shipping_city: `[string, len=${city.length}]`,
        shipping_pincode: `[string, val_type=${typeof pin}, len=${pin.length}]`,
        shipping_state: state,
        shipping_country: payload.shipping_country,
        shipping_phone: `[string, len=${cleanPhone.length}]`,
        order_items_count: orderItems.length,
        order_items_sample: orderItems.length > 0 ? {
          name: `[string, len=${orderItems[0].name.length}]`,
          sku: orderItems[0].sku,
          units: `[${typeof orderItems[0].units}] ${orderItems[0].units}`,
          selling_price: `[${typeof orderItems[0].selling_price}] ${orderItems[0].selling_price}`
        } : 'EMPTY',
        payment_method: payload.payment_method,
        sub_total: `[${typeof subTotal}] ${subTotal}`,
        dimensions: `${payload.length}x${payload.breadth}x${payload.height} / ${payload.weight}kg`
      };
      console.log('[SHIPROCKET] 📦 SANITIZED OUTGOING PAYLOAD DUMP:');
      console.log(JSON.stringify(sanitizedPayload, null, 2));

      const requestBody = JSON.stringify(payload);
      console.log(`[SHIPROCKET] Request body byte length: ${Buffer.byteLength(requestBody, 'utf8')}`);
      console.log(`[SHIPROCKET] POST ${this.baseUrl}/orders/create/adhoc`);

      const response = await fetch(`${this.baseUrl}/orders/create/adhoc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: requestBody
      });

      const responseStatus = response.status;
      const resData = await response.json();

      console.log(`[SHIPROCKET] API Response Status: HTTP ${responseStatus}`);

      if (!response.ok || resData.status_code === 0) {
        console.error('[SHIPROCKET] ❌ Order creation API error response:', JSON.stringify(resData));
        throw new Error(resData.message || (resData.errors ? JSON.stringify(resData.errors) : `Shiprocket API HTTP ${responseStatus}`));
      }

      const srOrderId = String(resData.order_id);
      const srShipmentId = String(resData.shipment_id || '');

      console.log(`✅ [SHIPROCKET] Order Created Successfully! Shiprocket Order ID: ${srOrderId}, Shipment ID: ${srShipmentId}`);

      // Order created in Shiprocket. Do NOT auto-assign AWB or auto-schedule pickup during checkout.
      // AWB generation and Pickup scheduling will be manually controlled by Admin in the Admin Panel.
      console.log(`[SHIPROCKET] Order registered in Shiprocket (Order ID: ${srOrderId}, Shipment ID: ${srShipmentId}). AWB & Pickup pending Admin action.`);

      return {
        success: true,
        shiprocket_order_id: srOrderId,
        shipment_id: srShipmentId,
        status: resData.status || 'NEW',
        shipment_status: 'ORDER_CREATED',
        status_code: resData.status_code,
        awb_code: null,
        courier_name: 'Pending Courier Assignment',
        courier_company_id: null,
        tracking_url: null,
        error: null
      };
    } catch (err) {
      console.error('❌ Shiprocket createOrder Error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Automatically Assign Courier & Generate AWB Code
   */
  async generateAWB(shipmentId, courierId = null) {
    try {
      const token = await this.getToken();

      console.log(`[SHIPROCKET] Requesting AWB Assignment for Shipment ID ${shipmentId} (Courier ID: ${courierId || 'auto'})...`);

      const payload = { shipment_id: shipmentId };
      if (courierId) {
        payload.courier_id = courierId;
      }

      const response = await fetch(`${this.baseUrl}/courier/assign/awb`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (response.ok && resData.response && resData.response.data && resData.response.data.awb_code) {
        const data = resData.response.data;
        const realAwb = String(data.awb_code).trim();
        console.log(`✅ [SHIPROCKET] REAL AWB Generated: ${realAwb} via ${data.courier_name}`);
        return {
          success: true,
          awb_code: realAwb,
          courier_name: data.courier_name,
          courier_company_id: data.courier_company_id,
          tracking_url: `https://shiprocket.co/tracking/${realAwb}`
        };
      } else {
        const errMsg = resData.message || (resData.response && resData.response.data && resData.response.data.error) || 'Courier/AWB assignment pending.';
        console.warn('[SHIPROCKET] Courier AWB assignment notice:', resData);
        return { success: false, awb_code: null, courier_name: null, tracking_url: null, error: errMsg };
      }
    } catch (err) {
      console.error('[SHIPROCKET] generateAWB Error:', err.message);
      return { success: false, awb_code: null, courier_name: null, tracking_url: null, error: err.message };
    }
  }

  /**
   * Request / Schedule Courier Pickup for a Shipment
   */
  async requestPickup(shipmentId) {
    try {
      const token = await this.getToken();
      const numId = Number(shipmentId) || shipmentId;
      console.log(`[SHIPROCKET] Requesting Courier Pickup for Shipment ID ${shipmentId}...`);

      const response = await fetch(`${this.baseUrl}/courier/generate/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shipment_id: [ numId ] })
      });

      const resData = await response.json();
      console.log('[SHIPROCKET] 📦 Pickup Request API Response:', JSON.stringify(resData));

      if (response.ok && (resData.pickup_status === 1 || resData.status === 200)) {
        console.log(`✅ [SHIPROCKET] Pickup Scheduled Successfully for Shipment ${shipmentId}!`);
        return {
          success: true,
          pickup_scheduled: true,
          message: typeof resData.response === 'string' ? resData.response : 'Pickup requested successfully.'
        };
      }

      // Check if response indicates pickup was already scheduled or generated
      const respStr = typeof resData.response === 'string' ? resData.response : (resData.message || '');
      if (respStr.toLowerCase().includes('already') || respStr.toLowerCase().includes('scheduled') || respStr.toLowerCase().includes('generated')) {
        console.log(`[SHIPROCKET] ℹ️ Pickup already requested/scheduled for Shipment ${shipmentId}.`);
        return { success: true, pickup_scheduled: true, message: respStr };
      }

      return {
        success: false,
        pickup_scheduled: false,
        error: resData.message || respStr || 'Pickup request pending.'
      };
    } catch (err) {
      console.error('[SHIPROCKET] requestPickup Error:', err.message);
      return { success: false, pickup_scheduled: false, error: err.message };
    }
  }

  /**
   * Track Shipment by AWB Code or Shipment ID
   */
  async trackShipment(trackId) {
    try {
      if (!trackId || trackId === 'null' || trackId === 'undefined') {
        return { success: false, error: 'Valid AWB Code or Shipment ID is required.' };
      }

      const token = await this.getToken();
      const cleanId = String(trackId).trim();

      let url = `${this.baseUrl}/courier/track/awb/${encodeURIComponent(cleanId)}`;
      if (cleanId.startsWith('SC-')) {
        url = `${this.baseUrl}/courier/track/shipment/${encodeURIComponent(cleanId.replace(/^SC-/, ''))}`;
      }

      console.log(`[SHIPROCKET] Tracking shipment ${cleanId}...`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Tracking details unavailable from Shiprocket API.');
      }

      const trackingData = data.tracking_data || data;
      const trackHeader = trackingData.track_status ? trackingData : (data[cleanId] ? data[cleanId].tracking_data : null);

      if (trackHeader && trackHeader.shipment_track && trackHeader.shipment_track.length > 0) {
        const shipmentTrack = trackHeader.shipment_track[0];
        const scans = trackHeader.shipment_track_activities || [];
        const realAwb = shipmentTrack.awb_code || (cleanId.match(/^[A-Z0-9]{8,20}$/i) ? cleanId : null);

        return {
          success: true,
          awb_code: realAwb,
          courier_name: shipmentTrack.courier_name || 'Shiprocket Partner',
          current_status: shipmentTrack.current_status || 'ORDER_CREATED',
          origin: shipmentTrack.origin || 'SuryaCottans Hub',
          destination: shipmentTrack.destination || '',
          etd: shipmentTrack.etd || '3-5 Business Days',
          scans: scans.map(s => ({
            date: s.date || s['sr-status-label'],
            activity: s.activity,
            location: s.location || ''
          })),
          tracking_url: realAwb ? `https://shiprocket.co/tracking/${realAwb}` : null
        };
      }

      return {
        success: true,
        awb_code: null,
        courier_name: 'Shiprocket Partner',
        current_status: 'ORDER_CREATED',
        scans: [],
        tracking_url: null,
        message: 'Order created in Shiprocket. Tracking scans will update once package is picked up by courier.'
      };

    } catch (err) {
      console.error('[SHIPROCKET] trackShipment Error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }

  /**
   * Process incoming Webhook event from Shiprocket
   */
  parseWebhook(payload) {
    if (!payload) return null;

    const orderId = payload.order_id || payload.channel_order_id;
    const shipmentId = payload.shipment_id;
    const awbCode = payload.awb || payload.awb_code;
    const status = payload.current_status || payload.status;
    const courierName = payload.courier_name || payload.courier;

    let normalizedStatus = 'ORDER_CREATED';
    const sUpper = String(status || '').toUpperCase();

    if (sUpper.includes('AWB') || sUpper.includes('ASSIGN')) {
      normalizedStatus = 'READY_TO_SHIP';
    } else if (sUpper.includes('PICK') || sUpper.includes('READY')) {
      normalizedStatus = 'READY_TO_SHIP';
    } else if (sUpper.includes('TRANSIT') || sUpper.includes('DISPATCH') || sUpper.includes('SHIPPED')) {
      normalizedStatus = 'IN_TRANSIT';
    } else if (sUpper.includes('OUT FOR DELIVERY')) {
      normalizedStatus = 'OUT_FOR_DELIVERY';
    } else if (sUpper.includes('DELIVER')) {
      normalizedStatus = 'DELIVERED';
    } else if (sUpper.includes('CANCEL')) {
      normalizedStatus = 'CANCELLED';
    }

    return {
      orderId: orderId ? String(orderId).replace(/^SC-/, '') : null,
      shipmentId: shipmentId ? String(shipmentId) : null,
      awbCode: (awbCode && String(awbCode).trim()) ? String(awbCode).trim() : null,
      status: normalizedStatus,
      rawStatus: status,
      courierName: courierName || null,
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = new ShiprocketService();

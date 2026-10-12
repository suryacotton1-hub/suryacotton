/* =========================================================
   SURYA COTTON — EXPRESS API SERVER
   Razorpay Order Creation & Payment Verification
   ========================================================= */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const path = require('path');
const shiprocket = require('./shiprocket');
const emailService = require('./emailService');

const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Supabase Client Initialization ────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ptmuzfudxtfmnbqvfquh.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_4s_9vcfp6lvuFE1txQ5TfA_2iIfn_fQ';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Admin URL Protection & Secret Route ────────────────────
app.get(['/admin', '/admin.html', '/surya-admin-798', '/surya-admin-798.html'], (req, res) => {
  res.redirect('/');
});

// ─── Clean URLs without .html Extension ─────────────────────
// Automatically map clean URLs (e.g. /category, /checkout, /product, /surya-admin-798, etc.) to .html files
const fs = require('fs');

app.get('/:page', (req, res, next) => {
  if (req.params.page.includes('.')) {
    return next();
  }
  const cleanPath = path.resolve(__dirname, `${req.params.page}.html`);
  if (fs.existsSync(cleanPath)) {
    return res.sendFile(cleanPath);
  }
  next();
});

// Serve static files from project root with html extension support
app.use(express.static(path.resolve(__dirname), { extensions: ['html'] }));

// ─── Razorpay Instance ────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── GET /api/health & /api/ping ──────────────────────────
// Lightweight uptime & warm-up endpoint for Render keeping alive
app.get(['/api/health', '/api/ping'], (req, res) => {
  res.status(200).json({ status: 'ok', time: Date.now(), uptime: process.uptime() });
});

// ─── GET /api/razorpay-key ────────────────────────────────
// Returns the publishable key_id to the frontend (never the secret)
app.get('/api/razorpay-key', (req, res) => {
  res.json({ key_id: process.env.RAZORPAY_KEY_ID });
});

// ─── GET /api/email-config ────────────────────────────────
// Returns publishable EmailJS configuration (serviceId, templateId, publicKey)
app.get('/api/email-config', (req, res) => {
  res.json({
    serviceId: process.env.EMAILJS_SERVICE_ID || 'service_daknf95',
    templateId: process.env.EMAILJS_TEMPLATE_ID || '',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || ''
  });
});

// ─── POST /api/create-order ───────────────────────────────
// Creates a Razorpay order. Frontend sends { amount (paise), currency, receipt }
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || isNaN(amount) || Number(amount) < 100) {
      return res.status(400).json({
        error: 'Invalid amount. Minimum is 100 paise (₹1).',
      });
    }

    const options = {
      amount: Number(amount),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('Razorpay create-order error:', err);

    if (err.statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay authentication failed. Check credentials.' });
    }

    return res.status(500).json({
      error: 'Failed to create Razorpay order.',
      details: err.message,
    });
  }
});

// ─── POST /api/verify-payment ─────────────────────────────
// Verifies payment signature using HMAC-SHA256, saves order in DB & pushes to Shiprocket
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        verified: false,
        error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature',
      });
    }

    // 1. Verify HMAC Signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        verified: false,
        error: 'Signature mismatch. Payment verification failed.',
      });
    }

    console.log(`[PAYMENT] ✅ Razorpay Payment Verified! Payment ID: ${razorpay_payment_id}, Order ID: ${razorpay_order_id}`);

    // 2. Idempotency Check in Supabase DB
    try {
      const { data: existing } = await supabase
        .from('orders')
        .select('*')
        .eq('razorpay_payment_id', razorpay_payment_id)
        .maybeSingle();

      if (existing) {
        console.log(`[PAYMENT] ℹ️ Order with Payment ID ${razorpay_payment_id} already exists in DB (Internal Order ID: ${existing.id}).`);
        return res.status(200).json({
          verified: true,
          message: 'Payment already processed and verified.',
          internalOrderId: existing.id,
          order: existing,
          shiprocket: {
            success: true,
            shiprocket_order_id: existing.shiprocket_order_id,
            shipment_id: existing.shiprocket_shipment_id,
            awb_code: existing.awb_code,
            courier_name: existing.courier_name,
            tracking_url: existing.tracking_url,
            shipment_status: existing.shipment_status
          }
        });
      }
    } catch (dbCheckErr) {
      console.warn('[PAYMENT] Supabase idempotency check notice:', dbCheckErr.message);
    }

    // 3. Extract & Normalize Order Record & Address Fields
    const rawOrder = orderDetails || {};
    const orderId = rawOrder.id ? String(rawOrder.id) : `SC-${Date.now().toString().slice(-6)}`;
    const custName = String(rawOrder.customerName || rawOrder.customer_name || rawOrder.name || 'Valued Customer').trim();
    const custEmail = String(rawOrder.customerEmail || rawOrder.customer_email || rawOrder.email || 'care@suryacotton.com').trim();
    const custPhone = String(rawOrder.customerPhone || rawOrder.customer_phone || rawOrder.phone || '9876543210').replace(/\D/g, '').slice(-10) || '9876543210';
    const custAddress = String(rawOrder.customerAddress || rawOrder.shipping_address || rawOrder.address || '').trim();
    const custCity = String(rawOrder.customerCity || rawOrder.city || '').trim();
    const custState = String(rawOrder.customerState || rawOrder.state || '').trim();
    const custPin = String(rawOrder.customerPin || rawOrder.pincode || rawOrder.pin || '').trim();

    const dbOrder = {
      id: orderId,
      customer_name: custName,
      customer_email: custEmail,
      customer_phone: custPhone,
      customer_alt_phone: rawOrder.customerAltPhone || null,
      shipping_address: custAddress,
      city: custCity,
      state: custState,
      pincode: custPin,
      products: rawOrder.items || rawOrder.products || [],
      subtotal: parseFloat(rawOrder.total) || 0,
      shipping_charge: 0,
      total_amount: parseFloat(rawOrder.total) || 0,
      payment_status: 'PAID',
      razorpay_order_id,
      razorpay_payment_id,
      shipment_status: 'PENDING_APPROVAL',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await supabase.from('orders').upsert([dbOrder]);
      console.log(`[DB] 💾 Saved Order ${orderId} to Supabase DB (Status: PAID, Shipment: PENDING_APPROVAL)`);
    } catch (saveErr) {
      console.warn('[DB] Supabase order save notice:', saveErr.message);
    }

    // 4. Pickup is strictly held until Admin clicks "Approve & Schedule Pickup" in the Admin Panel.
    // We do NOT auto-push to Shiprocket or auto-schedule pickup during checkout.
    console.log(`[CHECKOUT] 🛑 Auto-pickup BLOCKED. Order ${orderId} safely saved as PENDING_APPROVAL.`);
    const srResult = {
      success: true,
      shiprocket_order_id: null,
      shipment_id: null,
      awb_code: null,
      courier_name: 'Pending Admin Approval',
      tracking_url: null,
      shipment_status: 'PENDING_APPROVAL'
    };

    // 6. Trigger Order Confirmation Email (EmailJS)
    let emailResult = { success: false, reason: 'skipped' };
    try {
      const emailPayload = {
        id: orderId,
        date: rawOrder.date || new Date().toISOString(),
        customerName: custName,
        customerEmail: custEmail,
        customerPhone: custPhone,
        customerAddress: custAddress,
        customerCity: custCity,
        customerState: custState,
        customerPin: custPin,
        items: rawOrder.items || rawOrder.products || [],
        total: rawOrder.total || rawOrder.total_amount,
        razorpay_payment_id,
        tracking_url: srResult.tracking_url,
        courier_name: srResult.courier_name,
        awb_code: srResult.awb_code
      };
      emailResult = await emailService.sendOrderConfirmationEmail(emailPayload);
    } catch (emailErr) {
      console.warn('[EMAIL] Order email dispatch notice:', emailErr.message);
    }

    return res.status(200).json({
      verified: true,
      message: 'Payment verified and order process completed.',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      internalOrderId: orderId,
      shiprocket: srResult,
      email_sent: emailResult.success || false
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({
      verified: false,
      error: 'Internal server error during verification.',
    });
  }
});

// ─── POST /api/send-order-email ─────────────────────────────
// Manual or admin endpoint to trigger confirmation email for an order
app.post('/api/send-order-email', async (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.id) {
      return res.status(400).json({ success: false, error: 'Missing order details.' });
    }
    const result = await emailService.sendOrderConfirmationEmail(orderData);
    return res.json(result);
  } catch (err) {
    console.error('Error sending order email:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/test-email ──────────────────────────────────
// Sends a sample test confirmation email to verify configuration
app.post('/api/test-email', async (req, res) => {
  try {
    const { to } = req.body;
    const recipient = to || 'suryacotton1@gmail.com';
    const result = await emailService.sendTestEmail(recipient);
    return res.json(result);
  } catch (err) {
    console.error('Error in test email:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/shiprocket/create-order ────────────────────
app.post('/api/shiprocket/create-order', async (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.id) {
      return res.status(400).json({ success: false, error: 'Invalid order payload. Missing order ID.' });
    }

    const cleanOrderId = String(orderData.id).trim();

    // Server-side Idempotency Guard: Prevent duplicate order creation if already in Supabase
    try {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${cleanOrderId},id.eq.SC-${cleanOrderId}`)
        .maybeSingle();

      if (existingOrder && existingOrder.shiprocket_order_id) {
        console.log(`[SHIPROCKET] ℹ️ Order ${cleanOrderId} already pushed to Shiprocket (SR ID: ${existingOrder.shiprocket_order_id}). Skipping duplicate.`);
        return res.status(200).json({
          success: true,
          duplicate_skipped: true,
          shiprocket_order_id: existingOrder.shiprocket_order_id,
          shipment_id: existingOrder.shiprocket_shipment_id,
          awb_code: existingOrder.awb_code,
          courier_name: existingOrder.courier_name,
          tracking_url: existingOrder.tracking_url,
          shipment_status: existingOrder.shipment_status
        });
      }
    } catch (checkErr) {
      console.warn('[SHIPROCKET] Duplicate check notice:', checkErr.message);
    }

    const result = await shiprocket.createOrder(orderData);

    if (result.success) {
      try {
        await supabase.from('orders').update({
          shiprocket_order_id: result.shiprocket_order_id,
          shiprocket_shipment_id: result.shipment_id,
          awb_code: result.awb_code || null,
          courier_name: result.courier_name || null,
          shipment_status: result.shipment_status || (result.awb_code ? 'READY_TO_SHIP' : 'AWB_PENDING'),
          tracking_url: result.tracking_url || null,
          updated_at: new Date().toISOString()
        }).eq('id', orderData.id);
      } catch (e) {
        console.warn("Could not sync to Supabase:", e.message);
      }
    }

    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    console.error('❌ Shiprocket order creation error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/orders ──────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return res.status(200).json({ success: true, orders: data || [] });
  } catch (err) {
    console.warn('GET /api/orders error (falling back):', err.message);
    return res.status(200).json({ success: false, orders: [], error: err.message });
  }
});

// ─── POST /api/admin/clear-orders ────────────────────────
// Deletes all fake / test orders from Supabase database
app.post('/api/admin/clear-orders', async (req, res) => {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .neq('id', '___NON_EXISTENT_ID___');

    if (error) {
      console.error('[ADMIN] Supabase clear orders error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    console.log('[ADMIN] 🗑️ All orders deleted from Supabase DB.');
    return res.status(200).json({ success: true, message: 'All orders cleared from database.' });
  } catch (err) {
    console.error('[ADMIN] Clear orders exception:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/retry-shiprocket ────────────────────
app.post('/api/admin/retry-shiprocket', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing orderId' });
    }

    console.log(`[ADMIN] 🔄 Retrying Shiprocket Fulfillment for Order: ${orderId}`);

    let orderToRetry = req.body.order;
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
      return res.status(404).json({ success: false, error: 'Order details not found.' });
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

    return res.status(200).json(result);
  } catch (err) {
    console.error('Admin retry error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/schedule-pickup ─────────────────────
// Two-phase: phase=verify (default) returns matched order for confirmation,
//            phase=confirm actually calls Shiprocket pickup API.
app.post('/api/admin/schedule-pickup', async (req, res) => {
  try {
    const { orderId, phase } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing orderId parameter.' });
    }

    console.log(`[ADMIN] 📦 Schedule Pickup ${phase === 'confirm' ? 'CONFIRM' : 'VERIFY'} for Order: ${orderId}`);

    // ── Comprehensive Order Lookup (mirrors tracking endpoint) ──
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

    // Fallback: try numeric-only match if above returned nothing
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
      console.warn(`[ADMIN] ❌ Schedule Pickup BLOCKED: Order ${orderId} not found in database. No Shiprocket API call made.`);
      return res.status(404).json({
        success: false,
        error: `Order "${orderId}" not found in database. Cannot schedule pickup for an unverified order.`
      });
    }

    // ── Pre-flight Validation ──
    let shipmentId = dbOrder.shiprocket_shipment_id;
    let realAwb = dbOrder.awb_code;
    const currentStatus = (dbOrder.shipment_status || 'PENDING_APPROVAL').toUpperCase();

    if (currentStatus === 'PICKUP_SCHEDULED' || currentStatus === 'IN_TRANSIT' ||
        currentStatus === 'OUT_FOR_DELIVERY' || currentStatus === 'DELIVERED' ||
        currentStatus === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: `Order ${dbOrder.id} is not eligible for pickup scheduling. Current status: ${currentStatus}.`,
        db_order_id: dbOrder.id,
        shipment_status: currentStatus
      });
    }

    console.log(`[ADMIN] ✅ Order Resolved — DB ID: ${dbOrder.id}, Shiprocket Shipment: ${shipmentId || 'None (Pending)'}, AWB: ${realAwb || 'None'}, Status: ${currentStatus}`);

    // ── Phase 1: Verify — return matched order details for frontend confirmation ──
    if (phase !== 'confirm') {
      return res.status(200).json({
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
      });
    }

    // ── Phase 2: Confirm — execute Admin Approval, Shiprocket Registration, AWB, and Pickup ──
    console.log(`[ADMIN] 📦 Order ${dbOrder.id} APPROVED by Admin. Proceeding with Shiprocket fulfillment...`);

    // 1. If not yet registered in Shiprocket, push order now on admin approval
    if (!shipmentId) {
      console.log(`[ADMIN] Registering Order ${dbOrder.id} in Shiprocket...`);
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
        return res.status(400).json({
          success: false,
          error: `Failed to register order in Shiprocket: ${srCreateRes.error}`,
          db_order_id: dbOrder.id
        });
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

    // 2. Generate AWB if not yet generated
    if (!realAwb && shipmentId) {
      console.log(`[ADMIN] AWB missing for Order ${dbOrder.id}. Generating AWB...`);
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
          console.log(`[ADMIN] ✅ AWB generated on demand: ${realAwb} for Order ${dbOrder.id}`);
        }
      } catch (awbErr) {
        console.warn('[ADMIN] Auto-AWB generation notice during schedule-pickup:', awbErr.message);
      }
    }

    // 3. Request courier pickup
    console.log(`[ADMIN] 📦 Calling Shiprocket Pickup API for Shipment ${shipmentId} (Order ${dbOrder.id}, AWB ${realAwb || 'N/A'})`);
    const pickupRes = await shiprocket.requestPickup(shipmentId);

    if (pickupRes.success) {
      try {
        await supabase.from('orders').update({
          shipment_status: 'PICKUP_SCHEDULED',
          updated_at: new Date().toISOString()
        }).eq('id', dbOrder.id);
        console.log(`[ADMIN] ✅ Pickup Scheduled & DB status updated to PICKUP_SCHEDULED for Order ${dbOrder.id}`);
      } catch (dbErr) {
        console.warn('[ADMIN] DB status update notice:', dbErr.message);
      }

      return res.status(200).json({
        success: true,
        phase: 'confirm',
        message: pickupRes.message || 'Pickup scheduled successfully with courier.',
        shipment_status: 'PICKUP_SCHEDULED',
        db_order_id: dbOrder.id,
        awb_code: realAwb,
        shiprocket_shipment_id: shipmentId
      });
    }

    return res.status(400).json({
      success: false,
      error: pickupRes.error || 'Failed to schedule pickup with Shiprocket.',
      db_order_id: dbOrder.id
    });
  } catch (err) {
    console.error('Admin schedule-pickup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/shiprocket/track ────────────────────────────
app.get('/api/shiprocket/track', async (req, res) => {
  try {
    const trackId = req.query.id || req.query.awb || req.query.order_id;
    console.log('[TRACK] 📥 GET /api/shiprocket/track for ID:', trackId);
    if (!trackId) {
      return res.status(400).json({ success: false, error: 'Missing trackId query param.' });
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
        console.log(`[TRACK] ✅ Supabase DB record located for ID ${rawSearch}: Order ${data.id}, AWB: ${data.awb_code || 'N/A'}, Status: ${data.shipment_status}`);
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

    // ── Side-effect: Auto-sync live Shiprocket status to Supabase if it differs ──
    if (dbRecord && trackingResult.success && trackingResult.current_status) {
      const liveStatus = normalizeShipmentStatus(trackingResult.current_status);
      const dbStatus = (dbRecord.shipment_status || '').toUpperCase();
      if (liveStatus && liveStatus !== dbStatus && liveStatus !== 'ORDER_CREATED') {
        try {
          await supabase.from('orders').update({
            shipment_status: liveStatus,
            updated_at: new Date().toISOString()
          }).eq('id', dbRecord.id);
          console.log(`[SHIPROCKET SYNC] Track side-effect: Order ${dbRecord.id} status changed: ${dbStatus} → ${liveStatus}`);
        } catch (syncErr) {
          console.warn('[SHIPROCKET SYNC] Track side-effect sync error:', syncErr.message);
        }
      }
    }

    // If order has a real AWB in DB, preserve it instead of returning null AWB / fake status
    if (dbRecord && dbRecord.awb_code) {
      // Use the live status if we have scans, otherwise fall back to whatever is freshest
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
      console.log('[TRACK] 📤 Merged Tracking Result:', mergedResponse);
      return res.status(200).json(mergedResponse);
    }

    console.log('[TRACK] 📤 Shiprocket Tracking Result:', trackingResult);
    return res.status(trackingResult.success ? 200 : 400).json(trackingResult);
  } catch (err) {
    console.error('[TRACK] ❌ Shiprocket tracking error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/shiprocket/webhook ─────────────────────────
app.post('/api/shiprocket/webhook', async (req, res) => {
  try {
    const update = shiprocket.parseWebhook(req.body);
    console.log('[SHIPROCKET SYNC] Webhook received:', {
      orderId: update?.orderId || null,
      shipmentId: update?.shipmentId || null,
      awbCode: update?.awbCode || null,
      status: update?.status || null,
      rawStatus: update?.rawStatus || null
    });

    if (update && (update.orderId || update.awbCode || update.shipmentId)) {
      try {
        // ── Comprehensive multi-field lookup to find the matching order ──
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

        if (!matchedOrder) {
          console.warn(`[SHIPROCKET SYNC] Webhook: No matching order found for identifiers (orderId=${update.orderId}, shipmentId=${update.shipmentId}, awb=${update.awbCode}). Skipping.`);
          return res.status(200).json({ received: true, matched: false, update });
        }

        console.log(`[SHIPROCKET SYNC] Order matched: ${matchedOrder.id}`);

        // ── Idempotency: skip if status is already the same ──
        const existingStatus = (matchedOrder.shipment_status || '').toUpperCase();
        if (existingStatus === update.status) {
          console.log(`[SHIPROCKET SYNC] Status already ${update.status} for Order ${matchedOrder.id}. Skipping duplicate webhook.`);
          return res.status(200).json({ received: true, duplicate: true, update });
        }

        console.log(`[SHIPROCKET SYNC] Status changed: ${existingStatus || 'UNKNOWN'} → ${update.status}`);

        // ── Build update payload ──
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
        console.log(`[SHIPROCKET SYNC] Supabase updated successfully for Order ${matchedOrder.id}`);
      } catch (dbErr) {
        console.warn('[SHIPROCKET SYNC] Webhook DB sync error:', dbErr.message);
      }
    }

    return res.status(200).json({ received: true, update });
  } catch (err) {
    console.error('[SHIPROCKET SYNC] Webhook processing error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Utility: Normalize Shiprocket status strings to internal status ──
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
  // Return the raw value uppercased if no match — don't lose information
  return s;
}

// ─── GET /api/admin/sync-shiprocket-status ────────────────
// Fallback sync: checks live Shiprocket status for orders and updates Supabase.
// ?orderId=X for single order, or no param for batch sync (max 20 non-terminal orders).
app.get('/api/admin/sync-shiprocket-status', async (req, res) => {
  try {
    const singleOrderId = req.query.orderId;
    const changes = [];

    if (singleOrderId) {
      // ── Single-order sync ──
      const rawSearch = String(singleOrderId).trim();
      const cleanNum = rawSearch.replace(/^SC-/, '');

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${rawSearch},id.eq.${cleanNum},id.eq.SC-${cleanNum},shiprocket_order_id.eq.${rawSearch},shiprocket_shipment_id.eq.${rawSearch},awb_code.eq.${rawSearch}`)
        .maybeSingle();

      if (!order) {
        return res.status(404).json({ success: false, error: `Order ${singleOrderId} not found.` });
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
              console.log(`[SHIPROCKET FALLBACK] Status changed: ${dbStatus || 'UNKNOWN'} → ${liveStatus} for Order ${order.id}`);
              console.log(`[SHIPROCKET FALLBACK] Supabase synchronized successfully`);
              changes.push({ order_id: order.id, from: dbStatus, to: liveStatus });
            }
          }
        } catch (trackErr) {
          console.warn(`[SHIPROCKET FALLBACK] Could not track Order ${order.id}:`, trackErr.message);
        }
      }

      return res.status(200).json({ success: true, synced: changes.length, changes });
    }

    // ── Batch sync: check all non-terminal orders with Shiprocket data ──
    console.log('[SHIPROCKET FALLBACK] Checking latest status for active orders...');

    const terminalStatuses = ['DELIVERED', 'CANCELLED'];
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, shipment_status, shiprocket_shipment_id, awb_code')
      .not('shiprocket_shipment_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!activeOrders || activeOrders.length === 0) {
      return res.status(200).json({ success: true, synced: 0, changes: [], message: 'No active Shiprocket orders to sync.' });
    }

    // Filter out terminal statuses client-side (Supabase .not().in() can be tricky)
    const ordersToCheck = activeOrders.filter(o => {
      const s = (o.shipment_status || '').toUpperCase();
      return !terminalStatuses.includes(s);
    });

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
            console.log(`[SHIPROCKET FALLBACK] Status changed: ${dbStatus || 'UNKNOWN'} → ${liveStatus} for Order ${order.id}`);
            console.log(`[SHIPROCKET FALLBACK] Supabase synchronized successfully`);
            changes.push({ order_id: order.id, from: dbStatus, to: liveStatus });
          }
        }
      } catch (trackErr) {
        console.warn(`[SHIPROCKET FALLBACK] Could not track Order ${order.id}:`, trackErr.message);
      }
    }

    console.log(`[SHIPROCKET FALLBACK] Batch sync complete. ${changes.length} order(s) updated.`);
    return res.status(200).json({ success: true, synced: changes.length, changes });
  } catch (err) {
    console.error('[SHIPROCKET FALLBACK] Sync error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🛍️  SuryaCotton server running at http://localhost:${PORT}`);
    console.log(`   Razorpay Key: ${process.env.RAZORPAY_KEY_ID ? '✅ Loaded' : '❌ MISSING'}`);
    console.log(`   Razorpay Secret: ${process.env.RAZORPAY_KEY_SECRET ? '✅ Loaded' : '❌ MISSING'}`);
    console.log(`   Supabase Client: ${supabaseUrl ? '✅ Loaded' : '❌ MISSING'}`);
    console.log(`   Shiprocket Integration: ✅ Active (Routes: /api/verify-payment, /create-order, /track, /webhook, /admin/retry-shiprocket, /admin/sync-shiprocket-status)`);
    console.log(`   Email Service (EmailJS): Service ID: ${process.env.EMAILJS_SERVICE_ID || 'service_daknf95'} | Template: ${process.env.EMAILJS_TEMPLATE_ID ? '✅ Loaded' : '⚠️ Set in .env'} | Public Key: ${process.env.EMAILJS_PUBLIC_KEY ? '✅ Loaded' : '⚠️ Set in .env'}\n`);
  });
}

module.exports = app;


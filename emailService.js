/* =========================================================
   SURYA COTTON — SERVER-SIDE EMAIL SERVICE (EmailJS API)
   Sends Order Confirmation Emails when Payment is Verified
   ========================================================= */

/**
 * Formats a clean HTML table and text summary for purchased items
 */
function formatOrderItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      itemsSummary: '1x SuryaCotton Premium Apparel',
      itemsHtml: '<tr><td colspan="4" style="padding:10px;text-align:center;">SuryaCotton Premium Collection</td></tr>'
    };
  }

  const textLines = items.map(item => {
    const sizeStr = item.size ? ` (Size: ${item.size})` : '';
    const qty = item.qty || 1;
    const price = item.price ? ` - ₹${Number(item.price * qty).toLocaleString('en-IN')}` : '';
    return `• ${qty}x ${item.name || 'Item'}${sizeStr}${price}`;
  });

  const htmlRows = items.map(item => {
    const sizeStr = item.size ? `<span style="display:inline-block;padding:2px 8px;background:#f1f5f9;border-radius:4px;font-size:12px;font-weight:600;color:#334155;">${item.size}</span>` : '-';
    const qty = item.qty || 1;
    const price = item.price ? `₹${Number(item.price * qty).toLocaleString('en-IN')}` : '₹0';
    const imgTag = item.img ? `<img src="${item.img}" alt="${item.name || 'Product'}" width="42" height="42" style="border-radius:6px;object-fit:cover;margin-right:10px;vertical-align:middle;" />` : '';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 8px; font-weight: 600; color: #0f172a; vertical-align: middle;">
          ${imgTag}
          <span style="vertical-align:middle;">${item.name || 'SuryaCotton Product'}</span>
        </td>
        <td style="padding: 12px 8px; text-align: center; vertical-align: middle;">${sizeStr}</td>
        <td style="padding: 12px 8px; text-align: center; font-weight: 600; color: #334155; vertical-align: middle;">${qty}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: #0f172a; vertical-align: middle;">${price}</td>
      </tr>
    `;
  }).join('');

  return {
    itemsSummary: textLines.join('\n'),
    itemsHtml: htmlRows
  };
}

/**
 * Builds all template parameters passed to EmailJS
 */
function buildTemplateParams(order = {}) {
  const { itemsSummary, itemsHtml } = formatOrderItems(order.items || order.products || []);

  const orderId = order.id ? (String(order.id).startsWith('SC-') ? String(order.id) : `SC-${order.id}`) : `SC-${Date.now().toString().slice(-6)}`;
  const custName = (order.customerName || order.customer_name || order.name || 'Valued Customer').trim();
  const custEmail = (order.customerEmail || order.customer_email || order.email || '').trim();
  const custPhone = (order.customerPhone || order.customer_phone || order.phone || 'N/A').trim();

  // Full address
  const addressParts = [
    order.customerAddress || order.shipping_address || order.address,
    order.customerCity || order.city,
    order.customerState || order.state,
    order.customerPin || order.pincode || order.pin
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Delivery Address Provided at Checkout';

  const totalNum = parseFloat(order.total || order.total_amount || order.subtotal) || 0;
  const formattedTotal = `₹${totalNum.toLocaleString('en-IN')}`;

  const dateObj = order.date || order.created_at ? new Date(order.date || order.created_at) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const trackingUrl = order.tracking_url || (order.awb_code ? `https://shiprocket.co/tracking/${order.awb_code}` : `https://suryacotton.com/track.html?order=${orderId}`);

  return {
    // Standard EmailJS variables
    to_name: custName,
    to_email: custEmail,
    customer_name: custName,
    customer_email: custEmail,
    customer_phone: custPhone,
    order_id: orderId,
    order_date: formattedDate,
    order_total: formattedTotal,
    total_amount: formattedTotal,
    payment_id: order.razorpay_payment_id || order.payment_id || 'PREPAID',
    payment_method: 'Prepaid (Razorpay Online)',
    shipping_address: fullAddress,
    items_summary: itemsSummary,
    items_html: itemsHtml,
    tracking_url: trackingUrl,
    name: 'SuryaCotton',
    from_name: 'SuryaCotton',
    email: 'suryacotton1@gmail.com',
    reply_to: 'suryacotton1@gmail.com',
    store_name: 'SuryaCotton',
    support_email: 'suryacotton1@gmail.com',
    store_url: 'https://suryacotton.com',
    store_address: 'No,6, L.P.N School Complex, Alagar Kovil Main Road, Moondrumavadi, Pudhur, Madurai-625009, Tamil Nadu, India'
  };
}

/**
 * Sends Order Confirmation Email via EmailJS REST API
 */
async function sendOrderConfirmationEmail(order = {}) {
  const serviceId = process.env.EMAILJS_SERVICE_ID || 'service_daknf95';
  const templateId = process.env.EMAILJS_TEMPLATE_ID || 'template_j0udqht';
  const publicKey = process.env.EMAILJS_PUBLIC_KEY || 'XyD2BSBIHw8JUf2gK';
  const privateKey = process.env.EMAILJS_PRIVATE_KEY || '';

  const targetEmail = (order.customerEmail || order.customer_email || order.email || '').trim();

  if (!targetEmail || !targetEmail.includes('@')) {
    console.warn(`[EMAIL] ⚠️ No valid customer email provided for Order ${order.id || 'N/A'}. Email not sent.`);
    return { success: false, reason: 'missing_email' };
  }

  if (!serviceId || !templateId || !publicKey) {
    console.warn(`[EMAIL] ⚠️ EmailJS not fully configured in .env:`);
    console.warn(`   SERVICE_ID: ${serviceId ? '✅ ' + serviceId : '❌ MISSING'}`);
    console.warn(`   TEMPLATE_ID: ${templateId ? '✅ ' + templateId : '❌ MISSING (Set in .env or EmailJS dashboard)'}`);
    console.warn(`   PUBLIC_KEY: ${publicKey ? '✅ Set' : '❌ MISSING (Set in .env or EmailJS dashboard)'}`);
    return {
      success: false,
      reason: 'unconfigured',
      message: 'EMAILJS_TEMPLATE_ID or EMAILJS_PUBLIC_KEY is not set yet in .env'
    };
  }

  const templateParams = buildTemplateParams(order);

  try {
    const payload = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams
    };

    if (privateKey) {
      payload.accessToken = privateKey;
    }

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost'
      },
      body: JSON.stringify(payload)
    });

    const resText = await response.text();

    if (response.ok) {
      console.log(`[EMAIL] ✅ Order confirmation email successfully sent to ${targetEmail} (Order #${templateParams.order_id})!`);
      return { success: true, message: 'Email sent successfully', orderId: templateParams.order_id, email: targetEmail };
    } else {
      console.error(`[EMAIL] ❌ EmailJS API returned status ${response.status}:`, resText);
      return { success: false, error: resText, status: response.status };
    }
  } catch (err) {
    console.error('[EMAIL] ❌ Network error while calling EmailJS API:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a test confirmation email to verify credentials & template
 */
async function sendTestEmail(recipientEmail) {
  const sampleOrder = {
    id: 'SC-TEST-' + Math.floor(1000 + Math.random() * 9000),
    customerName: 'SuryaCotton VIP Customer',
    customerEmail: recipientEmail,
    customerPhone: '9876543210',
    customerAddress: '42, Textile City Road, Gandhi Nagar',
    customerCity: 'Coimbatore',
    customerState: 'Tamil Nadu',
    customerPin: '641001',
    items: [
      { name: "Pure Cotton Premium Shirt - White", size: "L", qty: 1, price: 1499 },
      { name: "Tailored Linen Trousers - Charcoal", size: "32", qty: 1, price: 1999 }
    ],
    total: 3498,
    razorpay_payment_id: 'pay_test_' + Date.now().toString().slice(-8),
    courier_name: 'Blue Dart Express',
    awb_code: 'AWB' + Math.floor(100000000 + Math.random() * 900000000)
  };

  return await sendOrderConfirmationEmail(sampleOrder);
}

module.exports = {
  sendOrderConfirmationEmail,
  sendTestEmail,
  buildTemplateParams,
  formatOrderItems
};

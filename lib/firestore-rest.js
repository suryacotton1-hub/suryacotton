// lib/firestore-rest.js
// Direct Google Firestore REST API client for Node.js (Zero external dependencies)
// Project: surya-cottans

const https = require('https');

const PROJECT_ID = 'surya-cottans';
const BASE_HOST = 'firestore.googleapis.com';
const BASE_PATH = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      fields[key] = Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(item => {
            if (item && typeof item === 'object') {
              return { mapValue: { fields: toFirestoreFields(item) } };
            }
            return { stringValue: String(item || '') };
          })
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(value) } };
    }
  }
  return fields;
}

function fromFirestoreFields(fields) {
  if (!fields || typeof fields !== 'object') return {};
  const obj = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if (valObj.stringValue !== undefined) obj[key] = valObj.stringValue;
    else if (valObj.integerValue !== undefined) obj[key] = parseInt(valObj.integerValue, 10);
    else if (valObj.doubleValue !== undefined) obj[key] = parseFloat(valObj.doubleValue);
    else if (valObj.booleanValue !== undefined) obj[key] = valObj.booleanValue;
    else if (valObj.nullValue !== undefined) obj[key] = null;
    else if (valObj.arrayValue !== undefined) {
      const arr = valObj.arrayValue.values || [];
      obj[key] = arr.map(item => {
        if (item.mapValue) return fromFirestoreFields(item.mapValue.fields);
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.integerValue !== undefined) return parseInt(item.integerValue, 10);
        return item;
      });
    } else if (valObj.mapValue !== undefined) {
      obj[key] = fromFirestoreFields(valObj.mapValue.fields);
    }
  }
  return obj;
}

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Firestore request timed out (8s)'));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Upsert an order document in Firestore
 */
async function saveOrderToFirestore(orderId, orderData) {
  try {
    const cleanId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');
    const fields = toFirestoreFields(orderData);
    const body = JSON.stringify({ fields });

    const res = await httpsRequest({
      hostname: BASE_HOST,
      path: `${BASE_PATH}/orders/${cleanId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    if (res.status >= 200 && res.status < 300) {
      console.log(`[FIRESTORE REST] ✅ Saved/Updated Order #${cleanId} in Firestore`);
      return { success: true, id: cleanId };
    } else {
      console.warn(`[FIRESTORE REST] ⚠️ Failed to save order #${cleanId} (status ${res.status}):`, res.data || res.raw);
      return { success: false, error: res.data || res.raw };
    }
  } catch (err) {
    console.error(`[FIRESTORE REST] ❌ Exception saving order #${orderId}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get an order by internal ID from Firestore
 */
async function getOrderFromFirestore(orderId) {
  try {
    const cleanId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');
    const res = await httpsRequest({
      hostname: BASE_HOST,
      path: `${BASE_PATH}/orders/${cleanId}`,
      method: 'GET'
    });

    if (res.status === 200 && res.data && res.data.fields) {
      return fromFirestoreFields(res.data.fields);
    }
    return null;
  } catch (err) {
    console.warn(`[FIRESTORE REST] Could not fetch order #${orderId}:`, err.message);
    return null;
  }
}

/**
 * Find an order in Firestore by Razorpay Order ID or Payment ID
 */
async function findOrderByRazorpay(rzpOrderId, rzpPaymentId) {
  try {
    // Run structured query via Firestore runQuery endpoint
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'orders' }],
        where: {
          compositeFilter: {
            op: 'OR',
            filters: [
              ...(rzpOrderId ? [{
                fieldFilter: {
                  field: { fieldPath: 'razorpay_order_id' },
                  op: 'EQUAL',
                  value: { stringValue: String(rzpOrderId) }
                }
              }] : []),
              ...(rzpPaymentId ? [{
                fieldFilter: {
                  field: { fieldPath: 'razorpay_payment_id' },
                  op: 'EQUAL',
                  value: { stringValue: String(rzpPaymentId) }
                }
              }] : [])
            ]
          }
        },
        limit: 1
      }
    };

    const body = JSON.stringify(query);
    const res = await httpsRequest({
      hostname: BASE_HOST,
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    if (res.status === 200 && Array.isArray(res.data)) {
      for (const item of res.data) {
        if (item.document && item.document.fields) {
          const docId = item.document.name.split('/').pop();
          return { docId, ...fromFirestoreFields(item.document.fields) };
        }
      }
    }
  } catch (err) {
    console.warn('[FIRESTORE REST] Query by Razorpay ID error, falling back to document scan:', err.message);
  }

  // Fallback: fetch recent orders list and search in-memory
  try {
    const res = await httpsRequest({
      hostname: BASE_HOST,
      path: `${BASE_PATH}/orders?pageSize=50`,
      method: 'GET'
    });
    if (res.status === 200 && res.data && res.data.documents) {
      for (const doc of res.data.documents) {
        const docData = fromFirestoreFields(doc.fields);
        const docId = doc.name.split('/').pop();
        if ((rzpOrderId && docData.razorpay_order_id === rzpOrderId) ||
            (rzpPaymentId && docData.razorpay_payment_id === rzpPaymentId)) {
          return { docId, ...docData };
        }
      }
    }
  } catch (scanErr) {
    console.warn('[FIRESTORE REST] Scan fallback error:', scanErr.message);
  }

  return null;
}

/**
 * Get a product by ID from Firestore
 */
async function getProductFromFirestore(productId) {
  try {
    const cleanId = String(productId || '').trim();
    if (!cleanId) return null;
    const res = await httpsRequest({
      hostname: BASE_HOST,
      path: `${BASE_PATH}/products/${encodeURIComponent(cleanId)}`,
      method: 'GET'
    });

    if (res.status === 200 && res.data && res.data.fields) {
      return { id: cleanId, ...fromFirestoreFields(res.data.fields) };
    }
    return null;
  } catch (err) {
    console.warn(`[FIRESTORE REST] Could not fetch product #${productId}:`, err.message);
    return null;
  }
}

/**
 * Get shipping settings from Firestore
 */
async function getShippingSettingsFromFirestore() {
  try {
    const res = await httpsRequest({
      hostname: BASE_HOST,
      path: `${BASE_PATH}/settings/shipping`,
      method: 'GET'
    });

    if (res.status === 200 && res.data && res.data.fields) {
      return fromFirestoreFields(res.data.fields);
    }
    return null;
  } catch (err) {
    console.warn('[FIRESTORE REST] Could not fetch shipping settings:', err.message);
    return null;
  }
}

module.exports = {
  saveOrderToFirestore,
  getOrderFromFirestore,
  findOrderByRazorpay,
  getProductFromFirestore,
  getShippingSettingsFromFirestore,
  toFirestoreFields,
  fromFirestoreFields
};


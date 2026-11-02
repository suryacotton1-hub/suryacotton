// add_order.js
// Utility to manually insert or restore a missed order into Firestore & Shiprocket
// Usage: node add_order.js

const firestore = require('./lib/firestore-rest');
const shiprocket = require('./shiprocket');

// Fill in the customer's confirmed details here:
const orderToRestore = {
  id: 'SC-838001', // or custom order number
  date: '2026-11-01T10:01:00.000Z',
  customerName: 'Hariharan',
  customerEmail: 'hariharan07140@gmail.com',
  customerPhone: '8056336448',
  customerAltPhone: null,
  customerAddress: process.argv[2] || 'Address pending confirmation from customer',
  customerCity: process.argv[3] || 'City',
  customerState: process.argv[4] || 'Tamil Nadu',
  customerPin: process.argv[5] || '625001',
  items: [
    {
      id: '0CUXIlcM6uw818191eKE',
      name: 'Shirt 1 (₹399)',
      qty: 1,
      price: 399,
      size: 'M'
    },
    {
      id: '2rBDcIf8xD90pqVO4ABX',
      name: 'Shirt 2 (₹399)',
      qty: 1,
      price: 399,
      size: 'M'
    }
  ],
  total: 838,
  paymentMethod: 'Prepaid (Razorpay)',
  status: 'Processing',
  payment_status: 'PAID',
  shipment_status: 'PENDING_APPROVAL',
  razorpay_payment_id: 'pay_Tuz2l1CetZmSSf',
  razorpay_order_id: 'order_Tuz2..._Nov1',
  created_at: '2026-11-01T10:01:00.000Z',
  updated_at: new Date().toISOString()
};

async function insertOrder() {
  console.log(`[RESTORE] Saving Order #${orderToRestore.id} to Firestore...`);
  const res = await firestore.saveOrderToFirestore(orderToRestore.id, orderToRestore);
  if (res.success) {
    console.log(`[RESTORE] ✅ Order successfully created in Firestore!`);
    console.log(`Open your Admin Dashboard (surya-vault-9v2x4m.html) and check the Orders tab.`);
  } else {
    console.error(`[RESTORE] ❌ Failed to save order:`, res.error);
  }
}

if (require.main === module) {
  insertOrder();
}

module.exports = { orderToRestore, insertOrder };


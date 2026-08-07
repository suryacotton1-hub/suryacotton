/* =========================================================
   SURYA COTTANS — EXPRESS API SERVER
   Razorpay Order Creation & Payment Verification
   ========================================================= */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from project root
app.use(express.static(path.join(__dirname)));

// ─── Razorpay Instance ────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── GET /api/razorpay-key ────────────────────────────────
// Returns the publishable key_id to the frontend (never the secret)
app.get('/api/razorpay-key', (req, res) => {
  res.json({ key_id: process.env.RAZORPAY_KEY_ID });
});

// ─── POST /api/create-order ───────────────────────────────
// Creates a Razorpay order. Frontend sends { amount (paise), currency, receipt }
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || Number(amount) < 100) {
      return res.status(400).json({
        error: 'Invalid amount. Minimum is 100 paise (₹1).',
      });
    }

    const options = {
      amount: Number(amount), // amount in paise
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

    // Handle auth failures
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
// Verifies payment signature using HMAC-SHA256
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        verified: false,
        error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature',
      });
    }

    // Generate expected signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      return res.status(200).json({
        verified: true,
        message: 'Payment verified successfully.',
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
      });
    } else {
      return res.status(400).json({
        verified: false,
        error: 'Signature mismatch. Payment verification failed.',
      });
    }
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({
      verified: false,
      error: 'Internal server error during verification.',
    });
  }
});

// ─── Start Server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🛍️  SuryaCottans server running at http://localhost:${PORT}`);
  console.log(`   Razorpay Key: ${process.env.RAZORPAY_KEY_ID ? '✅ Loaded' : '❌ MISSING'}`);
  console.log(`   Razorpay Secret: ${process.env.RAZORPAY_KEY_SECRET ? '✅ Loaded' : '❌ MISSING'}\n`);
});

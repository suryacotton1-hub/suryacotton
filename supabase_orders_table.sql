-- supabase_orders_table.sql
-- Run this in your Supabase Dashboard -> SQL Editor to create the missing 'orders' table

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    customer_alt_phone TEXT,
    shipping_address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    products JSONB,
    subtotal NUMERIC,
    shipping_charge NUMERIC DEFAULT 0,
    total_amount NUMERIC,
    payment_status TEXT DEFAULT 'PAID',
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    shipment_status TEXT DEFAULT 'PENDING_APPROVAL',
    shiprocket_order_id TEXT,
    shiprocket_shipment_id TEXT,
    awb_code TEXT,
    courier_name TEXT,
    tracking_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) but allow authenticated / service operations
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write for orders"
ON public.orders
FOR ALL
USING (true)
WITH CHECK (true);


/* =========================================================
   SURYA COTTANS — SUPABASE CONFIGURATION & MEDIA STORAGE HELPERS
   ========================================================= */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { uploadToCloudinary } from "./cloudinary-config.js";

// Supports build environments (import.meta.env.VITE_...) or global window fallbacks
const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  || (typeof window !== 'undefined' && window.__SUPABASE_URL__)
  || "https://ptmuzfudxtfmnbqvfquh.supabase.co";

const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
  || (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY__)
  || "sb_publishable_4s_9vcfp6lvuFE1txQ5TfA_2iIfn_fQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET_NAME = "product-images";

/**
 * Uploads a product image directly to Cloudinary (with auto WebP/AVIF compression).
 * Falls back to Supabase Storage if Cloudinary is temporarily unreachable.
 */
export async function uploadProductImage(file, customName = null) {
  if (!file) throw new Error("No file provided for upload.");

  try {
    // Primary: Cloudinary (25 GB free + auto compression f_auto,q_auto)
    const cloudinaryUrl = await uploadToCloudinary(file, "products");
    console.log("Uploaded product image to Cloudinary:", cloudinaryUrl);
    return cloudinaryUrl;
  } catch (cloudErr) {
    console.warn("Cloudinary upload failed, attempting Supabase Storage fallback:", cloudErr);

    // Fallback: Supabase Storage
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    let ext = "jpg";
    if (file.name && file.name.includes('.')) {
      const parts = file.name.split('.');
      if (parts.length > 1) ext = parts.pop().toLowerCase();
    } else if (file.type && file.type.includes('/')) {
      ext = file.type.split('/')[1].split(';')[0];
    }
    
    const fileName = customName || `prod_${timestamp}_${randomStr}.${ext}`;
    const filePath = `products/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Upload failed on both Cloudinary (${cloudErr.message}) and Supabase Storage (${error.message})`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error("Uploaded image successfully to Supabase, but failed to retrieve public URL.");
    }

    return publicUrlData.publicUrl;
  }
}

/**
 * Uploads a review image directly to Cloudinary (with auto WebP/AVIF compression).
 * Falls back to Supabase Storage if Cloudinary fails.
 */
export async function uploadReviewImage(file) {
  if (!file) throw new Error("No file provided for review image upload.");

  try {
    // Primary: Cloudinary (reviews folder)
    const cloudinaryUrl = await uploadToCloudinary(file, "reviews");
    console.log("Uploaded review image to Cloudinary:", cloudinaryUrl);
    return cloudinaryUrl;
  } catch (cloudErr) {
    console.warn("Cloudinary review upload failed, attempting Supabase Storage fallback:", cloudErr);

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    let ext = "jpg";
    if (file.name && file.name.includes('.')) {
      const parts = file.name.split('.');
      if (parts.length > 1) ext = parts.pop().toLowerCase();
    } else if (file.type && file.type.includes('/')) {
      ext = file.type.split('/')[1].split(';')[0];
    }

    const fileName = `rev_${timestamp}_${randomStr}.${ext}`;
    const filePath = `reviews/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Review upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      throw new Error("Uploaded review image, but failed to retrieve public URL.");
    }

    return publicUrlData.publicUrl;
  }
}

/**
 * Deletes an image given its public URL or path.
 * If it's a Supabase Storage URL, cleans up from 'product-images' bucket.
 */
export async function deleteProductImage(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return;
  
  try {
    if (urlOrPath.includes("cloudinary.com")) {
      console.log("Cloudinary image reference cleared:", urlOrPath);
      return;
    }

    let filePath = urlOrPath;
    const bucketMarker = `/${BUCKET_NAME}/`;
    const idx = urlOrPath.indexOf(bucketMarker);
    if (idx !== -1) {
      filePath = urlOrPath.substring(idx + bucketMarker.length);
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.warn(`Failed to delete old image (${filePath}) from Supabase:`, error.message);
    }
  } catch (err) {
    console.warn("Error in deleteProductImage:", err);
  }
}

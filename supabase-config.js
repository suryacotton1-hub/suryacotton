/* =========================================================
   SURYA COTTANS — SUPABASE CONFIGURATION & STORAGE HELPERS
   ========================================================= */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

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
 * Uploads a file (File or Blob) to Supabase Storage 'product-images' bucket.
 * Returns the public URL of the uploaded image.
 * Throws an error if upload fails.
 */
export async function uploadProductImage(file, customName = null) {
  if (!file) throw new Error("No file provided for upload.");

  // Generate unique filename with extension
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
    console.error("Supabase storage upload error:", error);
    throw new Error(`Failed to upload image to Supabase Storage (${BUCKET_NAME}): ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error("Uploaded image successfully, but failed to retrieve public URL from Supabase.");
  }

  return publicUrlData.publicUrl;
}

/**
 * Uploads a review image to Supabase Storage 'product-images' bucket under 'reviews/'.
 * Returns the public URL of the uploaded image.
 */
export async function uploadReviewImage(file) {
  if (!file) throw new Error("No file provided for review image upload.");

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
    console.error("Supabase review image upload error:", error);
    throw new Error(`Failed to upload review image to Supabase: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error("Uploaded review image, but failed to retrieve public URL.");
  }

  return publicUrlData.publicUrl;
}

/**
 * Deletes an image from the 'product-images' bucket given its public URL or path.
 */
export async function deleteProductImage(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') return;
  
  try {
    let filePath = urlOrPath;
    // If it's a full URL, extract the relative path inside the bucket
    const bucketMarker = `/${BUCKET_NAME}/`;
    const idx = urlOrPath.indexOf(bucketMarker);
    if (idx !== -1) {
      filePath = urlOrPath.substring(idx + bucketMarker.length);
    } // If it's already a relative path or doesn't match marker, try deleting as is

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

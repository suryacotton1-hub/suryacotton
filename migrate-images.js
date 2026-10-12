/* =========================================================
   SURYA COTTON — EXISTING PRODUCT IMAGE MIGRATION MODULE
   ========================================================= */

import { uploadProductImage } from "./supabase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Converts a Base64 Data URL string to a browser Blob object.
 */
function dataURLtoBlob(dataURL) {
  const parts = dataURL.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Scans a list of product objects from Firestore. If any product has images stored as Base64 Data URLs,
 * uploads those images to the Supabase Storage 'product-images' bucket, retrieves public URLs, and
 * updates the Firestore document so it only contains the public URLs.
 * 
 * @param {Object} db - The initialized Firestore database instance.
 * @param {Array} productsList - The current array of products loaded from Firestore.
 * @param {Function} onProgress - Optional callback function (msg, percent) for logging progress.
 * @returns {Object} { totalChecked, migratedCount, errorCount }
 */
export async function migrateExistingProductImages(db, productsList = [], onProgress = () => {}) {
  let migratedCount = 0;
  let errorCount = 0;
  const totalChecked = productsList.length;

  if (totalChecked === 0) {
    onProgress("No products found to migrate.", 100);
    return { totalChecked: 0, migratedCount: 0, errorCount: 0 };
  }

  for (let i = 0; i < totalChecked; i++) {
    const product = productsList[i];
    const progressPercent = Math.round(((i + 1) / totalChecked) * 100);
    onProgress(`Checking product "${product.name || product.id}" (${i + 1}/${totalChecked})...`, progressPercent);

    let needsUpdate = false;
    let newImg = product.img;
    let newImages = Array.isArray(product.images) ? [...product.images] : (product.img ? [product.img] : []);

    try {
      // Check main img property
      if (typeof newImg === 'string' && newImg.startsWith('data:image/')) {
        onProgress(`Uploading main image for "${product.name}" to Supabase...`, progressPercent);
        const blob = dataURLtoBlob(newImg);
        const customName = `migrated_${product.id}_main_${Date.now()}.jpg`;
        newImg = await uploadProductImage(blob, customName);
        needsUpdate = true;
      }

      // Check images array
      for (let j = 0; j < newImages.length; j++) {
        const imgItem = newImages[j];
        if (typeof imgItem === 'string' && imgItem.startsWith('data:image/')) {
          onProgress(`Uploading image #${j + 1} for "${product.name}" to Supabase...`, progressPercent);
          const blob = dataURLtoBlob(imgItem);
          const customName = `migrated_${product.id}_img${j}_${Date.now()}.jpg`;
          newImages[j] = await uploadProductImage(blob, customName);
          needsUpdate = true;
        }
      }

      // Sync fallback: if img was not base64 but images[0] changed
      if (newImages.length > 0 && newImg !== newImages[0]) {
        newImg = newImages[0];
        needsUpdate = true;
      }

      // If images were converted and uploaded, save updated URLs back to Firestore
      if (needsUpdate) {
        onProgress(`Updating Firestore document for "${product.name}"...`, progressPercent);
        const docRef = doc(db, "products", String(product.id));
        await setDoc(docRef, { img: newImg, images: newImages }, { merge: true });
        
        // Update in-memory product object
        product.img = newImg;
        product.images = newImages;
        migratedCount++;
      }
    } catch (err) {
      console.error(`Migration error on product ${product.id} (${product.name}):`, err);
      errorCount++;
    }
  }

  onProgress(`Migration finished! Migrated: ${migratedCount}, Errors: ${errorCount}.`, 100);
  return { totalChecked, migratedCount, errorCount };
}

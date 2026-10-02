/* =========================================================
   SURYA COTTANS — CLOUDINARY CONFIGURATION & MEDIA HELPERS
   ========================================================= */

export const CLOUDINARY_CONFIG = {
  cloudName: "lchztz1d",
  uploadPreset: "ml_default",
  uploadUrl: "https://api.cloudinary.com/v1_1/lchztz1d/image/upload"
};

/**
 * Uploads a file (File, Blob, or base64 data-URI) to Cloudinary.
 * Automatically injects next-gen optimizations (f_auto, q_auto) into the resulting URL
 * so customers download compressed WebP/AVIF versions on mobile/desktop without quality loss.
 *
 * @param {File|Blob|string} file - The image file to upload.
 * @param {string} folder - Folder name in Cloudinary (e.g. 'products', 'reviews').
 * @returns {Promise<string>} - The optimized HTTPS public URL.
 */
export async function uploadToCloudinary(file, folder = "products") {
  if (!file) throw new Error("No file provided for Cloudinary upload.");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
  if (folder) {
    formData.append("folder", folder);
  }

  const response = await fetch(CLOUDINARY_CONFIG.uploadUrl, {
    method: "POST",
    body: formData
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || `Cloudinary upload failed (HTTP ${response.status})`;
    console.error("Cloudinary upload error:", errorMsg, data);
    throw new Error(errorMsg);
  }

  let finalUrl = data.secure_url || data.url;
  if (!finalUrl) {
    throw new Error("Cloudinary upload succeeded, but no URL was returned.");
  }

  // Inject automatic WebP/AVIF formatting and compression optimization:
  // e.g. /upload/v1234/file.jpg -> /upload/f_auto,q_auto/v1234/file.jpg
  if (finalUrl.includes("/upload/") && !finalUrl.includes("/f_auto,q_auto/")) {
    finalUrl = finalUrl.replace("/upload/", "/upload/f_auto,q_auto/");
  }

  return finalUrl;
}

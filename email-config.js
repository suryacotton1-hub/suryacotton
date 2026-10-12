/* =========================================================
   SURYA COTTON — EMAILJS CLIENT CONFIGURATION
   ========================================================= */

// EmailJS credentials for order confirmation emails
export const EMAIL_CONFIG = {
  // Service ID from EmailJS Gmail Service (configured by you)
  serviceId: "service_daknf95",

  // Template ID from EmailJS (Email Templates -> Template ID, e.g. "template_xxxxxxx")
  templateId: "template_j0udqht",

  // Public Key from EmailJS (Account -> API Keys -> Public Key)
  publicKey: "XyD2BSBIHw8JUf2gK",

  // Store & support contact details
  storeName: "SuryaCotton",
  supportEmail: "suryacotton1@gmail.com",
  storeUrl: "https://suryacotton.com",
  storeAddress: "No,6, L.P.N School Complex, Alagar Kovil Main Road, Moondrumavadi, Pudhur, Madurai-625009, Tamil Nadu, India"
};

/**
 * Fetch dynamic configuration from backend if available (fallback to local EMAIL_CONFIG)
 */
export async function getActiveEmailConfig(backendUrl = '') {
  try {
    const base = backendUrl ? backendUrl.replace(/\/$/, '') : '';
    const res = await fetch(`${base}/api/email-config`);
    if (res.ok) {
      const data = await res.json();
      if (data.serviceId || data.templateId || data.publicKey) {
        return {
          serviceId: data.serviceId || EMAIL_CONFIG.serviceId,
          templateId: data.templateId || EMAIL_CONFIG.templateId,
          publicKey: data.publicKey || EMAIL_CONFIG.publicKey,
          storeName: EMAIL_CONFIG.storeName,
          supportEmail: EMAIL_CONFIG.supportEmail,
          storeUrl: EMAIL_CONFIG.storeUrl
        };
      }
    }
  } catch (err) {
    // Backend offline or route unavailable, proceed with local config
  }
  return EMAIL_CONFIG;
}

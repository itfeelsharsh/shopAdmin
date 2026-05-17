import featureConfig from './featureConfig';

/**
 * Email Deduplication Guard (Admin Panel)
 * Prevents the same email from being sent multiple times within a short window.
 */
const EMAIL_DEDUP_CACHE = new Map();
const EMAIL_DEDUP_TTL = 60000; // 60 seconds

const isDuplicateEmail = (key) => {
  const now = Date.now();
  for (const [k, timestamp] of EMAIL_DEDUP_CACHE.entries()) {
    if (now - timestamp > EMAIL_DEDUP_TTL) EMAIL_DEDUP_CACHE.delete(k);
  }
  if (EMAIL_DEDUP_CACHE.has(key)) return true;
  EMAIL_DEDUP_CACHE.set(key, now);
  return false;
};

const processImageForEmail = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.includes('i.imgur.com')) {
    if (!imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return `${imageUrl}.jpg`;
    }
  }
  return imageUrl;
};

/**
 * Generate smart email subject line
 * - 1 product: Product name (char limited to 40)
 * - 2 products: "Product1 & Product2"
 * - 3+ products: "Order #ID - X items"
 */
const generateEmailSubject = (order, type = 'confirmation') => {
  const items = order.items || [];
  const orderId = (order.orderId || order.id || '').slice(-8);
  
  let productPart = '';
  if (items.length === 0) {
    productPart = `Order #${orderId}`;
  } else if (items.length === 1) {
    productPart = items[0].name?.substring(0, 40) || `Order #${orderId}`;
  } else if (items.length === 2) {
    const n1 = (items[0].name || 'Item 1').substring(0, 20);
    const n2 = (items[1].name || 'Item 2').substring(0, 20);
    productPart = `${n1} & ${n2}`;
  } else {
    productPart = `Order #${orderId} — ${items.length} items`;
  }

  switch (type) {
    case 'confirmation':
      return `Confirmed: ${productPart}`;
    case 'shipped':
      return `Shipped: ${productPart}`;
    case 'status':
      return `Update: ${productPart}`;
    default:
      return productPart;
  }
};

/**
 * Base Email Template — Clean, minimal, professional
 * Text-based "KamiKoto." branding (matching navbar font style)
 * Simplified footer per anti-spam best practices
 */
const generateBaseEmailTemplate = ({ title, previewText, content }) => {
  const currentYear = new Date().getFullYear();
  const siteUrl = 'https://kamikoto.click';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }

    .email-container { max-width: 600px !important; margin: 0 auto !important; width: 100% !important; }
    
    .btn { 
      display: inline-block; 
      background: #0f172a;
      color: #ffffff !important; 
      font-size: 14px; 
      font-weight: 600; 
      text-decoration: none; 
      padding: 14px 32px; 
      border-radius: 8px; 
      text-align: center;
    }

    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding: 20px 16px !important; }
    }
  </style>
</head>
<body>
  <!-- Hidden Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${previewText}
  </div>

  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          
          <!-- Header: Text-based KamiKoto. branding (matches navbar) -->
          <div style="padding: 32px 24px 24px; text-align: center;">
            <a href="${siteUrl}" target="_blank" style="text-decoration: none;">
              <span style="font-family: 'Inter', -apple-system, sans-serif; font-size: 28px; font-weight: 900; letter-spacing: -0.05em; color: #0f172a;">KamiKoto</span><span style="font-family: 'Inter', -apple-system, sans-serif; font-size: 28px; font-weight: 900; color: #94a3b8;">.</span>
            </a>
          </div>

          <!-- Main Content Card -->
          <div style="background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            ${content}
          </div>

          <!-- Minimal Footer -->
          <div style="padding: 24px; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              © ${currentYear} KamiKoto Stationeries Pvt. Ltd.
            </p>
            <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
              <a href="${siteUrl}" style="color: #64748b; text-decoration: none;">kamikoto.click</a>
            </p>
          </div>
          
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Generates HTML content for order confirmation emails
 */
const generateOrderConfirmationHTML = (order, user) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const itemsHTML = order.items.map((item) => {
    const processedImageUrl = processImageForEmail(item.image);
    return `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="56" style="vertical-align: top;">
              ${processedImageUrl ? 
                `<img src="${processedImageUrl}" alt="${item.name}" width="56" height="56" style="border-radius: 8px; border: 1px solid #f1f5f9; object-fit: cover;">` :
                `<div style="width: 56px; height: 56px; border-radius: 8px; background: #f8fafc; border: 1px solid #f1f5f9;"></div>`
              }
            </td>
            <td style="padding-left: 16px; vertical-align: top;">
              <p style="margin: 0 0 4px; font-weight: 600; font-size: 14px; color: #0f172a;">${item.name}</p>
              <p style="margin: 0; font-size: 12px; color: #64748b;">Qty: ${item.quantity} × ${formatCurrency(item.price)}</p>
            </td>
            <td align="right" style="vertical-align: top;">
              <p style="margin: 0; font-weight: 600; font-size: 14px; color: #0f172a;">${formatCurrency(item.price * item.quantity)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `}).join('');

  const content = `
    <div style="padding: 40px 32px;" class="mobile-padding">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; padding: 12px; background-color: #f0fdf4; border-radius: 50%; margin-bottom: 16px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em;">Order Confirmed</h1>
        <p style="margin: 8px 0 0; font-size: 14px; color: #64748b;">Thanks for your purchase, ${user.displayName || user.userName || 'Customer'}.</p>
      </div>

      <div style="background-color: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td>
              <p style="margin: 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Order</p>
              <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #0f172a;">#${(order.orderId || order.id || '').slice(-8)}</p>
            </td>
            <td align="right">
              <p style="margin: 0; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Date</p>
              <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #0f172a;">${new Date(order.orderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </td>
          </tr>
        </table>
      </div>

      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        ${itemsHTML}
      </table>

      <div style="margin-top: 24px; background-color: #f8fafc; border-radius: 12px; padding: 20px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #64748b;">Subtotal</td>
            <td align="right" style="padding-bottom: 8px; font-size: 13px; color: #0f172a; font-weight: 600;">${formatCurrency(order.subtotal || 0)}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 8px; font-size: 13px; color: #64748b;">Shipping</td>
            <td align="right" style="padding-bottom: 8px; font-size: 13px; color: #0f172a; font-weight: 600;">${order.shipping?.cost === 0 ? 'Free' : formatCurrency(order.shipping?.cost || 0)}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px; font-size: 13px; color: #64748b;">Tax</td>
            <td align="right" style="padding-bottom: 12px; font-size: 13px; color: #0f172a; font-weight: 600;">${formatCurrency(order.tax || 0)}</td>
          </tr>
          ${order.discount > 0 ? `
          <tr>
            <td style="padding-bottom: 12px; font-size: 13px; color: #16a34a; font-weight: 600;">Discount</td>
            <td align="right" style="padding-bottom: 12px; font-size: 13px; color: #16a34a; font-weight: 600;">-${formatCurrency(order.discount)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 16px; font-weight: 800; color: #0f172a;">Total</td>
            <td align="right" style="padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 16px; font-weight: 800; color: #0f172a;">${formatCurrency(order.totalAmount || 0)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 32px; text-align: center;">
        <a href="https://kamikoto.click/account/orders" class="btn">View Order</a>
      </div>
    </div>
  `;

  return generateBaseEmailTemplate({
    title: generateEmailSubject(order, 'confirmation'),
    previewText: `Your KamiKoto order has been confirmed.`,
    content
  });
};

const getApiFunctionBaseUrl = () => 'https://kamikoto.click/api';

const isEmailEnabled = () => featureConfig.email.enabled;

/**
 * Core email sender with deduplication
 */
export const sendEmail = async (emailData) => {
  if (!isEmailEnabled()) return { success: false, error: 'Email disabled' };

  try {
    const fromEmail = emailData.from || featureConfig.email.fromAddress || 'hello@mailer.kamikoto.click';
    const formattedFrom = `KamiKoto <${fromEmail}>`;
    
    const emailPayload = {
      from: formattedFrom,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.body,
    };
    
    const apiEndpoint = `${getApiFunctionBaseUrl()}/send-email`;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailPayload),
    });
    
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.message || 'Failed to send');
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Resend order confirmation email (admin action) WITH dedup guard
 */
export const resendOrderConfirmationEmail = async (order, user) => {
  if (!user?.email || !order) return { success: false, error: 'Missing data' };

  // DEDUP GUARD: Prevent accidental rapid-fire resends
  const dedupKey = `admin-resend-${order.orderId || order.id}`;
  if (isDuplicateEmail(dedupKey)) {
    console.warn(`⚠️ Admin emailService: BLOCKED duplicate resend for ${dedupKey}`);
    return { success: true, data: { deduplicated: true, message: 'Email already sent recently' } };
  }

  try {
    const emailBody = generateOrderConfirmationHTML(order, user);
    return await sendEmail({
      to: user.email,
      subject: generateEmailSubject(order, 'confirmation'),
      body: emailBody,
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export { generateEmailSubject, isEmailEnabled };

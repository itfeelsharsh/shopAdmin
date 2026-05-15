/**
 * Email Service for Shop Admin
 * 
 * Ported and enhanced from the main Shop application.
 * Provides a consistent, world-class design for all administrative emails.
 */

import featureConfig from './featureConfig';

/**
 * Base Email Template Wrapper
 * Consistent with the main Shop application.
 */
const generateBaseEmailTemplate = ({ title, previewText, content }) => {
  const currentYear = new Date().getFullYear();
  const logoUrl = 'https://kamikoto.qzz.io/kamikoto-logo-transparent-darkish-logo-for-better-visibility.png';
  const siteUrl = 'https://kamikoto.qzz.io';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', sans-serif; }
    .email-container { max-width: 600px; margin: 0 auto; width: 100%; }
    .glass-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-top: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { padding: 40px 0; text-align: center; }
    .footer { padding: 40px 20px; text-align: center; color: #64748b; font-size: 13px; line-height: 1.6; }
    .btn { display: inline-block; background-color: #0f172a; color: #ffffff !important; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; text-align: center; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${previewText}</div>
  <table width="100%" border="0" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <div class="email-container">
          <div class="header">
            <a href="${siteUrl}" style="text-decoration: none;">
              <img src="${logoUrl}" alt="KamiKoto" width="160">
            </a>
          </div>
          <div class="glass-card">${content}</div>
          <div class="footer">
            <p style="margin-bottom: 20px; font-weight: 600; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">KamiKoto Stationeries Pvt. Ltd.</p>
            <p style="margin-bottom: 8px;">North Sentinel Island, Andaman and Nicobar Islands, India</p>
            <p style="margin-bottom: 24px;">support@kamikoto.qzz.io • +91 1800 6969 6969</p>
            <p style="font-size: 12px; color: #94a3b8;">© ${currentYear} KamiKoto Stationeries Pvt. Ltd. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Generates HTML for order confirmation
 */
const generateOrderConfirmationHTML = (order, user) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const itemsHTML = order.items.map(item => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
        <p style="margin: 0; font-weight: 600; font-size: 14px; color: #0f172a;">${item.name}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Qty: ${item.quantity} • ${formatCurrency(item.price)}</p>
      </td>
      <td align="right" style="vertical-align: top; padding-top: 16px;">
        <p style="margin: 0; font-weight: 600; font-size: 14px; color: #0f172a;">${formatCurrency(item.price * item.quantity)}</p>
      </td>
    </tr>
  `).join('');

  const content = `
    <div style="padding: 40px 32px;">
      <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #0f172a;">Order Confirmed</h1>
      <p style="margin: 0 0 32px; font-size: 16px; color: #64748b;">Hello ${user.displayName || user.userName || 'Customer'}, your order #${order.orderId} has been confirmed.</p>
      
      <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
        <table width="100%">
          <tr>
            <td>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase;">Order Number</p>
              <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #0f172a;">#${order.orderId}</p>
            </td>
          </tr>
        </table>
      </div>

      <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #0f172a;">Order Details</h2>
      <table width="100%" border="0" cellpadding="0" cellspacing="0">
        ${itemsHTML}
      </table>
      
      <div style="margin-top: 24px; text-align: right;">
        <p style="font-size: 18px; font-weight: 700; color: #0f172a;">Total: ${formatCurrency(order.totalAmount || order.total || 0)}</p>
      </div>

      <div style="margin-top: 40px; text-align: center;">
        <a href="https://kamikoto.qzz.io/account/orders" class="btn">View Order Details</a>
      </div>
    </div>`;

  return generateBaseEmailTemplate({
    title: `Order Confirmation #${order.orderId}`,
    previewText: `Your order #${order.orderId} from KamiKoto has been confirmed.`,
    content
  });
};

/**
 * Get the base URL for the API functions
 */
const getApiFunctionBaseUrl = () => 'https://kamikoto.qzz.io/api';

/**
 * Checks if the email functionality is enabled
 */
const isEmailEnabled = () => featureConfig.email.enabled;

/**
 * Sends an email using the server API endpoint
 */
export const sendEmail = async (emailData) => {
  if (!isEmailEnabled()) return { success: false, error: 'Email disabled' };

  try {
    const fromEmail = emailData.from || featureConfig.email.fromAddress;
    const formattedFrom = `KamiKoto Stationeries <${fromEmail}>`;
    
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
 * Resends order confirmation email
 */
export const resendOrderConfirmationEmail = async (order, user) => {
  try {
    const emailBody = generateOrderConfirmationHTML(order, user);
    return await sendEmail({
      to: user.email,
      subject: `Order Confirmation: #${order.orderId} - KamiKoto`,
      body: emailBody,
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
};


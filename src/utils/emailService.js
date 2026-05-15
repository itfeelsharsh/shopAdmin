/**
 * Email Service for Shop Admin
 * 
 * Ported from the main Shop application.
 * Allows resending order confirmation and status emails.
 */

import featureConfig from './featureConfig';

/**
 * Get the base URL for the API functions
 */
const getApiFunctionBaseUrl = () => {
  // Always use the production Cloudflare Functions domain.
  // The local React development server (npm run start) on port 3000 
  // does not execute Cloudflare functions natively without `wrangler pages dev`.
  return 'https://kamikoto.qzz.io/api';
};

/**
 * Checks if the email functionality is enabled
 */
const isEmailEnabled = () => {
  return featureConfig.email.enabled;
};

/**
 * Sends an email using the server API endpoint
 */
export const sendEmail = async (emailData) => {
  if (!isEmailEnabled()) {
    return { success: false, error: 'Email functionality is disabled' };
  }

  try {
    const fromEmail = emailData.from || featureConfig.email.fromAddress;
    const formattedFrom = fromEmail.includes('<') ? fromEmail : `KamiKoto <${fromEmail}>`;
    
    const emailPayload = {
      from: formattedFrom,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.body,
    };
    
    const apiEndpoint = `${getApiFunctionBaseUrl()}/send-email`;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });
    
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error?.message || 'Failed to send email');
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
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
      <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
        <p style="margin: 0; font-weight: 600;">${item.name}</p>
        <p style="margin: 0; color: #666; font-size: 14px;">Qty: ${item.quantity}</p>
      </td>
      <td style="text-align: right; border-bottom: 1px solid #eee;">${formatCurrency(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  return \`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Order Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px;">
    <h1 style="color: #111827; margin-top: 0;">Order Confirmed</h1>
    <p style="color: #4b5563;">Hello \${user.displayName || user.userName || 'Customer'},</p>
    <p style="color: #4b5563;">Your order <strong>#\${order.orderId}</strong> has been confirmed and is processing.</p>
    
    <h3 style="color: #111827; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Order Details</h3>
    <table width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
      \${itemsHTML}
    </table>
    
    <div style="text-align: right; margin-top: 20px;">
      <p style="font-size: 18px; color: #111827;"><strong>Total: \${formatCurrency(order.totalAmount || order.total || 0)}</strong></p>
    </div>
  </div>
</body>
</html>\`;
};

/**
 * Resends order confirmation email
 */
export const resendOrderConfirmationEmail = async (order, user) => {
  try {
    const emailBody = generateOrderConfirmationHTML(order, user);
    const emailData = {
      to: user.email,
      subject: `KamiKoto - Order Confirmation #${order.orderId}`,
      body: emailBody,
    };
    return await sendEmail(emailData);
  } catch (error) {
    console.error('Error resending order confirmation:', error);
    return { success: false, error: error.message };
  }
};

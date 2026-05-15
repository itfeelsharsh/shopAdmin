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
 * Generates HTML for order confirmation (Simplified for now, can be expanded)
 */
const generateOrderConfirmationHTML = (order, user) => {
  // This should ideally be the same template as in the main shop
  // For brevity, I'm using a placeholder but in a real scenario, 
  // you'd copy the full generateOrderConfirmationHTML function from shop's emailService.js
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
      <h1 style="color: #111;">Order Confirmed</h1>
      <p>Hello ${user.displayName || user.userName || 'Customer'},</p>
      <p>Your order <strong>#${order.orderId}</strong> has been confirmed.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <h3>Order Details</h3>
      <table width="100%">
        ${order.items.map(item => `
          <tr>
            <td style="padding: 10px 0;">${item.name} x ${item.quantity}</td>
            <td style="text-align: right;">₹${item.price * item.quantity}</td>
          </tr>
        `).join('')}
      </table>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <div style="text-align: right;">
        <p><strong>Total: ₹${order.totalAmount || order.total || 0}</strong></p>
      </div>
    </div>
  `;
};

/**
 * Resends order confirmation email
 */
export const resendOrderConfirmationEmail = async (order, user) => {
  try {
    const emailBody = generateOrderConfirmationHTML(order, user);
    const emailData = {
      to: user.email,
      subject: `Resending: KamiKoto Order Confirmation #${order.orderId}`,
      body: emailBody,
    };
    return await sendEmail(emailData);
  } catch (error) {
    console.error('Error resending order confirmation:', error);
    return { success: false, error: error.message };
  }
};

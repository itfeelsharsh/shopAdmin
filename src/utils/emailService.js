import featureConfig from './featureConfig';

const processImageForEmail = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.includes('i.imgur.com')) {
    if (!imageUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return `${imageUrl}.jpg`;
    }
  }
  return imageUrl;
};

const generateBaseEmailTemplate = ({ title, previewText, content }) => {
  const currentYear = new Date().getFullYear();
  const logoUrl = 'https://cdn.kamikoto.click/logo.png';
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #020617; font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }

    .email-container { max-width: 640px !important; margin: 0 auto !important; width: 100% !important; background-color: #020617; }
    
    .glass-card { 
      background: #ffffff; 
      border-radius: 24px; 
      overflow: hidden; 
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); 
      margin-bottom: 24px;
    }
    
    .header-nav {
      background-color: #0f172a;
      padding: 24px 40px;
      text-align: center;
      border-bottom: 1px solid #1e293b;
    }
    
    .nav-links {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    
    .nav-link {
      color: #94a3b8 !important;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 12px;
      display: inline-block;
    }

    .footer { 
      padding: 48px 40px; 
      text-align: center; 
      color: #64748b; 
      font-size: 13px; 
      line-height: 1.6; 
      background-color: #0f172a;
      border-radius: 24px;
      margin-bottom: 40px;
    }
    
    .footer a { color: #38bdf8; text-decoration: none; font-weight: 500; }
    .social-links { margin: 24px 0; }
    .social-links a { display: inline-block; margin: 0 8px; color: #94a3b8; text-decoration: none; }
    
    .btn { 
      display: inline-block; 
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff !important; 
      font-size: 15px; 
      font-weight: 600; 
      text-decoration: none; 
      padding: 16px 36px; 
      border-radius: 12px; 
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; padding: 12px !important; }
      .glass-card { border-radius: 16px !important; }
      .mobile-padding { padding: 24px !important; }
      .nav-link { margin: 0 8px; font-size: 11px; }
      .header-nav { padding: 24px 20px; }
    }
  </style>
</head>
<body>
  <!-- Hidden Preview Text -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${previewText}
  </div>

  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #020617; padding: 20px 0;">
    <tr>
      <td align="center">
        <div class="email-container">
          
          <!-- World Class Navbar & Header -->
          <div class="glass-card" style="border-radius: 24px 24px 0 0; margin-bottom: 0;">
            <div class="header-nav">
              <a href="${siteUrl}" target="_blank" style="display: inline-block;">
                <img src="${logoUrl}" alt="KamiKoto" width="80" height="80" style="display: block; margin: 0 auto; width: 80px; height: 80px; border-radius: 16px; object-fit: contain;">
              </a>
              
              <div class="nav-links">
                <a href="${siteUrl}/collections/new" class="nav-link">New Arrivals</a>
                <a href="${siteUrl}/collections/stationery" class="nav-link">Stationery</a>
                <a href="${siteUrl}/account/orders" class="nav-link">My Orders</a>
              </div>
            </div>
          </div>

          <!-- Main Content Card -->
          <div class="glass-card" style="border-radius: 0 0 24px 24px; border-top: none;">
            ${content}
          </div>

          <!-- World Class Footer -->
          <div class="footer">
            <a href="${siteUrl}" target="_blank" style="display: inline-block; margin-bottom: 24px;">
              <img src="${logoUrl}" alt="KamiKoto" width="48" height="48" style="display: block; width: 48px; height: 48px; border-radius: 12px; opacity: 0.8; filter: grayscale(100%);">
            </a>
            
            <p style="margin-bottom: 8px; font-weight: 700; color: #f8fafc; font-size: 15px; letter-spacing: 1px; text-transform: uppercase;">
              KamiKoto Stationeries Pvt. Ltd.
            </p>
            <p style="margin-bottom: 16px; color: #94a3b8;">
              North Sentinel Island, Andaman and Nicobar Islands, India
            </p>
            
            <div style="background-color: #1e293b; padding: 16px; border-radius: 12px; margin-bottom: 24px; display: inline-block;">
              <p style="margin: 0;">
                <span style="color: #cbd5e1;">Support:</span> <a href="mailto:support@kamikoto.click">support@kamikoto.click</a>
                <span style="margin: 0 12px; color: #475569;">|</span>
                <span style="color: #cbd5e1;">Call:</span> <a href="tel:+91180069696969">+91 1800 6969 6969</a>
              </p>
            </div>
            
            <div style="height: 1px; background-color: #1e293b; margin: 0 0 24px 0;"></div>
            
            <div class="social-links">
              <a href="${siteUrl}">Instagram</a> • 
              <a href="${siteUrl}">Twitter</a> • 
              <a href="${siteUrl}">Facebook</a>
            </div>
            
            <p style="margin-bottom: 12px; font-size: 12px; color: #64748b;">
              This is a transactional email regarding your account activity at <a href="${siteUrl}">kamikoto.click</a>.
            </p>
            
            <p style="margin-bottom: 16px; font-size: 11px; color: #475569;">
              To ensure delivery to your inbox, add <strong>hello@mailer.kamikoto.click</strong> to your address book.
            </p>
            
            <p style="margin-bottom: 0; font-size: 12px; color: #475569; font-weight: 500;">
              © ${currentYear} KamiKoto Stationeries Pvt. Ltd. All rights reserved.
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
      <td style="padding: 20px 0; border-bottom: 1px solid #f1f5f9;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="72" style="vertical-align: top;">
              ${processedImageUrl ? 
                `<img src="${processedImageUrl}" alt="${item.name}" width="72" height="72" style="border-radius: 12px; border: 1px solid #f1f5f9; object-fit: cover;">` :
                `<div style="width: 72px; height: 72px; border-radius: 12px; background: #f8fafc; border: 1px solid #f1f5f9;"></div>`
              }
            </td>
            <td style="padding-left: 20px; vertical-align: top;">
              <p style="margin: 0 0 4px; font-weight: 600; font-size: 15px; color: #0f172a;">${item.name}</p>
              <p style="margin: 0; font-size: 13px; color: #64748b;">Qty: ${item.quantity} × ${formatCurrency(item.price)}</p>
            </td>
            <td align="right" style="vertical-align: top;">
              <p style="margin: 0; font-weight: 600; font-size: 15px; color: #0f172a;">${formatCurrency(item.price * item.quantity)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `}).join('');

  const content = `
    <div style="padding: 48px 40px;" class="mobile-padding">
      <div style="text-align: center; margin-bottom: 40px;">
        <div style="display: inline-block; padding: 16px; background-color: #f0fdf4; border-radius: 50%; margin-bottom: 20px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em;">Order Confirmed!</h1>
        <p style="margin: 12px 0 0; font-size: 16px; color: #64748b;">Thank you for your purchase, ${user.displayName || user.userName || 'Customer'}.</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 16px; padding: 24px; margin-bottom: 40px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td>
              <p style="margin: 0; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Order Number</p>
              <p style="margin: 6px 0 0; font-size: 18px; font-weight: 700; color: #0f172a;">#${order.orderId}</p>
            </td>
            <td align="right">
              <p style="margin: 0; font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Order Date</p>
              <p style="margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #0f172a;">${new Date(order.orderDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </td>
          </tr>
        </table>
      </div>

      <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 700; color: #0f172a;">Order Summary</h2>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        ${itemsHTML}
      </table>

      <div style="margin-top: 32px; background-color: #f8fafc; border-radius: 16px; padding: 24px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="padding-bottom: 12px; font-size: 14px; color: #64748b; font-weight: 500;">Subtotal</td>
            <td align="right" style="padding-bottom: 12px; font-size: 14px; color: #0f172a; font-weight: 600;">${formatCurrency(order.subtotal || 0)}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px; font-size: 14px; color: #64748b; font-weight: 500;">Shipping</td>
            <td align="right" style="padding-bottom: 12px; font-size: 14px; color: #0f172a; font-weight: 600;">${order.shipping?.cost === 0 ? 'Free' : formatCurrency(order.shipping?.cost || 0)}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 16px; font-size: 14px; color: #64748b; font-weight: 500;">Tax (GST)</td>
            <td align="right" style="padding-bottom: 16px; font-size: 14px; color: #0f172a; font-weight: 600;">${formatCurrency(order.tax || 0)}</td>
          </tr>
          ${order.discount > 0 ? `
          <tr>
            <td style="padding-bottom: 16px; font-size: 14px; color: #16a34a; font-weight: 600;">Discount</td>
            <td align="right" style="padding-bottom: 16px; font-size: 14px; color: #16a34a; font-weight: 600;">-${formatCurrency(order.discount)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 20px; font-weight: 800; color: #0f172a;">Total</td>
            <td align="right" style="padding-top: 20px; border-top: 2px solid #e2e8f0; font-size: 20px; font-weight: 800; color: #0f172a;">${formatCurrency(order.totalAmount || 0)}</td>
          </tr>
        </table>
      </div>

      <div style="margin-top: 40px; text-align: center;">
        <a href="https://kamikoto.click/account/orders" class="btn">View Order Status</a>
      </div>

      <div style="margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 40px;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="50%" style="vertical-align: top; padding-right: 20px;" class="mobile-stack">
              <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Shipping Address</h3>
              <p style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 500; line-height: 1.6;">
                ${order.shippingAddress?.name || user.displayName || 'Customer'}<br>
                <span style="color: #64748b; font-weight: 400;">
                  ${order.shippingAddress?.street || ''}<br>
                  ${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.zip || ''}<br>
                  ${order.shippingAddress?.country || ''}
                </span>
              </p>
            </td>
            <td width="50%" style="vertical-align: top; padding-top: 0;" class="mobile-stack">
              <h3 style="margin: 0 0 16px; font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Payment Info</h3>
              <p style="margin: 0; font-size: 15px; color: #0f172a; font-weight: 500; line-height: 1.6;">
                Method: <span style="color: #64748b; font-weight: 400;">${order.payment?.method || 'Credit/Debit Card'}</span><br>
                Status: <span style="color: #16a34a; font-weight: 700;">Paid</span>
              </p>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;

  return generateBaseEmailTemplate({
    title: `Order Confirmation #${order.orderId}`,
    previewText: `Your order #${order.orderId} from KamiKoto has been confirmed and is being processed.`,
    content
  });
};

const getApiFunctionBaseUrl = () => 'https://kamikoto.click/api';

const isEmailEnabled = () => featureConfig.email.enabled;

export const sendEmail = async (emailData) => {
  if (!isEmailEnabled()) return { success: false, error: 'Email disabled' };

  try {
    const fromEmail = emailData.from || featureConfig.email.fromAddress || 'hello@mailer.kamikoto.click';
    const formattedFrom = \`KamiKoto Stationeries <\${fromEmail}>\`;
    
    const emailPayload = {
      from: formattedFrom,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.body,
    };
    
    const apiEndpoint = \`\${getApiFunctionBaseUrl()}/send-email\`;
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

export const resendOrderConfirmationEmail = async (order, user) => {
  try {
    const emailBody = generateOrderConfirmationHTML(order, user);
    return await sendEmail({
      to: user.email,
      subject: \`Order Confirmation: #\${order.orderId} - KamiKoto\`,
      body: emailBody,
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
};

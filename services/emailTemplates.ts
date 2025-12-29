// Email Template Generator for FlusApp
// Creates professional, branded HTML emails that match the app's design

export interface EmailTemplateOptions {
    title: string;
    preheader?: string;
    heading: string;
    message: string;
    emoji?: string;
    actionButton?: {
        text: string;
        url: string;
    };
    footerText?: string;
}

export function generateEmailTemplate(options: EmailTemplateOptions): string {
    const {
        title,
        preheader = 'FlusApp Notification',
        heading,
        message,
        emoji = '💳',
        actionButton,
        footerText = 'Manage your finances with confidence.'
    } = options;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse: collapse;}
  </style>
  <![endif]-->
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f3f4f6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-spacing: 0;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
      display: block;
    }
    .wrapper {
      width: 100%;
      background-color: #f3f4f6;
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      padding: 32px 40px;
      text-align: center;
    }
    .header-logo {
      color: #ffffff;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .header-tagline {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 8px 0 0 0;
      font-weight: 500;
    }
    .content {
      padding: 40px;
    }
    .emoji-icon {
      font-size: 56px;
      text-align: center;
      margin-bottom: 24px;
      line-height: 1;
    }
    .heading {
      font-size: 28px;
      font-weight: 700;
      color: #111827;
      text-align: center;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      line-height: 1.6;
      margin: 0 0 32px 0;
      text-align: center;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      transition: transform 0.2s;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    }
    .divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
      margin: 32px 0;
    }
    .footer {
      padding: 24px 40px;
      background-color: #f9fafb;
      text-align: center;
    }
    .footer-text {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 12px 0;
    }
    .footer-links {
      font-size: 12px;
      color: #9ca3af;
    }
    .footer-links a {
      color: #3b82f6;
      text-decoration: none;
      margin: 0 8px;
    }
    @media only screen and (max-width: 600px) {
      .container {
        border-radius: 0;
      }
      .header {
        padding: 24px 20px;
      }
      .content {
        padding: 32px 20px;
      }
      .heading {
        font-size: 24px;
      }
      .message {
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <!-- Preheader text (hidden but shows in previews) -->
  <div style="display:none;font-size:1px;color:#f3f4f6;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader}
  </div>
  
  <table class="wrapper" role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table class="container" role="presentation" cellpadding="0" cellspacing="0" width="600">
          <!-- Header -->
          <tr>
            <td class="header">
              <h1 class="header-logo">FlusApp</h1>
              <p class="header-tagline">Gestión Financiera Inteligente</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content">
              <div class="emoji-icon">${emoji}</div>
              <h2 class="heading">${heading}</h2>
              <p class="message">${message}</p>
              
              ${actionButton ? `
              <div class="button-container">
                <a href="${actionButton.url}" class="button">${actionButton.text}</a>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer">
              <p class="footer-text">${footerText}</p>
              <div class="divider"></div>
              <p class="footer-links">
                <a href="#">Preferencias</a> · 
                <a href="#">Soporte</a> · 
                <a href="#">Desuscribirse</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

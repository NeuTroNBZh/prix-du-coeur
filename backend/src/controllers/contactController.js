/**
 * Contact Controller
 * Handles contact form submissions
 */

const nodemailer = require('nodemailer');

// Email configuration (uses same config as auth emails)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'ssl0.ovh.net',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'contact@prixducoeur.fr',
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Handle contact form submission
 */
const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }

    // Subject mapping for readability
    const subjectLabels = {
      'question': 'Question générale',
      'bug': 'Signalement de bug',
      'feature': 'Suggestion de fonctionnalité',
      'account': 'Problème de compte',
      'bank': 'Question connexion bancaire',
      'data': 'Demande RGPD',
      'other': 'Autre'
    };

    const subjectLabel = subjectLabels[subject] || subject;

    // Create email content
    const emailContent = `
Nouveau message de contact Prix du Cœur

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 De: ${name} <${email}>
📌 Sujet: ${subjectLabel}
📅 Date: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MESSAGE:

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Répondre directement à cet email pour contacter l'utilisateur.
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #00b4d8, #e91e8c); padding: 20px; border-radius: 10px 10px 0 0; color: white; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
    .info { background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .info-label { font-weight: bold; width: 80px; }
    .message-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #00b4d8; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">💬 Nouveau message de contact</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Prix du Cœur</p>
    </div>
    <div class="content">
      <div class="info">
        <div class="info-row">
          <span class="info-label">📧 De:</span>
          <span>${name} &lt;${email}&gt;</span>
        </div>
        <div class="info-row">
          <span class="info-label">📌 Sujet:</span>
          <span>${subjectLabel}</span>
        </div>
        <div class="info-row">
          <span class="info-label">📅 Date:</span>
          <span>${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</span>
        </div>
      </div>
      
      <h3 style="margin-bottom: 10px;">Message:</h3>
      <div class="message-box">
        ${message.replace(/\n/g, '<br>')}
      </div>
      
      <p class="footer">
        Répondez directement à cet email pour contacter l'utilisateur.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: `"Prix du Cœur Contact" <${process.env.SMTP_USER || 'contact@prixducoeur.fr'}>`,
      to: 'contact@prixducoeur.fr',
      replyTo: email,
      subject: `[Contact] ${subjectLabel} - ${name}`,
      text: emailContent,
      html: htmlContent
    });

    console.log(`✉️ Contact form submitted from ${email} - Subject: ${subjectLabel}`);

    res.json({ success: true, message: 'Message envoyé avec succès' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message. Veuillez réessayer.' });
  }
};

module.exports = {
  submitContact
};

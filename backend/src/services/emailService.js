const nodemailer = require('nodemailer');

// Configuration du transporteur email
const createTransporter = () => {
  // En développement, on peut utiliser un service comme Mailtrap ou un compte Gmail
  // En production, utilisez un vrai service SMTP
  
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour autres ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Fallback: mode test qui log les emails dans la console
  console.log('⚠️ SMTP non configuré - les emails seront affichés dans la console');
  return null;
};

const transporter = createTransporter();

/**
 * Envoie un email de réinitialisation de mot de passe
 */
const sendPasswordResetEmail = async (email, resetToken, firstName) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'https://prix-du-coeur.neutronbzh.fr'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"Prix du coeur" <${process.env.SMTP_FROM || 'noreply@prix-du-coeur.fr'}>`,
    to: email,
    subject: '💖 Réinitialisation de votre mot de passe - Prix du coeur',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .content p { color: #374151; line-height: 1.6; margin: 0 0 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .button:hover { opacity: 0.9; }
          .footer { background: #f3f4f6; padding: 20px 30px; text-align: center; }
          .footer p { color: #6b7280; font-size: 12px; margin: 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .warning p { color: #92400e; margin: 0; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💖 Prix du coeur</h1>
          </div>
          <div class="content">
            <p>Bonjour${firstName ? ` ${firstName}` : ''} !</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
            
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
            </p>
            
            <div class="warning">
              <p>⚠️ Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
              <a href="${resetUrl}" style="color: #ec4899; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé par Prix du coeur.<br>Gérez vos finances de couple en toute simplicité.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Bonjour${firstName ? ` ${firstName}` : ''} !

Vous avez demandé à réinitialiser votre mot de passe sur Prix du coeur.

Cliquez sur ce lien pour réinitialiser votre mot de passe :
${resetUrl}

Ce lien expire dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

---
Prix du coeur - Gérez vos finances de couple en toute simplicité
    `
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email de réinitialisation envoyé à:', email);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  } else {
    // Mode développement - log l'email dans la console
    console.log('\n========== EMAIL DE RÉINITIALISATION ==========');
    console.log('À:', email);
    console.log('Lien:', resetUrl);
    console.log('===============================================\n');
    return { success: true, messageId: 'console-dev' };
  }
};

/**
 * Vérifie si le service email est configuré
 */
const isEmailConfigured = () => {
  return !!transporter;
};

/**
 * Envoie un email d'invitation de couple
 */
const sendCoupleInvitationEmail = async (inviteeEmail, inviteeFirstName, inviterName) => {
  const loginUrl = `${process.env.FRONTEND_URL || 'https://prix.music-universe.fr'}/couple`;
  
  const mailOptions = {
    from: `"Prix du coeur" <${process.env.SMTP_FROM || 'noreply@prix-du-coeur.fr'}>`,
    to: inviteeEmail,
    subject: `💕 ${inviterName} vous invite sur Prix du coeur !`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .content p { color: #374151; line-height: 1.6; margin: 0 0 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .highlight { background: linear-gradient(135deg, #fdf2f8 0%, #faf5ff 100%); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
          .highlight .emoji { font-size: 48px; margin-bottom: 10px; }
          .footer { background: #f3f4f6; padding: 20px 30px; text-align: center; }
          .footer p { color: #6b7280; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💖 Prix du coeur</h1>
          </div>
          <div class="content">
            <p>Bonjour${inviteeFirstName ? ` ${inviteeFirstName}` : ''} !</p>
            
            <div class="highlight">
              <div class="emoji">💕</div>
              <p style="font-size: 18px; color: #831843; margin: 0;">
                <strong>${inviterName}</strong> vous invite à gérer vos finances de couple ensemble !
              </p>
            </div>
            
            <p>Avec Prix du coeur, vous pourrez :</p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>📊 Suivre vos dépenses communes</li>
              <li>⚖️ Harmoniser automatiquement vos contributions</li>
              <li>📅 Gérer vos abonnements partagés</li>
              <li>📈 Visualiser l'évolution de vos finances</li>
            </ul>
            
            <p style="text-align: center;">
              <a href="${loginUrl}" class="button">Accepter l'invitation</a>
            </p>
            
            <p style="font-size: 14px; color: #6b7280;">
              Connectez-vous à votre compte pour accepter l'invitation de ${inviterName}.
            </p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé par Prix du coeur.<br>Gérez vos finances de couple en toute simplicité.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Bonjour${inviteeFirstName ? ` ${inviteeFirstName}` : ''} !

${inviterName} vous invite à gérer vos finances de couple ensemble sur Prix du coeur !

Avec Prix du coeur, vous pourrez :
- Suivre vos dépenses communes
- Harmoniser automatiquement vos contributions
- Gérer vos abonnements partagés
- Visualiser l'évolution de vos finances

Connectez-vous pour accepter l'invitation : ${loginUrl}

---
Prix du coeur - Gérez vos finances de couple en toute simplicité
    `
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email d\'invitation envoyé à:', inviteeEmail);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email invitation:', error);
      throw error;
    }
  } else {
    // Mode développement - log l'email dans la console
    console.log('\n========== EMAIL D\'INVITATION COUPLE ==========');
    console.log('À:', inviteeEmail);
    console.log('De la part de:', inviterName);
    console.log('Lien:', loginUrl);
    console.log('================================================\n');
    return { success: true, messageId: 'console-dev' };
  }
};

/**
 * Envoie un email d'invitation à créer un compte et rejoindre un couple
 */
const sendCreateAccountInvitationEmail = async (inviteeEmail, inviterName) => {
  const registerUrl = `${process.env.FRONTEND_URL || 'https://prix.music-universe.fr'}/register?invite_email=${encodeURIComponent(inviteeEmail)}`;
  
  const mailOptions = {
    from: `"Prix du coeur" <${process.env.SMTP_FROM || 'noreply@prix-du-coeur.fr'}>`,
    to: inviteeEmail,
    subject: `💕 ${inviterName} vous invite à rejoindre Prix du coeur !`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); padding: 30px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { padding: 40px 30px; }
          .content p { color: #374151; line-height: 1.6; margin: 0 0 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .highlight { background: linear-gradient(135deg, #fdf2f8 0%, #faf5ff 100%); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
          .highlight .emoji { font-size: 48px; margin-bottom: 10px; }
          .footer { background: #f3f4f6; padding: 20px 30px; text-align: center; }
          .footer p { color: #6b7280; font-size: 12px; margin: 0; }
          .step { display: flex; align-items: center; margin: 15px 0; }
          .step-number { background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
          .step-text { color: #374151; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💖 Prix du coeur</h1>
          </div>
          <div class="content">
            <p>Bonjour !</p>
            
            <div class="highlight">
              <div class="emoji">💕</div>
              <p style="font-size: 18px; color: #831843; margin: 0;">
                <strong>${inviterName}</strong> vous invite à gérer vos finances de couple ensemble !
              </p>
            </div>
            
            <p><strong>Prix du coeur</strong> est une application qui vous permet de :</p>
            <ul style="color: #374151; line-height: 1.8;">
              <li>📊 Suivre vos dépenses communes</li>
              <li>⚖️ Harmoniser automatiquement vos contributions</li>
              <li>📅 Gérer vos abonnements partagés</li>
              <li>📈 Visualiser l'évolution de vos finances</li>
            </ul>
            
            <p><strong>Comment rejoindre ${inviterName} ?</strong></p>
            
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-text">Cliquez sur le bouton ci-dessous pour créer votre compte</div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-text">Allez dans "Mon Couple" pour accepter l'invitation</div>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-text">Commencez à suivre vos finances ensemble ! 🎉</div>
            </div>
            
            <p style="text-align: center;">
              <a href="${registerUrl}" class="button">Créer mon compte</a>
            </p>
            
            <p style="font-size: 14px; color: #6b7280;">
              C'est gratuit et ne prend que 30 secondes !
            </p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé par Prix du coeur à la demande de ${inviterName}.<br>
            Si vous ne connaissez pas cette personne, ignorez cet email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Bonjour !

${inviterName} vous invite à gérer vos finances de couple ensemble sur Prix du coeur !

Prix du coeur est une application gratuite qui vous permet de :
- Suivre vos dépenses communes
- Harmoniser automatiquement vos contributions
- Gérer vos abonnements partagés
- Visualiser l'évolution de vos finances

Comment rejoindre ${inviterName} ?
1. Créez votre compte : ${registerUrl}
2. Allez dans "Mon Couple" pour accepter l'invitation
3. Commencez à suivre vos finances ensemble !

---
Prix du coeur - Gérez vos finances de couple en toute simplicité

Si vous ne connaissez pas ${inviterName}, ignorez cet email.
    `
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email d\'invitation à créer un compte envoyé à:', inviteeEmail);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email invitation compte:', error);
      throw error;
    }
  } else {
    // Mode développement - log l'email dans la console
    console.log('\n========== EMAIL INVITATION CRÉER COMPTE ==========');
    console.log('À:', inviteeEmail);
    console.log('De la part de:', inviterName);
    console.log('Lien inscription:', registerUrl);
    console.log('====================================================\n');
    return { success: true, messageId: 'console-dev' };
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendCoupleInvitationEmail,
  sendCreateAccountInvitationEmail,
  isEmailConfigured,
};

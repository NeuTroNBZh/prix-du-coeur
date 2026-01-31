const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { validateRegister, validateLogin, isValidId } = require('../utils/validation');

// Store temporaire pour les tokens 2FA en attente (en production, utiliser Redis)
// Map: pendingToken -> { userId, email, expiresAt }
const pending2FATokens = new Map();

// Nettoyer les tokens expirés toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pending2FATokens.entries()) {
    if (data.expiresAt < now) {
      pending2FATokens.delete(token);
    }
  }
}, 5 * 60 * 1000);
const { sendPasswordResetEmail, sendVerificationEmail, send2FACodeEmail } = require('../services/emailService');
const { deleteOldAvatar, getPublicAvatarUrl } = require('../services/uploadService');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Génère un code 2FA à 6 chiffres
const generate2FACode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, location } = req.body;
    const errors = validateRegister(email, password, firstName, lastName);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', errors });

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists', message: 'Email is already registered' });
    }

    // Get IP address from request
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, totp_enabled, country, city, region, latitude, longitude, timezone, ip_address, email_verified, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id, email, first_name, last_name, created_at`,
      [
        email.toLowerCase(), 
        passwordHash, 
        firstName, 
        lastName, 
        false,
        location?.country || null,
        location?.city || null,
        location?.region || null,
        location?.latitude || null,
        location?.longitude || null,
        location?.timezone || null,
        ipAddress,
        false, // email_verified
        verificationToken,
        verificationExpires
      ]
    );

    const user = result.rows[0];
    
    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, firstName);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Delete the user if email sending failed completely
      await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
      return res.status(500).json({ 
        error: 'Email error', 
        message: 'Impossible d\'envoyer l\'email de vérification. Veuillez réessayer.' 
      });
    }

    // Check for pending couple invitations and convert them to real invitations
    try {
      const pendingInvites = await pool.query(
        `SELECT inviter_id FROM pending_couple_invitations WHERE invitee_email = $1 AND status = 'pending'`,
        [email.toLowerCase()]
      );

      for (const invite of pendingInvites.rows) {
        // Create real couple invitation
        await pool.query(
          `INSERT INTO couple_invitations (inviter_id, invitee_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT DO NOTHING`,
          [invite.inviter_id, user.id]
        );
        
        // Mark pending invitation as processed
        await pool.query(
          `UPDATE pending_couple_invitations SET status = 'processed' WHERE inviter_id = $1 AND invitee_email = $2`,
          [invite.inviter_id, email.toLowerCase()]
        );
      }

      if (pendingInvites.rows.length > 0) {
        console.log(`✅ Converted ${pendingInvites.rows.length} pending couple invitation(s) for ${email}`);
      }
    } catch (inviteError) {
      console.error('Error processing pending invitations:', inviteError);
      // Continue anyway - user registration should not fail
    }

    // Ne PAS donner de token JWT - l'utilisateur doit d'abord vérifier son email
    res.status(201).json({
      message: 'Compte créé ! Vérifiez votre boîte mail pour activer votre compte.',
      requiresEmailVerification: true,
      email: user.email
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed', message: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const errors = validateLogin(email, password);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', errors });

    const result = await pool.query(
      `SELECT id, email, password_hash, first_name, last_name, totp_enabled, totp_secret, two_fa_method, email_verified FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid email or password' });
    }

    // Bloquer si l'email n'est pas vérifié
    if (!user.email_verified) {
      return res.status(403).json({ 
        error: 'Email not verified', 
        message: 'Veuillez vérifier votre email avant de vous connecter. Vérifiez aussi vos spams !',
        requiresEmailVerification: true,
        email: user.email
      });
    }

    // Check if 2FA is enabled (either TOTP or Email)
    const twoFaMethod = user.two_fa_method || (user.totp_enabled ? 'totp' : 'none');
    
    if (twoFaMethod === 'totp' && user.totp_enabled) {
      // TOTP 2FA - existing flow
      const pendingToken = crypto.randomBytes(32).toString('hex');
      pending2FATokens.set(pendingToken, {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        method: 'totp',
        expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
      });
      return res.status(200).json({ message: '2FA verification required', requires2FA: true, method: 'totp', pendingToken });
    }
    
    if (twoFaMethod === 'email') {
      // Email 2FA - send code by email
      const code = generate2FACode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store code in database
      await pool.query(
        'UPDATE users SET email_2fa_code = $1, email_2fa_expires = $2 WHERE id = $3',
        [code, expiresAt, user.id]
      );
      
      // Send code by email
      try {
        await send2FACodeEmail(user.email, code, user.first_name);
      } catch (emailError) {
        console.error('Failed to send 2FA email:', emailError);
        return res.status(500).json({ error: 'Email error', message: 'Failed to send verification code' });
      }
      
      const pendingToken = crypto.randomBytes(32).toString('hex');
      pending2FATokens.set(pendingToken, {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        method: 'email',
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });
      return res.status(200).json({ message: '2FA verification required', requires2FA: true, method: 'email', pendingToken });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, totp_enabled: user.totp_enabled, emailVerified: user.email_verified }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed', message: 'Internal server error' });
  }
};

const setup2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const secret = speakeasy.generateSecret({ name: `Prix du coeur (${req.user.email})`, length: 32 });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    await pool.query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret.base32, userId]);
    res.status(200).json({ message: '2FA setup initiated', secret: secret.base32, qrCode: qrCodeUrl });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: '2FA setup failed', message: 'Internal server error' });
  }
};

const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.userId;
    if (!token) return res.status(400).json({ error: 'Validation failed', message: 'TOTP token is required' });

    const result = await pool.query('SELECT totp_secret FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0 || !result.rows[0].totp_secret) {
      return res.status(400).json({ error: '2FA not initialized', message: 'Please setup 2FA first' });
    }

    const secret = result.rows[0].totp_secret;
    const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
    if (!isValid) {
      return res.status(401).json({ error: 'Verification failed', message: 'Invalid TOTP token' });
    }

    await pool.query('UPDATE users SET totp_enabled = $1 WHERE id = $2', [true, userId]);
    res.status(200).json({ message: '2FA enabled successfully', totp_enabled: true });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: '2FA verification failed', message: 'Internal server error' });
  }
};

const loginWith2FA = async (req, res) => {
  try {
    const { pendingToken, token, userId } = req.body;
    
    // Support both new secure flow (pendingToken) and legacy flow (userId) for backward compatibility
    let user;
    
    if (pendingToken) {
      // New secure flow - validate pendingToken
      const pendingData = pending2FATokens.get(pendingToken);
      
      if (!pendingData) {
        return res.status(401).json({ error: 'Authentication failed', message: 'Session expirée. Veuillez vous reconnecter.' });
      }
      
      if (pendingData.expiresAt < Date.now()) {
        pending2FATokens.delete(pendingToken);
        return res.status(401).json({ error: 'Authentication failed', message: 'Session expirée. Veuillez vous reconnecter.' });
      }
      
      // Fetch user from database using stored userId
      const result = await pool.query(
        `SELECT id, email, first_name, last_name, totp_secret, totp_enabled, two_fa_method, email_2fa_code, email_2fa_expires, email_verified FROM users WHERE id = $1`,
        [pendingData.userId]
      );
      
      if (result.rows.length === 0) {
        pending2FATokens.delete(pendingToken);
        return res.status(401).json({ error: 'Authentication failed', message: 'Invalid credentials' });
      }
      
      user = result.rows[0];
      
      // Check which 2FA method is being used
      const method = pendingData.method || 'totp';
      
      if (method === 'email') {
        // Email 2FA verification
        if (!token || token.length !== 6) {
          return res.status(400).json({ error: 'Validation failed', message: 'Code à 6 chiffres requis' });
        }
        
        if (!user.email_2fa_code || !user.email_2fa_expires) {
          pending2FATokens.delete(pendingToken);
          return res.status(400).json({ error: 'Code expired', message: 'Code expiré. Veuillez vous reconnecter.' });
        }
        
        if (new Date(user.email_2fa_expires) < new Date()) {
          pending2FATokens.delete(pendingToken);
          await pool.query('UPDATE users SET email_2fa_code = NULL, email_2fa_expires = NULL WHERE id = $1', [user.id]);
          return res.status(401).json({ error: 'Code expired', message: 'Code expiré. Veuillez vous reconnecter.' });
        }
        
        if (user.email_2fa_code !== token) {
          return res.status(401).json({ error: 'Authentication failed', message: 'Code incorrect' });
        }
        
        // Clear the code after successful verification
        await pool.query('UPDATE users SET email_2fa_code = NULL, email_2fa_expires = NULL WHERE id = $1', [user.id]);
        pending2FATokens.delete(pendingToken);
        
      } else {
        // TOTP verification (existing flow)
        if (!user.totp_enabled || !user.totp_secret) {
          pending2FATokens.delete(pendingToken);
          return res.status(400).json({ error: '2FA not enabled', message: 'This account does not have 2FA enabled' });
        }
        
        const isValid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token, window: 1 });
        if (!isValid) {
          return res.status(401).json({ error: 'Authentication failed', message: 'Invalid TOTP token' });
        }
        
        pending2FATokens.delete(pendingToken);
      }
      
    } else if (userId) {
      // Legacy flow (deprecated) - pour compatibilité avec anciennes versions frontend
      // Valider que userId est un entier valide
      if (!isValidId(userId)) {
        return res.status(400).json({ error: 'Validation failed', message: 'Invalid user ID' });
      }
      
      if (!token) {
        return res.status(400).json({ error: 'Validation failed', message: 'TOTP token is required' });
      }

      const result = await pool.query(
        `SELECT id, email, first_name, last_name, totp_secret, totp_enabled FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Authentication failed', message: 'Invalid credentials' });
      }

      user = result.rows[0];
      if (!user.totp_enabled || !user.totp_secret) {
        return res.status(400).json({ error: '2FA not enabled', message: 'This account does not have 2FA enabled' });
      }

      const isValid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token, window: 1 });
      if (!isValid) {
        return res.status(401).json({ error: 'Authentication failed', message: 'Invalid TOTP token' });
      }
    } else {
      return res.status(400).json({ error: 'Validation failed', message: 'pendingToken and TOTP token are required' });
    }

    const jwtToken = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(200).json({
      message: 'Login successful',
      token: jwtToken,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, totp_enabled: user.totp_enabled }
    });
  } catch (err) {
    console.error('2FA login error:', err);
    res.status(500).json({ error: 'Login failed', message: 'Internal server error' });
  }
};

/**
 * Demande de réinitialisation de mot de passe
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    // Chercher l'utilisateur
    const result = await pool.query(
      'SELECT id, email, first_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Toujours répondre avec succès pour éviter l'énumération des emails
    if (result.rows.length === 0) {
      console.log('Password reset requested for unknown email:', email);
      return res.status(200).json({ 
        message: 'Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.' 
      });
    }

    const user = result.rows[0];

    // Invalider les anciens tokens
    await pool.query(
      'UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    // Générer un token sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    // Sauvegarder le token
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );

    // Envoyer l'email
    try {
      await sendPasswordResetEmail(user.email, resetToken, user.first_name);
    } catch (emailError) {
      console.error('Error sending reset email:', emailError);
      // On ne révèle pas l'erreur à l'utilisateur
    }

    res.status(200).json({ 
      message: 'Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.' 
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Réinitialisation du mot de passe avec le token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token et mot de passe requis' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    // Vérifier le token
    const result = await pool.query(
      `SELECT pr.id, pr.user_id, pr.expires_at, u.email 
       FROM password_resets pr 
       JOIN users u ON pr.user_id = u.id 
       WHERE pr.token = $1 AND pr.used = FALSE`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Lien invalide ou expiré' });
    }

    const resetRequest = result.rows[0];

    // Vérifier l'expiration
    if (new Date() > new Date(resetRequest.expires_at)) {
      await pool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [resetRequest.id]);
      return res.status(400).json({ error: 'Ce lien a expiré. Veuillez faire une nouvelle demande.' });
    }

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Mettre à jour le mot de passe
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, resetRequest.user_id]
    );

    // Marquer le token comme utilisé
    await pool.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [resetRequest.id]);

    console.log('Password reset successful for user:', resetRequest.email);

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Récupérer le profil utilisateur
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, profile_picture_url, birth_date, profession, bio, totp_enabled, two_fa_method, email_verified, is_in_couple, is_admin, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];
    res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      profilePictureUrl: user.profile_picture_url,
      birthDate: user.birth_date,
      profession: user.profession,
      bio: user.bio,
      totpEnabled: user.totp_enabled,
      twoFaMethod: user.two_fa_method || 'none',
      emailVerified: user.email_verified !== false,
      isInCouple: user.is_in_couple !== false, // default true for backwards compat
      isAdmin: user.is_admin || false,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Mettre à jour le profil utilisateur
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, birthDate, profession, bio, isInCouple } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           birth_date = COALESCE($3, birth_date),
           profession = COALESCE($4, profession),
           bio = COALESCE($5, bio),
           is_in_couple = COALESCE($6, is_in_couple),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, email, first_name, last_name, profile_picture_url, birth_date, profession, bio, totp_enabled, is_in_couple`,
      [firstName, lastName, birthDate, profession, bio, isInCouple, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];
    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePictureUrl: user.profile_picture_url,
        birthDate: user.birth_date,
        profession: user.profession,
        bio: user.bio,
        totpEnabled: user.totp_enabled,
        isInCouple: user.is_in_couple !== false
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Upload photo de profil
 */
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Récupérer l'ancienne photo pour la supprimer
    const oldPictureResult = await pool.query(
      'SELECT profile_picture_url FROM users WHERE id = $1',
      [userId]
    );
    
    const oldPictureUrl = oldPictureResult.rows[0]?.profile_picture_url;
    
    // Supprimer l'ancienne photo si elle existe
    if (oldPictureUrl) {
      await deleteOldAvatar(oldPictureUrl);
    }

    // Le chemin de l'image uploadée
    const profilePictureUrl = getPublicAvatarUrl(req.file.filename);

    await pool.query(
      'UPDATE users SET profile_picture_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [profilePictureUrl, userId]
    );

    console.log(`✅ Photo de profil mise à jour pour user ${userId}: ${profilePictureUrl}`);

    res.status(200).json({ 
      message: 'Photo de profil mise à jour', 
      profilePictureUrl 
    });
  } catch (err) {
    console.error('Upload profile picture error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Changer le mot de passe (utilisateur connecté)
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    // Vérifier le mot de passe actuel
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher et mettre à jour le nouveau mot de passe
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, userId]
    );

    res.status(200).json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * Désactiver la 2FA
 */
const disable2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token } = req.body;

    const result = await pool.query(
      'SELECT totp_secret, totp_enabled, two_fa_method FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];
    const twoFaMethod = user.two_fa_method || (user.totp_enabled ? 'totp' : 'none');

    if (twoFaMethod === 'none' && !user.totp_enabled) {
      return res.status(400).json({ error: 'La 2FA n\'est pas activée' });
    }

    // Si c'est du TOTP, vérifier le code
    if (twoFaMethod === 'totp' || user.totp_enabled) {
      if (!token) {
        return res.status(400).json({ error: 'Code TOTP requis pour désactiver la 2FA' });
      }

      const isValid = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token,
        window: 1
      });

      if (!isValid) {
        return res.status(401).json({ error: 'Code TOTP invalide' });
      }
    }
    // Si c'est du 2FA par email, pas besoin de code (l'utilisateur est déjà authentifié)

    await pool.query(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, two_fa_method = $1 WHERE id = $2',
      ['none', userId]
    );

    res.status(200).json({ message: '2FA désactivée avec succès' });
  } catch (err) {
    console.error('Disable 2FA error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Verify email address
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Token manquant' });
    }
    
    const result = await pool.query(
      'SELECT id, email, email_verification_expires FROM users WHERE email_verification_token = $1',
      [token]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }
    
    const user = result.rows[0];
    
    if (new Date(user.email_verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Token expiré. Veuillez demander un nouveau lien de vérification.' });
    }
    
    await pool.query(
      'UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
      [user.id]
    );
    
    res.status(200).json({ message: 'Email vérifié avec succès !', email: user.email });
  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Resend verification email (authenticated version - for users logged in)
const resendVerificationEmail = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT email, first_name, email_verified, email_verification_expires FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const user = result.rows[0];
    
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email déjà vérifié' });
    }
    
    // Rate limit: check if last email was sent less than 1 minute ago
    if (user.email_verification_expires) {
      const lastSentAt = new Date(user.email_verification_expires).getTime() - (24 * 60 * 60 * 1000);
      const oneMinuteAgo = Date.now() - (60 * 1000);
      if (lastSentAt > oneMinuteAgo) {
        const waitSeconds = Math.ceil((lastSentAt - oneMinuteAgo) / 1000);
        return res.status(429).json({ 
          error: 'Veuillez patienter', 
          message: `Veuillez attendre ${waitSeconds} secondes avant de renvoyer un email.`,
          retryAfter: waitSeconds
        });
      }
    }
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await pool.query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, userId]
    );
    
    await sendVerificationEmail(user.email, verificationToken, user.first_name);
    
    res.status(200).json({ message: 'Email de vérification envoyé ! Vérifiez aussi vos spams.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Resend verification email (public version - for users not logged in)
const resendVerificationEmailPublic = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    const result = await pool.query(
      'SELECT id, first_name, email_verified, email_verification_expires FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      // Ne pas révéler si l'email existe ou non
      return res.status(200).json({ message: 'Si ce compte existe, un email de vérification a été envoyé.' });
    }
    
    const user = result.rows[0];
    
    if (user.email_verified) {
      return res.status(200).json({ message: 'Si ce compte existe, un email de vérification a été envoyé.' });
    }
    
    // Rate limit: check if last email was sent less than 1 minute ago
    if (user.email_verification_expires) {
      const lastSentAt = new Date(user.email_verification_expires).getTime() - (24 * 60 * 60 * 1000);
      const oneMinuteAgo = Date.now() - (60 * 1000);
      if (lastSentAt > oneMinuteAgo) {
        const waitSeconds = Math.ceil((lastSentAt - oneMinuteAgo) / 1000);
        return res.status(429).json({ 
          error: 'Veuillez patienter', 
          message: `Veuillez attendre ${waitSeconds} secondes avant de renvoyer un email.`,
          retryAfter: waitSeconds
        });
      }
    }
    
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await pool.query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );
    
    await sendVerificationEmail(email.toLowerCase(), verificationToken, user.first_name);
    
    res.status(200).json({ message: 'Email de vérification envoyé ! Vérifiez aussi vos spams.' });
  } catch (err) {
    console.error('Resend verification public error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Enable email 2FA
const enableEmail2FA = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // First disable TOTP if enabled
    await pool.query(
      'UPDATE users SET two_fa_method = $1, totp_enabled = FALSE, totp_secret = NULL WHERE id = $2',
      ['email', userId]
    );
    
    res.status(200).json({ message: '2FA par email activée', two_fa_method: 'email' });
  } catch (err) {
    console.error('Enable email 2FA error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Get 2FA status
const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(
      'SELECT totp_enabled, two_fa_method FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const user = result.rows[0];
    
    res.status(200).json({
      totp_enabled: user.totp_enabled,
      two_fa_method: user.two_fa_method || 'none',
      has2FA: user.totp_enabled || user.two_fa_method === 'email'
    });
  } catch (err) {
    console.error('Get 2FA status error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Check if email is verified (public endpoint for polling after registration)
const checkEmailVerified = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }
    
    const result = await pool.query(
      'SELECT email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      // Don't reveal if user exists or not
      return res.status(200).json({ verified: false });
    }
    
    res.status(200).json({ verified: result.rows[0].email_verified === true });
  } catch (err) {
    console.error('Check email verified error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Delete user account (self-deletion)
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis pour confirmer la suppression' });
    }
    
    // Verify password
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    
    // Delete user's data in order (respecting foreign keys)
    // 1. Delete couple invitations
    await pool.query('DELETE FROM couple_invitations WHERE inviter_id = $1 OR invitee_id = $1', [userId]);
    
    // 2. Delete from couples (if in a couple)
    await pool.query('DELETE FROM couples WHERE user1_id = $1 OR user2_id = $1', [userId]);
    
    // 3. Delete transactions
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
    
    // 4. Delete accounts
    await pool.query('DELETE FROM accounts WHERE user_id = $1', [userId]);
    
    // 5. Delete subscription settings
    await pool.query('DELETE FROM subscription_settings WHERE user_id = $1', [userId]);
    
    // 6. Finally delete the user
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    res.status(200).json({ message: 'Compte supprimé avec succès' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression du compte' });
  }
};

module.exports = { 
  register, 
  login, 
  setup2FA, 
  verify2FA, 
  loginWith2FA, 
  forgotPassword, 
  resetPassword,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  changePassword,
  disable2FA,
  verifyEmail,
  resendVerificationEmail,
  resendVerificationEmailPublic,
  enableEmail2FA,
  get2FAStatus,
  checkEmailVerified,
  deleteAccount
};

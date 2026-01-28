const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('../config/database');
const { validateRegister, validateLogin } = require('../utils/validation');
const { sendPasswordResetEmail } = require('../services/emailService');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const errors = validateRegister(email, password, firstName, lastName);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', errors });

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists', message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, totp_enabled)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, false]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

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

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name },
      hasPendingCoupleInvite: (await pool.query(
        `SELECT id FROM couple_invitations WHERE invitee_id = $1 AND status = 'pending'`,
        [user.id]
      )).rows.length > 0
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
      `SELECT id, email, password_hash, first_name, last_name, totp_enabled, totp_secret FROM users WHERE email = $1`,
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

    if (user.totp_enabled) {
      return res.status(200).json({ message: '2FA verification required', requires2FA: true, userId: user.id });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, totp_enabled: user.totp_enabled }
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
    const { userId, token } = req.body;
    if (!userId || !token) return res.status(400).json({ error: 'Validation failed', message: 'User ID and TOTP token are required' });

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, totp_secret, totp_enabled FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: '2FA not enabled', message: 'This account does not have 2FA enabled' });
    }

    const isValid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token, window: 1 });
    if (!isValid) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid TOTP token' });
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

module.exports = { register, login, setup2FA, verify2FA, loginWith2FA, forgotPassword, resetPassword };

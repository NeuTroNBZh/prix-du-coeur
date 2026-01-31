const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();

/**
 * POST /api/devices/push-token
 * Enregistre le token push d'un appareil pour les notifications
 */
router.post('/push-token', authenticateToken, async (req, res) => {
  try {
    const { pushToken, platform, deviceId } = req.body;
    const userId = req.user.id;

    if (!pushToken) {
      return res.status(400).json({ error: 'Push token requis' });
    }

    // Vérifie si le token existe déjà
    const existing = await pool.query(
      'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId || pushToken.substring(0, 50)]
    );

    if (existing.rows.length > 0) {
      // Mise à jour du token existant
      await pool.query(
        `UPDATE user_devices 
         SET push_token = $1, platform = $2, updated_at = NOW() 
         WHERE id = $3`,
        [pushToken, platform || 'unknown', existing.rows[0].id]
      );
    } else {
      // Création d'un nouveau device
      await pool.query(
        `INSERT INTO user_devices (user_id, push_token, platform, device_id) 
         VALUES ($1, $2, $3, $4)`,
        [userId, pushToken, platform || 'unknown', deviceId || pushToken.substring(0, 50)]
      );
    }

    res.json({ success: true, message: 'Token push enregistré' });

  } catch (error) {
    console.error('Erreur enregistrement push token:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/devices/push-token
 * Supprime le token push (déconnexion)
 */
router.delete('/push-token', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM user_devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );

    res.json({ success: true, message: 'Token push supprimé' });

  } catch (error) {
    console.error('Erreur suppression push token:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/devices
 * Liste les appareils enregistrés pour l'utilisateur
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, platform, device_id, created_at, updated_at 
       FROM user_devices 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [userId]
    );

    res.json({ devices: result.rows });

  } catch (error) {
    console.error('Erreur récupération devices:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/devices/:id
 * Supprime un appareil spécifique
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;

    await pool.query(
      'DELETE FROM user_devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    res.json({ success: true, message: 'Appareil supprimé' });

  } catch (error) {
    console.error('Erreur suppression device:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

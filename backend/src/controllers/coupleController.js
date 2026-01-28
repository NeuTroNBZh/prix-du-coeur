const pool = require('../config/database');
const { sendCoupleInvitationEmail, sendCreateAccountInvitationEmail } = require('../services/emailService');

/**
 * Get couple status
 * GET /api/couple
 */
const getCoupleStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if user is in a couple
    const coupleResult = await pool.query(
      `SELECT c.id, c.user1_id, c.user2_id, c.created_at,
              u1.id as u1_id, u1.email as u1_email, u1.first_name as u1_first_name, u1.last_name as u1_last_name,
              u2.id as u2_id, u2.email as u2_email, u2.first_name as u2_first_name, u2.last_name as u2_last_name
       FROM couples c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.user1_id = $1 OR c.user2_id = $1
       LIMIT 1`,
      [userId]
    );

    if (coupleResult.rows.length === 0) {
      // Check for pending invitation
      const inviteResult = await pool.query(
        `SELECT i.id, i.status, u.email, u.first_name, u.last_name
         FROM couple_invitations i
         JOIN users u ON i.inviter_id = u.id
         WHERE i.invitee_id = $1 AND i.status = 'pending'
         ORDER BY i.created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (inviteResult.rows.length > 0) {
        return res.status(200).json({
          status: 'pending_invitation',
          invitation: {
            id: inviteResult.rows[0].id,
            from: {
              email: inviteResult.rows[0].email,
              firstName: inviteResult.rows[0].first_name,
              lastName: inviteResult.rows[0].last_name
            }
          }
        });
      }

      return res.status(404).json({
        error: 'No couple found',
        message: 'You are not in a couple yet'
      });
    }

    const couple = coupleResult.rows[0];
    const isUser1 = couple.u1_id === userId;
    const partner = isUser1 
      ? { id: couple.u2_id, email: couple.u2_email, firstName: couple.u2_first_name, lastName: couple.u2_last_name }
      : { id: couple.u1_id, email: couple.u1_email, firstName: couple.u1_first_name, lastName: couple.u1_last_name };

    res.status(200).json({
      status: 'in_couple',
      couple: {
        id: couple.id,
        partner,
        createdAt: couple.created_at
      }
    });
  } catch (err) {
    console.error('Get couple status error:', err);
    res.status(500).json({
      error: 'Failed to get couple status',
      message: err.message
    });
  }
};

/**
 * Invite a partner by email
 * POST /api/couple/invite
 */
const invitePartner = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user is already in a couple
    const existingCouple = await client.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1`,
      [userId]
    );

    if (existingCouple.rows.length > 0) {
      return res.status(400).json({
        error: 'Already in couple',
        message: 'You are already in a couple'
      });
    }

    // Find invitee by email
    const invitee = await client.query(
      `SELECT id, email, first_name, last_name FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    // Get inviter's name for emails
    const inviter = await client.query(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [userId]
    );
    const inviterName = inviter.rows[0]?.first_name 
      ? `${inviter.rows[0].first_name} ${inviter.rows[0].last_name || ''}`.trim()
      : 'Votre partenaire';

    if (invitee.rows.length === 0) {
      // User not registered - send invitation to create account
      try {
        // Check if already invited
        const existingPending = await client.query(
          `SELECT id FROM pending_couple_invitations WHERE inviter_id = $1 AND invitee_email = $2 AND status = 'pending'`,
          [userId, email.toLowerCase()]
        );

        if (existingPending.rows.length > 0) {
          // Resend email
          await sendCreateAccountInvitationEmail(email.toLowerCase(), inviterName);
          return res.status(200).json({
            message: `Email renvoyé à ${email}`,
            status: 'pending_registration'
          });
        }

        // Create pending invitation
        await client.query(
          `INSERT INTO pending_couple_invitations (inviter_id, invitee_email, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (inviter_id, invitee_email) DO UPDATE SET status = 'pending', created_at = CURRENT_TIMESTAMP`,
          [userId, email.toLowerCase()]
        );

        // Send email invitation to create account
        await sendCreateAccountInvitationEmail(email.toLowerCase(), inviterName);

        return res.status(201).json({
          message: `Invitation envoyée à ${email} ! Cette personne doit d'abord créer un compte.`,
          status: 'pending_registration',
          note: 'Un email a été envoyé pour inviter cette personne à créer un compte.'
        });
      } catch (emailError) {
        console.error('Error sending create account invitation:', emailError);
        return res.status(201).json({
          message: `Invitation enregistrée. ${email} doit créer un compte sur l'application.`,
          status: 'pending_registration'
        });
      }
    }

    const inviteeId = invitee.rows[0].id;

    if (inviteeId === userId) {
      return res.status(400).json({
        error: 'Invalid invitation',
        message: 'You cannot invite yourself'
      });
    }

    // Check if invitee is already in a couple
    const inviteeCouple = await client.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1`,
      [inviteeId]
    );

    if (inviteeCouple.rows.length > 0) {
      return res.status(400).json({
        error: 'Partner unavailable',
        message: 'This person is already in a couple'
      });
    }

    await client.query('BEGIN');

    // Check for existing pending invitation
    const existingInvite = await client.query(
      `SELECT id FROM couple_invitations 
       WHERE ((inviter_id = $1 AND invitee_id = $2) OR (inviter_id = $2 AND invitee_id = $1))
       AND status = 'pending'`,
      [userId, inviteeId]
    );

    if (existingInvite.rows.length > 0) {
      // If other person already invited us, create the couple directly
      const otherInvite = await client.query(
        `SELECT id FROM couple_invitations 
         WHERE inviter_id = $2 AND invitee_id = $1 AND status = 'pending'`,
        [userId, inviteeId]
      );

      if (otherInvite.rows.length > 0) {
        // Create couple
        await client.query(
          `INSERT INTO couples (user1_id, user2_id) VALUES ($1, $2)`,
          [inviteeId, userId]
        );

        // Update invitation status
        await client.query(
          `UPDATE couple_invitations SET status = 'accepted' WHERE id = $1`,
          [otherInvite.rows[0].id]
        );

        await client.query('COMMIT');

        return res.status(201).json({
          message: 'Couple created!',
          status: 'couple_created'
        });
      }

      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invitation exists',
        message: 'An invitation is already pending'
      });
    }

    // Create invitation
    await client.query(
      `INSERT INTO couple_invitations (inviter_id, invitee_id, status)
       VALUES ($1, $2, 'pending')`,
      [userId, inviteeId]
    );

    await client.query('COMMIT');

    // inviterName already defined above

    // Send invitation email
    try {
      await sendCoupleInvitationEmail(
        invitee.rows[0].email,
        invitee.rows[0].first_name,
        inviterName
      );
      console.log('✅ Email d\'invitation envoyé à:', invitee.rows[0].email);
    } catch (emailError) {
      console.error('⚠️ Erreur envoi email invitation (non bloquant):', emailError);
      // Continue anyway - invitation is created in DB
    }

    res.status(201).json({
      message: `Invitation envoyée à ${invitee.rows[0].first_name} ! Un email de notification a été envoyé.`,
      invitee: {
        email: invitee.rows[0].email,
        firstName: invitee.rows[0].first_name
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Invite partner error:', err);
    res.status(500).json({
      error: 'Invitation failed',
      message: err.message
    });
  } finally {
    client.release();
  }
};

/**
 * Accept a pending invitation
 * POST /api/couple/accept
 */
const acceptInvitation = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.userId;

    // Find pending invitation
    const invitation = await client.query(
      `SELECT i.id, i.inviter_id 
       FROM couple_invitations i
       WHERE i.invitee_id = $1 AND i.status = 'pending'
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (invitation.rows.length === 0) {
      return res.status(404).json({
        error: 'No invitation',
        message: 'You have no pending invitations'
      });
    }

    const inviterId = invitation.rows[0].inviter_id;
    const invitationId = invitation.rows[0].id;

    await client.query('BEGIN');

    // Create couple
    await client.query(
      `INSERT INTO couples (user1_id, user2_id) VALUES ($1, $2)`,
      [inviterId, userId]
    );

    // Update invitation status
    await client.query(
      `UPDATE couple_invitations SET status = 'accepted' WHERE id = $1`,
      [invitationId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Invitation accepted! You are now a couple.',
      status: 'couple_created'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Accept invitation error:', err);
    res.status(500).json({
      error: 'Accept failed',
      message: err.message
    });
  } finally {
    client.release();
  }
};

/**
 * Leave a couple
 * DELETE /api/couple/leave
 */
const leaveCouple = async (req, res) => {
  try {
    const userId = req.user.userId;

    // First, find the couple
    const coupleResult = await pool.query(
      `SELECT id FROM couples WHERE user1_id = $1 OR user2_id = $1`,
      [userId]
    );

    if (coupleResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not in couple',
        message: 'You are not in a couple'
      });
    }

    const coupleId = coupleResult.rows[0].id;

    // Dissociate transactions from the couple (set couple_id to NULL)
    await pool.query(
      `UPDATE transactions SET couple_id = NULL WHERE couple_id = $1`,
      [coupleId]
    );

    // Delete harmonization history
    await pool.query(
      `DELETE FROM harmonizations WHERE couple_id = $1`,
      [coupleId]
    );

    // Now delete the couple
    await pool.query(
      `DELETE FROM couples WHERE id = $1`,
      [coupleId]
    );

    res.status(200).json({
      message: 'You have left the couple'
    });
  } catch (err) {
    console.error('Leave couple error:', err);
    res.status(500).json({
      error: 'Failed to leave couple',
      message: err.message
    });
  }
};

module.exports = {
  getCoupleStatus,
  invitePartner,
  acceptInvitation,
  leaveCouple
};

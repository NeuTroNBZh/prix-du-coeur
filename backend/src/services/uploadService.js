/**
 * Service de gestion des uploads de fichiers
 * Gère l'upload, la validation et le stockage des fichiers
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Chemins de base
const UPLOADS_BASE_PATH = path.join(__dirname, '../../uploads');
const AVATARS_PATH = path.join(UPLOADS_BASE_PATH, 'avatars');

// Types de fichiers autorisés
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

// Taille maximale des fichiers (en bytes)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Initialise les dossiers d'upload
 */
const initUploadDirectories = () => {
  const directories = [AVATARS_PATH];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Dossier créé: ${dir}`);
    }
  });
};

// Initialiser les dossiers au chargement du module
initUploadDirectories();

/**
 * Génère un nom de fichier unique et sécurisé
 */
const generateSecureFilename = (userId, originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalname).toLowerCase();
  return `avatar-${userId}-${timestamp}-${randomString}${ext}`;
};

/**
 * Valide le type de fichier
 */
const validateImageFile = (file) => {
  const mimeType = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_IMAGE_TYPES[mimeType]) {
    return { valid: false, error: 'Type de fichier non autorisé' };
  }
  
  if (!ALLOWED_IMAGE_TYPES[mimeType].includes(ext)) {
    return { valid: false, error: 'Extension de fichier incorrecte' };
  }
  
  return { valid: true };
};

/**
 * Configuration du stockage pour les avatars
 */
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Assurer que le dossier existe
    if (!fs.existsSync(AVATARS_PATH)) {
      fs.mkdirSync(AVATARS_PATH, { recursive: true });
    }
    cb(null, AVATARS_PATH);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.userId;
    if (!userId) {
      return cb(new Error('Utilisateur non authentifié'));
    }
    const filename = generateSecureFilename(userId, file.originalname);
    cb(null, filename);
  }
});

/**
 * Filtre de fichiers pour les images
 */
const imageFileFilter = (req, file, cb) => {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    return cb(new Error(validation.error), false);
  }
  cb(null, true);
};

/**
 * Middleware multer pour les avatars
 */
const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: imageFileFilter
});

/**
 * Supprime un fichier avatar existant
 * @param {string} avatarUrl - L'URL relative de l'avatar (ex: /uploads/avatars/xxx.jpg)
 */
const deleteOldAvatar = async (avatarUrl) => {
  if (!avatarUrl) return;
  
  try {
    // Extraire le nom du fichier de l'URL
    const filename = path.basename(avatarUrl);
    const filePath = path.join(AVATARS_PATH, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Ancien avatar supprimé: ${filename}`);
    }
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'ancien avatar:', error);
    // On ne fait pas échouer l'upload si la suppression échoue
  }
};

/**
 * Obtient le chemin URL public d'un fichier uploadé
 */
const getPublicAvatarUrl = (filename) => {
  return `/uploads/avatars/${filename}`;
};

/**
 * Gestionnaire d'erreurs pour multer
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: 'Fichier trop volumineux',
          message: `La taille maximale est de ${MAX_FILE_SIZE / (1024 * 1024)} Mo`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ 
          error: 'Trop de fichiers',
          message: 'Un seul fichier est autorisé'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          error: 'Champ incorrect',
          message: 'Le champ de fichier doit être "avatar"'
        });
      default:
        return res.status(400).json({ 
          error: 'Erreur d\'upload',
          message: err.message
        });
    }
  }
  
  if (err) {
    return res.status(400).json({ 
      error: 'Erreur de validation',
      message: err.message
    });
  }
  
  next();
};

module.exports = {
  avatarUpload,
  deleteOldAvatar,
  getPublicAvatarUrl,
  handleMulterError,
  AVATARS_PATH,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES
};

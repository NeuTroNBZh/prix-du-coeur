import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Navbar from '../components/Navbar';
import { 
  UserCircleIcon, 
  CameraIcon,
  KeyIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  HeartIcon,
  UserPlusIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  UserIcon,
  ComputerDesktopIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

// Liste des professions les plus courantes
const PROFESSIONS = [
  '',
  'Étudiant(e)',
  'Employé(e)',
  'Cadre',
  'Cadre supérieur',
  'Profession libérale',
  'Artisan / Commerçant',
  'Chef d\'entreprise',
  'Fonctionnaire',
  'Enseignant(e)',
  'Médecin / Professionnel de santé',
  'Ingénieur(e)',
  'Développeur / Informaticien',
  'Commercial(e)',
  'Agriculteur / Exploitant',
  'Ouvrier / Technicien',
  'Artiste / Créatif',
  'Retraité(e)',
  'Sans emploi',
  'Autre'
];

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const { isDarkMode, toggleTheme, themeMode, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // États profil
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    birthDate: '',
    profession: '',
    bio: '',
    profilePictureUrl: '',
    totpEnabled: false,
    isInCouple: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // États changement mot de passe
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  
  // États 2FA
  const [twoFAData, setTwoFAData] = useState({
    qrCode: '',
    secret: '',
    token: '',
    disableToken: ''
  });
  const [setting2FA, setSetting2FA] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);

  // États Couple
  const [couple, setCouple] = useState(null);
  const [coupleLoading, setCoupleLoading] = useState(true);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showBreakupModal, setShowBreakupModal] = useState(false);
  const [breaking, setBreaking] = useState(false);

  // États vérification email
  const [resendVerifLoading, setResendVerifLoading] = useState(false);
  const [resendVerifCooldown, setResendVerifCooldown] = useState(0);
  const [resendVerifMessage, setResendVerifMessage] = useState({ type: '', text: '' });

  // États désinscription
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Timer pour le cooldown de renvoi email
  useEffect(() => {
    if (resendVerifCooldown > 0) {
      const timer = setTimeout(() => setResendVerifCooldown(resendVerifCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendVerifCooldown]);

  // Scroll vers la section si hash dans l'URL
  const location = useLocation();
  useEffect(() => {
    if (location.hash && !loading) {
      const element = document.getElementById(location.hash.substring(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location.hash, loading]);

  // Charger le profil et le couple
  useEffect(() => {
    fetchProfile();
    fetchCoupleStatus();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/auth/profile');
      setProfile(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement du profil' });
      setLoading(false);
    }
  };

  // Charger le statut du couple
  const fetchCoupleStatus = async () => {
    try {
      const res = await api.get('/api/couple');
      setCouple(res.data.couple);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('Erreur couple:', err);
      }
    } finally {
      setCoupleLoading(false);
    }
  };

  // Renvoyer l'email de vérification
  const handleResendVerificationEmail = async () => {
    if (resendVerifCooldown > 0 || resendVerifLoading) return;
    
    setResendVerifLoading(true);
    setResendVerifMessage({ type: '', text: '' });
    
    try {
      const response = await api.post('/api/auth/resend-verification');
      setResendVerifMessage({ type: 'success', text: response.data.message });
      setResendVerifCooldown(60); // 60 secondes de cooldown
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.data.retryAfter || 60;
        setResendVerifCooldown(retryAfter);
        setResendVerifMessage({ type: 'error', text: `Veuillez patienter ${retryAfter} secondes avant de réessayer` });
      } else {
        setResendVerifMessage({ type: 'error', text: error.response?.data?.message || 'Erreur lors de l\'envoi' });
      }
    } finally {
      setResendVerifLoading(false);
    }
  };

  // Inviter un partenaire
  const handleInvitePartner = async (e) => {
    e.preventDefault();
    setInviting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await api.post('/api/couple/invite', { email: partnerEmail });
      setMessage({ type: 'success', text: res.data.message });
      setPartnerEmail('');
      fetchCoupleStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur lors de l\'invitation' });
    } finally {
      setInviting(false);
    }
  };

  // Toggle statut couple (pour les personnes célibataires)
  const handleToggleCouple = async () => {
    const newValue = !profile.isInCouple;
    try {
      await api.patch('/api/auth/profile', { isInCouple: newValue });
      setProfile(prev => ({ ...prev, isInCouple: newValue }));
      if (updateUser) {
        updateUser({ isInCouple: newValue });
      }
      setMessage({ 
        type: 'success', 
        text: newValue 
          ? 'Mode couple activé - vous pouvez maintenant inviter un partenaire !' 
          : 'Mode célibataire activé - les fonctions couple sont masquées'
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur lors de la mise à jour' });
    }
  };

  // Accepter une invitation
  const handleAcceptInvite = async () => {
    try {
      await api.post('/api/couple/accept');
      setMessage({ type: 'success', text: 'Invitation acceptée !' });
      fetchCoupleStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur' });
    }
  };

  // Rompre le couple
  const handleBreakup = async () => {
    setBreaking(true);
    setMessage({ type: '', text: '' });
    try {
      await api.delete('/api/couple/leave');
      setCouple(null);
      setShowBreakupModal(false);
      setMessage({ type: 'success', text: 'Vous avez quitté le couple.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la rupture' });
    } finally {
      setBreaking(false);
    }
  };

  // Supprimer le compte (désinscription)
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('Veuillez entrer votre mot de passe');
      return;
    }
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      await api.delete('/api/auth/account', { data: { password: deletePassword } });
      logout();
      navigate('/');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Erreur lors de la suppression du compte');
    } finally {
      setDeleting(false);
    }
  };

  // Sauvegarder le profil
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await api.patch('/api/auth/profile', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        birthDate: profile.birthDate || null,
        profession: profile.profession,
        bio: profile.bio
      });
      
      setProfile(response.data.user);
      if (updateUser) {
        updateUser(response.data.user);
      }
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' });
    } catch (error) {
      console.error('Erreur sauvegarde profil:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  // Upload photo de profil
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/api/auth/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newPictureUrl = response.data.profilePictureUrl;
      setProfile(prev => ({ ...prev, profilePictureUrl: newPictureUrl }));
      // Mettre à jour le contexte Auth pour que la navbar affiche la nouvelle photo
      if (updateUser) {
        updateUser({ profilePictureUrl: newPictureUrl });
      }
      setMessage({ type: 'success', text: 'Photo de profil mise à jour !' });
    } catch (error) {
      console.error('Erreur upload photo:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'upload' });
    }
  };

  // Changer le mot de passe
  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères' });
      return;
    }
    
    setChangingPassword(true);
    setMessage({ type: '', text: '' });
    
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage({ type: 'success', text: 'Mot de passe modifié avec succès !' });
    } catch (error) {
      console.error('Erreur changement mot de passe:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors du changement' });
    } finally {
      setChangingPassword(false);
    }
  };

  // Configurer 2FA
  const handleSetup2FA = async () => {
    setSetting2FA(true);
    try {
      const response = await api.post('/api/auth/2fa/setup');
      setTwoFAData({
        ...twoFAData,
        qrCode: response.data.qrCode,
        secret: response.data.secret
      });
      setShow2FASetup(true);
    } catch (error) {
      console.error('Erreur setup 2FA:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la configuration 2FA' });
    } finally {
      setSetting2FA(false);
    }
  };

  // Vérifier et activer 2FA
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setSetting2FA(true);
    
    try {
      await api.post('/api/auth/2fa/verify', { token: twoFAData.token });
      setProfile(prev => ({ ...prev, totpEnabled: true }));
      setShow2FASetup(false);
      setTwoFAData({ qrCode: '', secret: '', token: '', disableToken: '' });
      setMessage({ type: 'success', text: 'Authentification à deux facteurs activée !' });
    } catch (error) {
      console.error('Erreur vérification 2FA:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Code invalide' });
    } finally {
      setSetting2FA(false);
    }
  };

  // Désactiver 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    setSetting2FA(true);
    
    try {
      await api.post('/api/auth/2fa/disable', { token: twoFAData.disableToken });
      setProfile(prev => ({ ...prev, totpEnabled: false, twoFaMethod: 'none' }));
      setTwoFAData({ qrCode: '', secret: '', token: '', disableToken: '' });
      setMessage({ type: 'success', text: 'Authentification à deux facteurs désactivée' });
    } catch (error) {
      console.error('Erreur désactivation 2FA:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Code invalide' });
    } finally {
      setSetting2FA(false);
    }
  };

  // Activer 2FA par email
  const handleEnableEmail2FA = async () => {
    setSetting2FA(true);
    try {
      await api.post('/api/auth/2fa/enable-email');
      setProfile(prev => ({ ...prev, totpEnabled: false, twoFaMethod: 'email' }));
      setMessage({ type: 'success', text: '2FA par email activée ! À chaque connexion, vous recevrez un code par email.' });
    } catch (error) {
      console.error('Erreur activation 2FA email:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de l\'activation' });
    } finally {
      setSetting2FA(false);
    }
  };

  // Désactiver 2FA par email (sans code requis)
  const handleDisableEmail2FA = async () => {
    setSetting2FA(true);
    try {
      await api.post('/api/auth/2fa/disable');
      setProfile(prev => ({ ...prev, totpEnabled: false, twoFaMethod: 'none' }));
      setMessage({ type: 'success', text: 'Authentification à deux facteurs désactivée' });
    } catch (error) {
      console.error('Erreur désactivation 2FA email:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erreur lors de la désactivation' });
    } finally {
      setSetting2FA(false);
    }
  };

  // Calculer l'âge
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-theme-primary">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pdc-cyan"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-primary flex flex-col">
      <Navbar />
      
      <div className="flex-1 max-w-4xl mx-auto w-full py-4 sm:py-8 px-3 sm:px-6 lg:px-8 pb-28 md:pb-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary mb-4 sm:mb-8">Mon Profil</h1>
        
        {/* Message de feedback */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-md flex items-center ${
            message.type === 'success' ? 'bg-pdc-mint/20 text-pdc-teal dark:text-pdc-mint' : 'bg-pdc-coral/20 text-red-800 dark:text-pdc-coral'
          }`}>
            {message.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 mr-2" />
            ) : (
              <XCircleIcon className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* Bandeau vérification email non effectuée */}
        {profile.emailVerified === false && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Adresse email non vérifiée
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Veuillez vérifier votre adresse email en cliquant sur le lien envoyé à <strong>{profile.email}</strong>.
                  <br />
                  <span className="italic">💡 Pensez à vérifier votre dossier spam ou courrier indésirable.</span>
                </p>
                
                {resendVerifMessage.text && (
                  <p className={`text-sm mt-2 ${resendVerifMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {resendVerifMessage.text}
                  </p>
                )}
                
                <button
                  onClick={handleResendVerificationEmail}
                  disabled={resendVerifLoading || resendVerifCooldown > 0}
                  className={`mt-3 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    resendVerifLoading || resendVerifCooldown > 0
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                  }`}
                >
                  {resendVerifLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Envoi en cours...
                    </>
                  ) : resendVerifCooldown > 0 ? (
                    `Réessayer dans ${resendVerifCooldown}s`
                  ) : (
                    'Renvoyer l\'email de vérification'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Apparence / Thème */}
        <div className="card-theme shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            {themeMode === 'auto' ? (
              <ComputerDesktopIcon className="h-6 w-6 mr-2 text-pdc-cyan" />
            ) : isDarkMode ? (
              <MoonIcon className="h-6 w-6 mr-2 text-pdc-sky" />
            ) : (
              <SunIcon className="h-6 w-6 mr-2 text-pdc-coral" />
            )}
            Apparence
          </h2>
          
          <div className="space-y-3">
            <p className="text-theme-secondary text-sm mb-4">
              Choisissez le thème de l'application
            </p>
            
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Mode Clair */}
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  themeMode === 'light'
                    ? 'border-pdc-cyan bg-pdc-cyan/10 dark:bg-pdc-cyan/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-pdc-cyan/50'
                }`}
              >
                <SunIcon className={`h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2 ${themeMode === 'light' ? 'text-pdc-coral' : 'text-gray-400'}`} />
                <span className={`text-xs sm:text-sm font-medium ${themeMode === 'light' ? 'text-pdc-cyan' : 'text-theme-secondary'}`}>
                  Clair
                </span>
              </button>
              
              {/* Mode Sombre */}
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  themeMode === 'dark'
                    ? 'border-pdc-cyan bg-pdc-cyan/10 dark:bg-pdc-cyan/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-pdc-cyan/50'
                }`}
              >
                <MoonIcon className={`h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2 ${themeMode === 'dark' ? 'text-pdc-sky' : 'text-gray-400'}`} />
                <span className={`text-xs sm:text-sm font-medium ${themeMode === 'dark' ? 'text-pdc-cyan' : 'text-theme-secondary'}`}>
                  Sombre
                </span>
              </button>
              
              {/* Mode Auto */}
              <button
                onClick={() => setTheme('auto')}
                className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  themeMode === 'auto'
                    ? 'border-pdc-cyan bg-pdc-cyan/10 dark:bg-pdc-cyan/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-pdc-cyan/50'
                }`}
              >
                <ComputerDesktopIcon className={`h-6 w-6 sm:h-8 sm:w-8 mb-1 sm:mb-2 ${themeMode === 'auto' ? 'text-pdc-cyan' : 'text-gray-400'}`} />
                <span className={`text-xs sm:text-sm font-medium ${themeMode === 'auto' ? 'text-pdc-cyan' : 'text-theme-secondary'}`}>
                  Auto
                </span>
              </button>
            </div>
            
            <p className="text-theme-tertiary text-xs mt-2 text-center">
              {themeMode === 'auto' 
                ? `Mode automatique : suit les réglages de votre appareil (actuellement ${isDarkMode ? 'sombre' : 'clair'})`
                : themeMode === 'dark' 
                  ? 'Mode sombre activé'
                  : 'Mode clair activé'
              }
            </p>
          </div>
        </div>

        {/* Section Photo de profil */}
        <div className="card-theme shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            <CameraIcon className="h-6 w-6 mr-2 text-pdc-cyan" />
            Photo de profil
          </h2>
          
          <div className="flex items-center space-x-6">
            <div className="relative">
              {profile.profilePictureUrl ? (
                <img
                  src={profile.profilePictureUrl}
                  alt="Photo de profil"
                  className="h-24 w-24 rounded-full object-cover border-4 border-pdc-cyan-200"
                />
              ) : (
                <img
                  src="/default-avatar.svg"
                  alt="Photo de profil par défaut"
                  className="h-24 w-24 rounded-full object-cover border-4 border-pdc-cyan-200"
                />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-pdc-cyan text-white p-2 rounded-full hover:bg-pdc-cyan-dark shadow-lg"
              >
                <CameraIcon className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm text-theme-tertiary">
                Formats acceptés : JPG, PNG, GIF, WebP
              </p>
              <p className="text-sm text-theme-tertiary">
                Taille max : 5 Mo
              </p>
            </div>
          </div>
        </div>

        {/* Section Informations personnelles */}
        <div className="bg-theme-card shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            <UserCircleIcon className="h-6 w-6 mr-2 text-pdc-cyan" />
            Informations personnelles
          </h2>
          
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary">Prénom</label>
                <input
                  type="text"
                  value={profile.firstName || ''}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary">Nom</label>
                <input
                  type="text"
                  value={profile.lastName || ''}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-theme-secondary">Email</label>
              <input
                type="email"
                value={profile.email || ''}
                disabled
                className="mt-1 block w-full rounded-md border-theme-primary bg-theme-secondary shadow-sm text-theme-tertiary"
              />
              <p className="mt-1 text-xs text-theme-tertiary">L'email ne peut pas être modifié</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary">Date de naissance</label>
                <input
                  type="date"
                  value={profile.birthDate ? profile.birthDate.split('T')[0] : ''}
                  onChange={(e) => setProfile({ ...profile, birthDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                />
                {profile.birthDate && (
                  <p className="mt-1 text-sm text-theme-tertiary">
                    {calculateAge(profile.birthDate)} ans
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary">Profession</label>
                <select
                  value={profile.profession || ''}
                  onChange={(e) => setProfile({ ...profile, profession: e.target.value })}
                  className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                >
                  <option value="">Sélectionner une profession</option>
                  {PROFESSIONS.filter(p => p !== '').map((profession) => (
                    <option key={profession} value={profession}>
                      {profession}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-theme-secondary">Bio / À propos</label>
              <textarea
                value={profile.bio || ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
                placeholder="Quelques mots sur vous..."
                className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-pdc-cyan text-white rounded-md hover:bg-pdc-cyan-dark disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>

        {/* Section Sécurité - Mot de passe */}
        <div className="bg-theme-card shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            <KeyIcon className="h-6 w-6 mr-2 text-pdc-cyan" />
            Changer le mot de passe
          </h2>
          
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-secondary">Mot de passe actuel</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
                className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={8}
                  className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changingPassword}
                className="px-4 py-2 bg-pdc-cyan text-white rounded-md hover:bg-pdc-cyan-dark disabled:opacity-50"
              >
                {changingPassword ? 'Modification...' : 'Modifier le mot de passe'}
              </button>
            </div>
          </form>
        </div>

        {/* Section Sécurité - 2FA */}
        <div className="bg-theme-card shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            <ShieldCheckIcon className="h-6 w-6 mr-2 text-pdc-cyan" />
            Authentification à deux facteurs (2FA)
          </h2>
          
          {(profile.totpEnabled || profile.twoFaMethod === 'email') ? (
            <div>
              <div className="flex items-center mb-4">
                <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
                <span className="text-green-700 dark:text-green-400 font-medium">
                  2FA activée ({profile.twoFaMethod === 'email' ? '📧 par email' : '📱 par application'})
                </span>
              </div>
              
              {profile.twoFaMethod === 'email' ? (
                <div className="space-y-4">
                  <p className="text-sm text-theme-secondary">
                    À chaque connexion, un code sera envoyé à votre adresse email.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleSetup2FA}
                      disabled={setting2FA}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      Passer à l'application (TOTP)
                    </button>
                    <button
                      onClick={handleDisableEmail2FA}
                      disabled={setting2FA}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {setting2FA ? 'Désactivation...' : 'Désactiver 2FA'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleDisable2FA} className="space-y-4">
                  <p className="text-sm text-theme-secondary">
                    Pour désactiver l'authentification à deux facteurs, entrez un code de votre application d'authentification.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <input
                      type="text"
                      value={twoFAData.disableToken}
                      onChange={(e) => setTwoFAData({ ...twoFAData, disableToken: e.target.value })}
                      placeholder="Code à 6 chiffres"
                      maxLength={6}
                      required
                      className="block w-48 rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                    />
                    <button
                      type="submit"
                      disabled={setting2FA}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {setting2FA ? 'Désactivation...' : 'Désactiver 2FA'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnableEmail2FA}
                    disabled={setting2FA}
                    className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50 text-sm"
                  >
                    Passer au 2FA par email
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div>
              {!show2FASetup ? (
                <div>
                  <div className="flex items-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mr-2" />
                    <span className="text-yellow-700 dark:text-yellow-400 font-medium">2FA non activée</span>
                  </div>
                  <p className="text-sm text-theme-secondary mb-4">
                    Protégez votre compte avec l'authentification à deux facteurs.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-theme-primary rounded-lg p-4 hover:border-pdc-cyan transition-colors">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">📱</span>
                        <h3 className="font-medium text-theme-primary">Application (TOTP)</h3>
                      </div>
                      <p className="text-xs text-theme-secondary mb-3">
                        Utilisez Google Authenticator, Authy, etc.
                      </p>
                      <button
                        onClick={handleSetup2FA}
                        disabled={setting2FA}
                        className="w-full px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm"
                      >
                        {setting2FA ? 'Configuration...' : 'Configurer'}
                      </button>
                    </div>
                    
                    <div className="border border-theme-primary rounded-lg p-4 hover:border-pdc-cyan transition-colors">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">📧</span>
                        <h3 className="font-medium text-theme-primary">Par Email</h3>
                      </div>
                      <p className="text-xs text-theme-secondary mb-3">
                        Recevez un code par email à chaque connexion.
                      </p>
                      <button
                        onClick={handleEnableEmail2FA}
                        disabled={setting2FA}
                        className="w-full px-3 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50 text-sm"
                      >
                        {setting2FA ? 'Activation...' : 'Activer'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-theme-secondary">
                    Scannez ce QR code avec votre application d'authentification :
                  </p>
                  
                  <div className="flex justify-center">
                    <img src={twoFAData.qrCode} alt="QR Code 2FA" className="border rounded-lg" />
                  </div>
                  
                  <p className="text-xs text-theme-tertiary text-center">
                    Ou entrez ce code manuellement : <code className="bg-theme-secondary px-2 py-1 rounded">{twoFAData.secret}</code>
                  </p>
                  
                  <form onSubmit={handleVerify2FA} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-theme-secondary">
                        Entrez le code affiché dans votre application
                      </label>
                      <input
                        type="text"
                        value={twoFAData.token}
                        onChange={(e) => setTwoFAData({ ...twoFAData, token: e.target.value })}
                        placeholder="Code à 6 chiffres"
                        maxLength={6}
                        required
                        className="mt-1 block w-48 rounded-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 bg-theme-card text-theme-primary"
                      />
                    </div>
                    
                    <div className="flex space-x-4">
                      <button
                        type="submit"
                        disabled={setting2FA}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {setting2FA ? 'Vérification...' : 'Vérifier et activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShow2FASetup(false)}
                        className="px-4 py-2 bg-theme-tertiary text-theme-secondary rounded-md hover:bg-theme-hover"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section Couple */}
        <div id="section-couple" className="bg-theme-card shadow rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            <HeartIcon className="h-6 w-6 mr-2 text-pdc-cyan" />
            Situation
          </h2>

          {/* Toggle En couple / Célibataire */}
          <div className="mb-6 pb-6 border-b border-theme-secondary">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {profile.isInCouple ? (
                  <HeartIcon className="h-5 w-5 text-pdc-cyan mr-2" />
                ) : (
                  <UserIcon className="h-5 w-5 text-theme-secondary mr-2" />
                )}
                <div>
                  <p className="font-medium text-theme-primary">
                    {profile.isInCouple ? 'Je suis en couple' : 'Je suis célibataire'}
                  </p>
                  <p className="text-xs text-theme-tertiary">
                    {profile.isInCouple 
                      ? 'Accès à l\'harmonisation et aux dépenses partagées'
                      : 'Fonctions couple masquées'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleCouple}
                disabled={!!couple}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-pdc-cyan-500 focus:ring-offset-2 ${
                  profile.isInCouple ? 'bg-pdc-cyan' : 'bg-gray-300 dark:bg-gray-600'
                } ${couple ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={couple ? 'Vous ne pouvez pas changer tant que vous êtes en couple avec quelqu\'un' : ''}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    profile.isInCouple ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {couple && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                ⚠️ Pour passer en mode célibataire, vous devez d'abord rompre le couple ci-dessous.
              </p>
            )}
          </div>

          {/* Le reste de la section couple - visible seulement si en couple */}
          {profile.isInCouple && (
            <>
              {coupleLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pdc-cyan"></div>
                </div>
              ) : couple ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/30 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-theme-primary truncate">
                        {couple.partner?.firstName} {couple.partner?.lastName}
                      </p>
                      <p className="text-sm text-theme-tertiary truncate">{couple.partner?.email}</p>
                    </div>
                    <HeartIcon className="h-8 w-8 text-pdc-cyan-500 flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-sm text-theme-tertiary text-center">
                    Ensemble depuis le {new Date(couple.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  
                  <div className="pt-4 border-t border-theme-secondary">
                    <button
                      onClick={() => setShowBreakupModal(true)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5 mr-2" />
                      Rompre le couple
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-theme-secondary mb-4">
                    Pour utiliser l'harmonisation des dépenses, invitez votre partenaire par email.
                  </p>

                  <form onSubmit={handleInvitePartner} className="space-y-4">
                    <div>
                      <label htmlFor="partnerEmail" className="block text-sm font-medium text-theme-secondary">
                        Email de votre partenaire
                      </label>
                      <div className="mt-1 flex">
                        <input
                          type="email"
                          id="partnerEmail"
                          value={partnerEmail}
                          onChange={(e) => setPartnerEmail(e.target.value)}
                          required
                          className="flex-1 rounded-l-md border-theme-primary shadow-sm focus:border-pdc-cyan-500 focus:ring-pdc-cyan-500 p-3 border bg-theme-card text-theme-primary"
                          placeholder="partenaire@email.com"
                        />
                        <button
                          type="submit"
                          disabled={inviting}
                          style={{ backgroundColor: '#2e82c4', color: 'white' }}
                          className="inline-flex items-center px-4 py-3 border border-transparent rounded-r-lg shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <UserPlusIcon className="h-5 w-5 mr-2" />
                          {inviting ? 'Envoi...' : 'Inviter'}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="mt-4 pt-4 border-t border-theme-secondary">
                    <p className="text-sm text-theme-tertiary text-center">
                      Votre partenaire doit d'abord créer un compte sur Prix du cœur
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal de confirmation de rupture */}
        {showBreakupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-theme-card rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2 mr-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-theme-primary">Rompre le couple ?</h3>
              </div>
              
              <p className="text-theme-secondary mb-6">
                Êtes-vous sûr de vouloir rompre le couple ? Cette action est irréversible. 
                Les données d'harmonisation seront conservées mais vous ne pourrez plus 
                partager vos dépenses avec {couple?.partner?.firstName}.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBreakupModal(false)}
                  className="flex-1 px-4 py-2 border border-theme-primary rounded-lg text-theme-secondary hover:bg-theme-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleBreakup}
                  disabled={breaking}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {breaking ? 'Rupture...' : 'Confirmer la rupture'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmation de suppression de compte */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-theme-card rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-2 mr-3">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-theme-primary">Supprimer mon compte ?</h3>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                <p className="text-red-800 dark:text-red-200 text-sm font-semibold mb-2">
                  ⚠️ Cette action est irréversible !
                </p>
                <ul className="text-red-700 dark:text-red-300 text-sm list-disc list-inside space-y-1">
                  <li>Toutes vos données seront supprimées</li>
                  <li>Vos comptes et transactions</li>
                  <li>Votre couple (si applicable)</li>
                  <li>Vos paramètres personnalisés</li>
                </ul>
              </div>
              
              <p className="text-theme-secondary text-sm mb-4">
                Pour confirmer, veuillez entrer votre mot de passe :
              </p>
              
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full px-3 py-2 border border-theme-primary rounded-md input-theme mb-4"
              />
              
              {deleteError && (
                <p className="text-red-600 text-sm mb-4">{deleteError}</p>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="flex-1 px-4 py-2 border border-theme-primary rounded-lg text-theme-secondary hover:bg-theme-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Déconnexion */}
        <div className="bg-theme-card shadow rounded-lg p-6 mt-6 mb-8">
          <h2 className="text-xl font-semibold text-theme-primary mb-4 flex items-center">
            <ArrowRightOnRectangleIcon className="h-6 w-6 mr-2 text-theme-secondary" />
            Déconnexion
          </h2>
          <p className="text-sm text-theme-secondary mb-4">
            Vous serez déconnecté de votre compte et redirigé vers la page de connexion.
          </p>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
            Se déconnecter
          </button>
        </div>

        {/* Section Suppression de compte */}
        <div className="bg-theme-card shadow rounded-lg p-6 mb-8 border border-red-200 dark:border-red-800">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center">
            <TrashIcon className="h-6 w-6 mr-2" />
            Supprimer mon compte
          </h2>
          <p className="text-sm text-theme-secondary mb-4">
            Cette action est définitive. Toutes vos données seront supprimées de manière permanente.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full sm:w-auto px-6 py-3 border-2 border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center"
          >
            <TrashIcon className="h-5 w-5 mr-2" />
            Me désinscrire
          </button>
        </div>
      </div>
    </div>
  );
}

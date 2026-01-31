import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail, validatePassword } from '../utils/helpers';
import { EnvelopeIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    acceptCGU: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [autoLoginCountdown, setAutoLoginCountdown] = useState(3);
  const pollingRef = useRef(null);
  const navigate = useNavigate();
  const { register, login } = useAuth();

  // SEO: Mettre à jour le titre
  useEffect(() => {
    document.title = 'Créer un compte gratuit | Prix du Cœur - Budget Couple';
  }, []);

  // Get user location on mount
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Use free IP geolocation API
        const response = await fetch('https://ipapi.co/json/');
        if (response.ok) {
          const data = await response.json();
          setLocation({
            country: data.country_name,
            city: data.city,
            region: data.region,
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone
          });
        }
      } catch (err) {
        console.log('Could not get location:', err);
      }
    };
    fetchLocation();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(formData.email)) {
      setError('Email invalide');
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule et 1 chiffre');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!formData.acceptCGU) {
      setError('Vous devez accepter les conditions générales d\'utilisation');
      return;
    }

    setLoading(true);
    try {
      console.log('📤 Tentative inscription:', { email: formData.email, firstName: formData.firstName, location });
      const result = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        location: location
      });
      console.log('✅ Inscription réussie!', result);
      
      // Si l'inscription nécessite une vérification email
      if (result.requiresEmailVerification) {
        setRegisteredEmail(result.email || formData.email);
        setRegistrationComplete(true);
      } else {
        // Ancien comportement si déjà vérifié (ne devrait plus arriver)
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('❌ Erreur inscription:', err);
      console.error('❌ Response:', err.response);
      console.error('❌ Message:', err.message);
      const errorMessage = err.response?.data?.error 
        || err.response?.data?.message 
        || err.message 
        || 'Erreur lors de l\'inscription';
      setError(`${errorMessage} (${err.response?.status || 'Network Error'})`);
    } finally {
      setLoading(false);
    }
  };

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Polling pour vérifier si l'email a été validé (toutes les 3 secondes)
  useEffect(() => {
    if (registrationComplete && !emailVerified) {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.post('/api/auth/check-email-verified', { email: registeredEmail });
          if (response.data.verified) {
            setEmailVerified(true);
            clearInterval(pollingRef.current);
          }
        } catch (err) {
          // Ignore les erreurs silencieusement
        }
      }, 3000);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [registrationComplete, emailVerified, registeredEmail]);

  // Auto-login countdown quand l'email est vérifié
  useEffect(() => {
    if (emailVerified && autoLoginCountdown > 0) {
      const timer = setTimeout(() => setAutoLoginCountdown(autoLoginCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (emailVerified && autoLoginCountdown === 0) {
      // Rediriger vers login avec message
      navigate('/login', { state: { emailVerified: true, email: registeredEmail } });
    }
  }, [emailVerified, autoLoginCountdown, navigate, registeredEmail]);

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      await api.post('/api/auth/resend-verification-public', { email: registeredEmail });
      setResendMessage('Email renvoyé ! Vérifiez votre boîte mail et vos spams.');
      setResendCooldown(60); // 1 minute cooldown
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = err.response?.data?.retryAfter || 60;
        setResendCooldown(retryAfter);
        setResendMessage(`Veuillez patienter ${retryAfter} secondes.`);
      } else {
        setResendMessage(err.response?.data?.message || 'Erreur lors de l\'envoi');
      }
    } finally {
      setResendLoading(false);
    }
  };

  // Écran de confirmation après inscription
  if (registrationComplete) {
    // Si l'email a été vérifié, afficher un écran de succès avec redirection
    if (emailVerified) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pdc-cyan-50 to-pdc-mint-50 py-12 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <CheckCircleIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Email vérifié ! 🎉
            </h1>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Votre adresse email a été confirmée avec succès.
            </p>
            
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <p className="text-green-800 dark:text-green-200 text-sm">
                ✨ Redirection vers la page de connexion dans <strong>{autoLoginCountdown}</strong> seconde{autoLoginCountdown > 1 ? 's' : ''}...
              </p>
            </div>
            
            <Link
              to="/login"
              className="block w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Se connecter maintenant
            </Link>
          </div>
        </div>
      );
    }

    // Écran d'attente de vérification
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pdc-cyan-50 to-pdc-mint-50 py-12 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <EnvelopeIcon className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Vérifiez votre email ! 📧
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Un email de confirmation a été envoyé à :
          </p>
          
          <p className="font-semibold text-lg text-pink-600 dark:text-pink-400 mb-6">
            {registeredEmail}
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              ⚠️ <strong>Important :</strong> L'email peut arriver dans vos <strong>spams</strong> ou courriers indésirables. Pensez à vérifier !
            </p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-blue-800 dark:text-blue-200 text-sm flex items-center justify-center gap-2">
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
              Cette page se mettra à jour automatiquement une fois l'email validé
            </p>
          </div>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Cliquez sur le lien dans l'email pour activer votre compte.
          </p>
          
          {resendMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${resendMessage.includes('renvoyé') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {resendMessage}
            </div>
          )}
          
          <button
            onClick={handleResendEmail}
            disabled={resendLoading || resendCooldown > 0}
            className="w-full mb-4 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {resendLoading ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
            ) : resendCooldown > 0 ? (
              `Renvoyer dans ${resendCooldown}s`
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5" />
                Renvoyer l'email
              </>
            )}
          </button>
          
          <Link
            to="/login"
            className="block w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Aller à la page de connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pdc-cyan-50 to-pdc-mint-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-4xl font-extrabold text-theme-primary">
            💖 Créer un compte
          </h2>
          <p className="mt-2 text-center text-sm text-theme-secondary">
            Rejoignez Prix du coeur
          </p>
        </div>
        <form className="mt-8 space-y-6 bg-theme-card p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-theme-secondary">
                  Prénom
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-theme-secondary">
                  Nom
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-theme-secondary">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-theme-secondary">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
              />
              <p className="mt-1 text-xs text-theme-tertiary">
                Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-secondary">
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
              />
            </div>
          </div>

          {/* Checkbox CGU */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="acceptCGU"
                name="acceptCGU"
                type="checkbox"
                checked={formData.acceptCGU}
                onChange={(e) => setFormData({ ...formData, acceptCGU: e.target.checked })}
                className="h-4 w-4 text-pdc-cyan-500 focus:ring-pdc-cyan-500 border-gray-300 rounded cursor-pointer"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="acceptCGU" className="text-theme-secondary cursor-pointer">
                J'accepte les{' '}
                <Link to="/cgu" target="_blank" className="text-pdc-cyan-500 hover:text-pdc-cyan-600 underline">
                  Conditions Générales d'Utilisation
                </Link>
                {' '}et la{' '}
                <Link to="/confidentialite" target="_blank" className="text-pdc-cyan-500 hover:text-pdc-cyan-600 underline">
                  Politique de Confidentialité
                </Link>
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: '#2e82c4', color: 'white' }}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-base font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <Link to="/login" className="block text-sm text-pdc-cyan hover:text-pdc-cyan-500">
              Déjà un compte ? Connectez-vous
            </Link>
            <Link to="/" className="block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              ← Retour à l'accueil
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

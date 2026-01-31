import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail, validatePassword } from '../utils/helpers';
import { EnvelopeIcon, DevicePhoneMobileIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState('totp'); // 'totp' or 'email'
  const [requiresEmailVerification, setRequiresEmailVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, loginWith2FA } = useAuth();

  // SEO: Mettre à jour le titre
  useEffect(() => {
    document.title = 'Connexion | Prix du Cœur - Gestion de Budget en Couple';
  }, []);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendMessage('');
    try {
      await api.post('/api/auth/resend-verification-public', { email: unverifiedEmail });
      setResendMessage('Email renvoyé ! Vérifiez votre boîte mail et vos spams.');
      setResendCooldown(60);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requires2FA) {
        await loginWith2FA(totpToken);
        navigate('/dashboard');
      } else {
        if (!validateEmail(email)) {
          setError('Email invalide');
          setLoading(false);
          return;
        }

        const result = await login(email, password);
        if (result.requires2FA) {
          setRequires2FA(true);
          setTwoFAMethod(result.method || 'totp');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      // Vérifier si c'est une erreur de vérification email
      if (err.response?.status === 403 && err.response?.data?.requiresEmailVerification) {
        setRequiresEmailVerification(true);
        setUnverifiedEmail(err.response?.data?.email || email);
      } else {
        setError(err.response?.data?.message || err.response?.data?.error || 'Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  // Écran de vérification email requise
  if (requiresEmailVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pdc-cyan-50 to-pdc-mint-50 py-8 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <ExclamationTriangleIcon className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Email non vérifié
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Vous devez vérifier votre email avant de vous connecter :
          </p>
          
          <p className="font-semibold text-lg text-pink-600 dark:text-pink-400 mb-6">
            {unverifiedEmail}
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              ⚠️ <strong>Astuce :</strong> L'email peut être dans vos <strong>spams</strong> ou courriers indésirables !
            </p>
          </div>
          
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
                Renvoyer l'email de vérification
              </>
            )}
          </button>
          
          <button
            onClick={() => {
              setRequiresEmailVerification(false);
              setUnverifiedEmail('');
              setResendMessage('');
            }}
            className="w-full px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pdc-cyan-50 to-pdc-mint-50 py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <h2 className="mt-4 sm:mt-6 text-center text-3xl sm:text-4xl font-extrabold text-theme-primary">
            💖 Prix du coeur
          </h2>
          <p className="mt-2 text-center text-sm text-theme-secondary">
            Gérez vos finances de couple en toute simplicité
          </p>
        </div>
        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6 bg-theme-card p-5 sm:p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!requires2FA ? (
            <>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email" className="sr-only">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-theme-primary placeholder-gray-500 dark:placeholder-gray-400 text-theme-primary rounded-t-md focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 focus:z-10 sm:text-sm bg-theme-card"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">Mot de passe</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-theme-primary placeholder-gray-500 dark:placeholder-gray-400 text-theme-primary rounded-b-md focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 focus:z-10 sm:text-sm bg-theme-card"
                    placeholder="Mot de passe"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                {twoFAMethod === 'email' ? (
                  <>
                    <div className="bg-pink-100 dark:bg-pink-900/30 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <EnvelopeIcon className="h-8 w-8 text-pink-500" />
                    </div>
                    <p className="text-sm text-theme-secondary mb-2">
                      Un code à 6 chiffres a été envoyé à<br />
                      <strong>{email}</strong>
                    </p>
                    <p className="text-xs text-theme-tertiary">
                      Vérifiez votre boîte mail (et les spams)
                    </p>
                  </>
                ) : (
                  <>
                    <div className="bg-purple-100 dark:bg-purple-900/30 rounded-full p-3 w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <DevicePhoneMobileIcon className="h-8 w-8 text-purple-500" />
                    </div>
                    <p className="text-sm text-theme-secondary mb-2">
                      Entrez le code de votre application d'authentification
                    </p>
                  </>
                )}
              </div>
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-theme-secondary mb-2">
                  Code à 6 chiffres
                </label>
                <input
                  id="totp"
                  name="totp"
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  required
                  autoFocus
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  className="appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm text-center text-2xl tracking-widest bg-theme-card text-theme-primary"
                  placeholder="000000"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setTotpToken('');
                  setError('');
                }}
                className="w-full text-sm text-theme-tertiary hover:text-pdc-cyan-500 py-2"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: '#2e82c4', color: 'white' }}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base font-semibold rounded-lg shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Connexion...' : requires2FA ? 'Valider le code 2FA' : 'Se connecter'}
            </button>
          </div>

          {!requires2FA && (
            <div className="text-center space-y-2">
              <Link to="/forgot-password" className="block text-sm text-theme-tertiary hover:text-pdc-cyan-500">
                Mot de passe oublié ?
              </Link>
              <Link to="/register" className="block text-sm text-pdc-cyan hover:text-pdc-cyan-500">
                Pas encore de compte ? Inscrivez-vous
              </Link>
              <Link to="/" className="block text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mt-4">
                ← Retour à l'accueil
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

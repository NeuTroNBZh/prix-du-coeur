import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { LockClosedIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Lien invalide. Aucun token de réinitialisation trouvé.');
    }
  }, [token]);

  const validatePassword = (pwd) => {
    if (pwd.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
    if (!/[A-Z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une majuscule';
    if (!/[a-z]/.test(pwd)) return 'Le mot de passe doit contenir au moins une minuscule';
    if (!/[0-9]/.test(pwd)) return 'Le mot de passe doit contenir au moins un chiffre';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);

    try {
      await api.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pdc-cyan-50 to-pdc-mint-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-4xl font-extrabold text-theme-primary">
            💖 Prix du coeur
          </h2>
          <p className="mt-2 text-center text-sm text-theme-secondary">
            Nouveau mot de passe
          </p>
        </div>

        <div className="bg-theme-card p-8 rounded-lg shadow-md">
          {success ? (
            <div className="text-center">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-theme-primary mb-2">
                Mot de passe réinitialisé !
              </h3>
              <p className="text-theme-secondary mb-6">
                Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers la page de connexion...
              </p>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 bg-pdc-cyan text-white rounded-lg hover:bg-pdc-cyan-dark"
              >
                Se connecter maintenant
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center">
              <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-theme-primary mb-2">
                Lien invalide
              </h3>
              <p className="text-theme-secondary mb-6">
                Ce lien de réinitialisation est invalide ou a expiré. Veuillez faire une nouvelle demande.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex items-center px-4 py-2 bg-pdc-cyan text-white rounded-lg hover:bg-pdc-cyan-dark"
              >
                Nouvelle demande
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <LockClosedIcon className="mx-auto h-12 w-12 text-pdc-cyan-500" />
              </div>
              
              <p className="text-theme-secondary text-center mb-6">
                Choisissez votre nouveau mot de passe.
              </p>

              {error && (
                <div className="rounded-md bg-red-50 p-4 mb-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-theme-secondary mb-1">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-theme-tertiary">
                    Min. 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-theme-secondary mb-1">
                    Confirmer le mot de passe
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#2e82c4', color: 'white' }}
                  className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-semibold rounded-lg shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-pdc-cyan hover:text-pdc-cyan-500">
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EnvelopeIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err) {
      // On affiche toujours un message de succès pour éviter l'énumération
      setSuccess(true);
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
            Réinitialisation du mot de passe
          </p>
        </div>

        <div className="bg-theme-card p-8 rounded-lg shadow-md">
          {success ? (
            <div className="text-center">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-theme-primary mb-2">
                Email envoyé !
              </h3>
              <p className="text-theme-secondary mb-6">
                Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation dans quelques minutes.
              </p>
              <p className="text-sm text-theme-tertiary mb-6">
                Pensez à vérifier vos spams si vous ne voyez pas l'email.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 bg-pdc-cyan text-white rounded-lg hover:bg-pdc-cyan-dark"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <EnvelopeIcon className="mx-auto h-12 w-12 text-pdc-cyan-500" />
              </div>
              
              <p className="text-theme-secondary text-center mb-6">
                Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              {error && (
                <div className="rounded-md bg-red-50 p-4 mb-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-theme-secondary mb-1">
                    Adresse email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-theme-primary rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 sm:text-sm bg-theme-card text-theme-primary"
                    placeholder="votre@email.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#2e82c4', color: 'white' }}
                  className="w-full flex justify-center py-3 px-4 border border-transparent text-base font-semibold rounded-lg shadow-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-pdc-cyan hover:text-pdc-cyan-500 flex items-center justify-center">
                  <ArrowLeftIcon className="h-4 w-4 mr-1" />
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

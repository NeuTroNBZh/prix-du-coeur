import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail, validatePassword } from '../utils/helpers';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, loginWith2FA } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (requires2FA) {
        await loginWith2FA(email, password, totpToken);
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
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <h2 className="mt-4 sm:mt-6 text-center text-3xl sm:text-4xl font-extrabold text-gray-900">
            💖 Prix du coeur
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Gérez vos finances de couple en toute simplicité
          </p>
        </div>
        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6 bg-white p-5 sm:p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
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
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
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
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                    placeholder="Mot de passe"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="totp" className="block text-sm font-medium text-gray-700 mb-2">
                Code 2FA (6 chiffres)
              </label>
              <input
                id="totp"
                name="totp"
                type="text"
                maxLength="6"
                required
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm text-center text-2xl tracking-widest"
                placeholder="000000"
              />
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50"
            >
              {loading ? 'Connexion...' : requires2FA ? 'Valider 2FA' : 'Se connecter'}
            </button>
          </div>

          {!requires2FA && (
            <div className="text-center space-y-2">
              <Link to="/forgot-password" className="block text-sm text-gray-500 hover:text-pink-500">
                Mot de passe oublié ?
              </Link>
              <Link to="/register" className="block text-sm text-pink-600 hover:text-pink-500">
                Pas encore de compte ? Inscrivez-vous
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

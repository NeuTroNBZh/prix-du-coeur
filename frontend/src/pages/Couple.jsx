import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { HeartIcon, UserPlusIcon, CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Couple() {
  const [couple, setCouple] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showBreakupModal, setShowBreakupModal] = useState(false);
  const [breaking, setBreaking] = useState(false);

  useEffect(() => {
    fetchCoupleStatus();
  }, []);

  const fetchCoupleStatus = async () => {
    try {
      const res = await api.get('/api/couple');
      setCouple(res.data.couple);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError('Erreur lors du chargement');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post('/api/couple/invite', { email: partnerEmail });
      setSuccess(res.data.message);
      setPartnerEmail('');
      fetchCoupleStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvite = async () => {
    try {
      await api.post('/api/couple/accept');
      setSuccess('Invitation acceptée !');
      fetchCoupleStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const handleBreakup = async () => {
    setBreaking(true);
    setError('');
    try {
      await api.delete('/api/couple/leave');
      setCouple(null);
      setShowBreakupModal(false);
      setSuccess('Vous avez quitté le couple.');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la rupture');
    } finally {
      setBreaking(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8 flex items-center">
          <HeartIcon className="h-6 w-6 sm:h-8 sm:w-8 text-pink-600 mr-2 sm:mr-3" />
          Mon Couple
        </h1>

        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm sm:text-base">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
            <p className="text-green-800 text-sm sm:text-base">{success}</p>
          </div>
        )}

        {couple ? (
          <div className="bg-white shadow rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Votre couple</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 sm:p-4 bg-pink-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {couple.partner?.firstName} {couple.partner?.lastName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{couple.partner?.email}</p>
                </div>
                <HeartIcon className="h-6 w-6 sm:h-8 sm:w-8 text-pink-500 flex-shrink-0 ml-2" />
              </div>
              <p className="text-xs sm:text-sm text-gray-500 text-center">
                Ensemble depuis le {new Date(couple.createdAt).toLocaleDateString('fr-FR')}
              </p>
              
              {/* Bouton de rupture */}
              <div className="pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowBreakupModal(true)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 mr-2" />
                  Rompre le couple
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Inviter votre partenaire
            </h2>
            <p className="text-gray-600 mb-6">
              Pour utiliser l'harmonisation des dépenses, invitez votre partenaire par email.
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email de votre partenaire
                </label>
                <div className="mt-1 flex">
                  <input
                    type="email"
                    id="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    required
                    className="flex-1 rounded-l-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 p-3 border"
                    placeholder="partenaire@email.com"
                  />
                  <button
                    type="submit"
                    disabled={inviting}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50"
                  >
                    <UserPlusIcon className="h-5 w-5 mr-2" />
                    {inviting ? 'Envoi...' : 'Inviter'}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 text-center">
                Votre partenaire doit d'abord créer un compte sur Prix du cœur
              </p>
            </div>
          </div>
        )}

        {/* Modal de confirmation de rupture */}
        {showBreakupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center mb-4">
                <div className="bg-red-100 rounded-full p-2 mr-3">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Rompre le couple ?</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                Êtes-vous sûr de vouloir rompre le couple ? Cette action est irréversible. 
                Les données d'harmonisation seront conservées mais vous ne pourrez plus 
                partager vos dépenses avec {couple?.partner?.firstName}.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBreakupModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
      </div>
    </>
  );
}

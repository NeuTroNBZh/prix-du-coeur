import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI } from '../services/api';
import { 
  UsersIcon, 
  ChartBarIcon, 
  ShieldCheckIcon,
  BuildingLibraryIcon,
  UserPlusIcon,
  UserMinusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  MapPinIcon,
  GlobeAltIcon,
  CalendarDaysIcon,
  BriefcaseIcon
} from '@heroicons/react/24/outline';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    // Check if user is admin
    if (!user?.isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, statsRes] = await Promise.all([
        adminAPI.getUsers(),
        adminAPI.getStats()
      ]);
      setUsers(usersRes.data.users || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      if (error.response?.status === 403) {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (userId, currentStatus) => {
    try {
      await adminAPI.toggleAdmin(userId, !currentStatus);
      setUsers(users.map(u => 
        u.id === userId ? { ...u, is_admin: !currentStatus } : u
      ));
      setToastMessage(currentStatus ? 'Administrateur retiré' : 'Administrateur ajouté');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (error) {
      console.error('Error toggling admin:', error);
      setToastMessage(error.response?.data?.message || 'Erreur lors de la modification');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await adminAPI.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setToastMessage('Utilisateur supprimé avec succès');
      setDeleteConfirm(null);
      setTimeout(() => setToastMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting user:', error);
      setToastMessage(error.response?.data?.message || 'Erreur lors de la suppression');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pdc-cyan"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-theme-card rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-theme-primary mb-2">Confirmer la suppression</h3>
              <p className="text-theme-secondary mb-4">
                Êtes-vous sûr de vouloir supprimer <strong>{deleteConfirm.email}</strong> ?
                <br />
                <span className="text-red-500 text-sm">Cette action est irréversible et supprimera toutes les données de l'utilisateur.</span>
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg border border-theme-primary text-theme-secondary hover:bg-theme-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteUser(deleteConfirm.id)}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-8 w-8 text-pdc-cyan" />
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary">
              Panel Administrateur
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-theme-primary mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('stats')}
              className={`${
                activeTab === 'stats'
                  ? 'border-pdc-cyan text-pdc-cyan'
                  : 'border-transparent text-theme-tertiary hover:text-theme-primary hover:border-theme-secondary'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <ChartBarIcon className="h-5 w-5" />
              Statistiques
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-pdc-cyan text-pdc-cyan'
                  : 'border-transparent text-theme-tertiary hover:text-theme-primary hover:border-theme-secondary'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <UsersIcon className="h-5 w-5" />
              Utilisateurs ({users.length})
            </button>
          </nav>
        </div>

        {/* Toast notification */}
        {toastMessage && (
          <div className="fixed top-20 right-4 bg-pdc-cyan text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
            {toastMessage}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <UsersIcon className="h-6 w-6 text-blue-500" />
                  <span className="text-theme-tertiary text-sm">Utilisateurs</span>
                </div>
                <p className="text-3xl font-bold text-theme-primary">{stats.users.total}</p>
                <p className="text-xs text-theme-tertiary mt-1">
                  +{stats.users.recentRegistrations} ces 30 jours
                </p>
              </div>

              <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <UsersIcon className="h-6 w-6 text-pink-500" />
                  <span className="text-theme-tertiary text-sm">En couple</span>
                </div>
                <p className="text-3xl font-bold text-theme-primary">{stats.users.couplePercentage}%</p>
                <p className="text-xs text-theme-tertiary mt-1">
                  {stats.users.inCouple} sur {stats.users.total} utilisateurs
                </p>
              </div>

              <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheckIcon className="h-6 w-6 text-green-500" />
                  <span className="text-theme-tertiary text-sm">2FA Activé</span>
                </div>
                <p className="text-3xl font-bold text-theme-primary">{stats.security.twoFAPercentage}%</p>
                <p className="text-xs text-theme-tertiary mt-1">
                  {stats.security.twoFAEnabled} utilisateurs sécurisés
                </p>
              </div>

              <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheckIcon className="h-6 w-6 text-pdc-cyan" />
                  <span className="text-theme-tertiary text-sm">Administrateurs</span>
                </div>
                <p className="text-3xl font-bold text-theme-primary">{stats.users.admins}</p>
              </div>
            </div>

            {/* Bank Stats */}
            {stats.banks && stats.banks.length > 0 && (
              <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <BuildingLibraryIcon className="h-6 w-6 text-purple-500" />
                  <h3 className="text-lg font-semibold text-theme-primary">Banques les plus utilisées</h3>
                </div>
                <div className="space-y-3">
                  {stats.banks.map((bank, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-theme-secondary">{bank.account_name || 'Non spécifié'}</span>
                      <span className="bg-theme-secondary px-2 py-1 rounded text-sm text-theme-primary">
                        {bank.count} comptes
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction Stats */}
            <div className="bg-theme-card rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <ChartBarIcon className="h-6 w-6 text-orange-500" />
                <h3 className="text-lg font-semibold text-theme-primary">Transactions globales</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-theme-secondary rounded-lg">
                  <p className="text-2xl font-bold text-theme-primary">{stats.transactions.total.toLocaleString()}</p>
                  <p className="text-sm text-theme-tertiary">Total transactions</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{Math.abs(stats.transactions.totalExpenses).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
                  <p className="text-sm text-theme-tertiary">Total dépenses</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats.transactions.totalIncome.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
                  <p className="text-sm text-theme-tertiary">Total revenus</p>
                </div>
              </div>
            </div>

            {/* Location Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Country */}
              {stats.locations?.byCountry && stats.locations.byCountry.length > 0 && (
                <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <GlobeAltIcon className="h-6 w-6 text-blue-500" />
                    <h3 className="text-lg font-semibold text-theme-primary">Utilisateurs par pays</h3>
                  </div>
                  <div className="space-y-3">
                    {stats.locations.byCountry.map((loc, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-theme-secondary">{loc.country}</span>
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-sm">
                          {loc.count} utilisateurs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By City */}
              {stats.locations?.byCity && stats.locations.byCity.length > 0 && (
                <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <MapPinIcon className="h-6 w-6 text-red-500" />
                    <h3 className="text-lg font-semibold text-theme-primary">Top villes</h3>
                  </div>
                  <div className="space-y-3">
                    {stats.locations.byCity.map((loc, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-theme-secondary">
                          {loc.city}
                          {loc.country && <span className="text-theme-tertiary text-xs ml-1">({loc.country})</span>}
                        </span>
                        <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded text-sm">
                          {loc.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Demographics Stats - Age and Profession */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Age */}
              {stats.demographics?.byAge && stats.demographics.byAge.length > 0 && (
                <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <CalendarDaysIcon className="h-6 w-6 text-purple-500" />
                      <h3 className="text-lg font-semibold text-theme-primary">Répartition par âge</h3>
                    </div>
                    {stats.demographics.averageAge && (
                      <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-medium">
                        Moyenne: {stats.demographics.averageAge} ans
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {stats.demographics.byAge.map((age, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-theme-secondary">{age.age_range}</span>
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-sm">
                          {age.count} utilisateurs
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By Profession */}
              {stats.demographics?.byProfession && stats.demographics.byProfession.length > 0 && (
                <div className="bg-theme-card rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <BriefcaseIcon className="h-6 w-6 text-amber-500" />
                    <h3 className="text-lg font-semibold text-theme-primary">Répartition par profession</h3>
                  </div>
                  <div className="space-y-3">
                    {stats.demographics.byProfession.map((prof, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-theme-secondary">{prof.profession}</span>
                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded text-sm">
                          {prof.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-theme-tertiary" />
              <input
                type="text"
                placeholder="Rechercher par email, nom ou localisation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-theme-primary rounded-lg bg-theme-card text-theme-primary placeholder-theme-tertiary focus:ring-2 focus:ring-pdc-cyan focus:border-transparent"
              />
            </div>

            {/* Users List */}
            <div className="bg-theme-card rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-theme-primary">
                  <thead className="bg-theme-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Utilisateur
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Localisation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Inscrit le
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-secondary">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-theme-secondary/50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pdc-cyan to-pdc-mint flex items-center justify-center text-white font-semibold">
                              {(u.first_name?.[0] || u.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-theme-primary">
                                {u.first_name} {u.last_name}
                              </p>
                              {u.is_admin && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pdc-cyan text-white">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-theme-secondary">
                          {u.email}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {u.is_in_couple ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">
                                En couple
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                Célibataire
                              </span>
                            )}
                            {u.totp_enabled ? (
                              <CheckCircleIcon className="h-5 w-5 text-green-500" title="2FA activé" />
                            ) : (
                              <XCircleIcon className="h-5 w-5 text-gray-300" title="2FA désactivé" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {u.city || u.country ? (
                            <div className="flex items-center gap-1">
                              <MapPinIcon className="h-4 w-4 text-theme-tertiary" />
                              <span className="text-theme-secondary">
                                {u.city && u.country ? `${u.city}, ${u.country}` : (u.city || u.country)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-theme-tertiary italic">Non renseigné</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-theme-tertiary">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                          {u.id !== user?.id && (
                            <>
                              <button
                                onClick={() => handleToggleAdmin(u.id, u.is_admin)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  u.is_admin
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                                }`}
                              >
                                {u.is_admin ? (
                                  <>
                                    <UserMinusIcon className="h-4 w-4" />
                                    <span className="hidden sm:inline">Retirer admin</span>
                                  </>
                                ) : (
                                  <>
                                    <UserPlusIcon className="h-4 w-4" />
                                    <span className="hidden sm:inline">Admin</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(u)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                                title="Supprimer l'utilisateur"
                              >
                                <TrashIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Supprimer</span>
                              </button>
                            </>
                          )}
                          {u.id === user?.id && (
                            <span className="text-sm text-theme-tertiary italic">Vous</span>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-theme-tertiary">
                  Aucun utilisateur trouvé
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-theme-card rounded-xl p-6 max-w-md w-full shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-theme-primary">Supprimer l'utilisateur</h3>
              </div>
              <p className="text-theme-secondary mb-2">
                Êtes-vous sûr de vouloir supprimer cet utilisateur ?
              </p>
              <div className="bg-theme-secondary rounded-lg p-3 mb-4">
                <p className="font-medium text-theme-primary">{deleteConfirm.first_name} {deleteConfirm.last_name}</p>
                <p className="text-sm text-theme-tertiary">{deleteConfirm.email}</p>
                {(deleteConfirm.city || deleteConfirm.country) && (
                  <p className="text-sm text-theme-tertiary flex items-center gap-1 mt-1">
                    <MapPinIcon className="h-4 w-4" />
                    {deleteConfirm.city && deleteConfirm.country ? `${deleteConfirm.city}, ${deleteConfirm.country}` : (deleteConfirm.city || deleteConfirm.country)}
                  </p>
                )}
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                ⚠️ Cette action est irréversible. Toutes les données de l'utilisateur seront supprimées.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-theme-primary rounded-lg text-theme-secondary hover:bg-theme-secondary transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleDeleteUser(deleteConfirm.id)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

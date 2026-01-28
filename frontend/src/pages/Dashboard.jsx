import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import AIClassificationPanel from '../components/AIClassificationPanel';
import { harmonizationAPI, transactionAPI } from '../services/api';
import api from '../services/api';
import { formatCurrency, formatDate, getCategoryColor } from '../utils/helpers';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BanknotesIcon, CreditCardIcon, CalendarDaysIcon, ChartBarIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function Dashboard() {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCouple, setNoCouple] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [recurring, setRecurring] = useState(null);
  
  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  // AI Learning management
  const [showLearningModal, setShowLearningModal] = useState(false);
  const [learningEntries, setLearningEntries] = useState([]);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [learningLoading, setLearningLoading] = useState(false);

  // Get month boundaries for API calls
  const getMonthDates = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    return { startDate, endDate };
  };

  // Format month for display
  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  // Navigate months
  const goToPreviousMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 2);
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const goToNextMonth = () => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month);
    const now = new Date();
    if (newDate <= now) {
      setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  const isCurrentMonth = () => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return currentMonth === current;
  };

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    try {
      const { startDate, endDate } = getMonthDates(currentMonth);
      
      // Always fetch personal data with month filter for analytics
      const [transactionsRes, accountsRes, analyticsRes, recurringRes] = await Promise.all([
        transactionAPI.getTransactions({ limit: 10 }),
        api.get('/api/transactions/accounts'),
        api.get(`/api/transactions/analytics?startDate=${startDate}&endDate=${endDate}`),
        api.get('/api/transactions/recurring')
      ]);
      
      setTransactions(transactionsRes.data.transactions || []);
      setAccounts(accountsRes.data.accounts || []);
      setAnalytics(analyticsRes.data);
      setRecurring(recurringRes.data);
      
      // Try to fetch couple balance (may fail if no couple)
      try {
        const balanceRes = await harmonizationAPI.getBalance();
        setBalance(balanceRes.data);
      } catch (error) {
        if (error.response?.status === 404 && error.response?.data?.error === 'No couple found') {
          setNoCouple(true);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch AI learning entries
  const fetchLearningEntries = async () => {
    setLearningLoading(true);
    try {
      const res = await api.get('/api/classify/learning');
      setLearningEntries(res.data.data?.entries || []);
    } catch (error) {
      console.error('Error fetching learning entries:', error);
    } finally {
      setLearningLoading(false);
    }
  };

  // Delete learning entries
  const deleteLearningEntries = async (all = false) => {
    try {
      const body = all ? { all: true } : { ids: selectedEntries };
      await api.delete('/api/classify/learning', { data: body });
      await fetchLearningEntries();
      setSelectedEntries([]);
    } catch (error) {
      console.error('Error deleting learning entries:', error);
    }
  };

  // Open learning modal
  const openLearningModal = () => {
    setShowLearningModal(true);
    fetchLearningEntries();
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

  if (noCouple) {
    // Calculate personal stats
    const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const monthlyExpenses = Math.abs(analytics?.totalExpenses || 0);
    const monthlyIncome = analytics?.totalIncome || 0;
    const subscriptionCount = recurring?.recurring?.length || 0;
    const monthlySubscriptions = recurring?.recurring
      ?.filter(s => s.frequency === 'monthly' || s.frequency === 'manual')
      ?.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0) || 0;

    // Category breakdown for pie chart (exclude internal transfers)
    const categoryData = analytics?.byCategory 
      ? Object.entries(analytics.byCategory)
          .filter(([name, value]) => parseFloat(value) < 0 && name !== 'Virement interne')
          .map(([name, value]) => ({
            name,
            value: Math.abs(parseFloat(value))
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 6)
      : [];

    const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

    return (
      <>
        <Navbar />
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-8">Tableau de bord</h1>
          
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-lg font-semibold text-gray-900 min-w-[180px] text-center capitalize">
              {formatMonth(currentMonth)}
            </span>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth()}
              className={`p-2 rounded-full transition-colors ${isCurrentMonth() ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <ChevronRightIcon className={`h-5 w-5 ${isCurrentMonth() ? 'text-gray-300' : 'text-gray-600'}`} />
            </button>
          </div>
          
          {/* Invite Partner Banner */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">Gérez vos finances en couple 💕</h2>
                <p className="text-sm sm:text-base text-gray-600">
                  Invitez votre partenaire pour harmoniser vos dépenses communes.
                </p>
              </div>
              <a 
                href="/couple" 
                className="px-4 sm:px-6 py-2 sm:py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium text-center text-sm sm:text-base"
              >
                Inviter mon partenaire
              </a>
            </div>
          </div>

          {/* Personal Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-3 sm:p-5">
                <div className="flex items-center">
                  <BanknotesIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">Solde total</dt>
                    <dd className={`text-lg sm:text-2xl font-semibold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(totalBalance)}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-3 sm:p-5">
                <div className="flex items-center">
                  <CreditCardIcon className="h-6 w-6 sm:h-8 sm:w-8 text-pink-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">Dépenses</dt>
                    <dd className="text-lg sm:text-2xl font-semibold text-red-600">
                      {formatCurrency(monthlyExpenses)}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-3 sm:p-5">
                <div className="flex items-center">
                  <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">Revenus</dt>
                    <dd className="text-lg sm:text-2xl font-semibold text-green-600">
                      {formatCurrency(monthlyIncome)}
                    </dd>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-3 sm:p-5">
                <div className="flex items-center">
                  <CalendarDaysIcon className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 mr-2 sm:mr-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">Abonnements</dt>
                    <dd className="text-lg sm:text-2xl font-semibold text-gray-900">
                      {subscriptionCount}
                    </dd>
                    <p className="text-xs text-gray-500 hidden sm:block">{formatCurrency(monthlySubscriptions)}/mois</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Classification Panel */}
          <div className="mb-6 sm:mb-8">
            <AIClassificationPanel />
            <div className="mt-3 flex justify-end">
              <button
                onClick={openLearningModal}
                className="text-sm text-gray-500 hover:text-pink-600 flex items-center gap-1"
              >
                <TrashIcon className="h-4 w-4" />
                Gérer l'apprentissage IA
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:gap-8 mb-6 sm:mb-8">
            {/* Accounts */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Mes comptes</h2>
                <a href="/accounts" className="text-pink-600 hover:text-pink-700 text-sm">Voir tout →</a>
              </div>
              {accounts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Aucun compte configuré</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {accounts.slice(0, 4).map((account) => (
                    <div key={account.id} className="flex justify-between items-center p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{account.name}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{account.bank_name}</p>
                      </div>
                      <span className={`font-semibold text-sm sm:text-base ml-2 ${parseFloat(account.balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Breakdown */}
            {categoryData.length > 0 && (
              <div className="bg-white shadow rounded-lg p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Dépenses par catégorie</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-4 sm:px-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Transactions récentes</h3>
              <a href="/accounts" className="text-pink-600 hover:text-pink-700 text-sm">Voir tout →</a>
            </div>
            <div className="p-3 sm:p-4">
              {transactions.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-gray-500 mb-4 text-sm sm:text-base">Aucune transaction importée</p>
                  <a href="/import" className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm">
                    Importer mes relevés
                  </a>
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {transactions.map((tx, idx) => (
                    <li key={idx} className="py-2 sm:py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-gray-900 text-sm sm:text-base block truncate">{tx.label}</span>
                          <span className="text-xs text-gray-500">{formatDate(tx.date)}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded-full hidden sm:inline-block ${getCategoryColor(tx.category)}`}>
                            {tx.category}
                          </span>
                          <span className={`text-sm sm:text-base font-medium whitespace-nowrap ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* AI Learning Management Modal */}
          {showLearningModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Apprentissage IA</h3>
                  <button
                    onClick={() => setShowLearningModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {learningLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
                    </div>
                  ) : learningEntries.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Aucune correction enregistrée pour l'apprentissage IA.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-sm text-gray-600">
                          {learningEntries.length} correction(s) mémorisée(s)
                        </p>
                        <button
                          onClick={() => {
                            if (confirm('Supprimer TOUTES les corrections mémorisées ?')) {
                              deleteLearningEntries(true);
                            }
                          }}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Tout supprimer
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {learningEntries.map((entry) => (
                          <div 
                            key={entry.id} 
                            className={`p-3 rounded-lg border ${selectedEntries.includes(entry.id) ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-gray-50'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{entry.label}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {entry.original_type}/{entry.original_category} → <span className="text-pink-600 font-medium">{entry.corrected_type}/{entry.corrected_category}</span>
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedEntries.includes(entry.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEntries([...selectedEntries, entry.id]);
                                  } else {
                                    setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                                  }
                                }}
                                className="h-4 w-4 text-pink-600 rounded"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {selectedEntries.length > 0 && (
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                          <span className="text-sm text-gray-600">{selectedEntries.length} sélectionné(s)</span>
                          <button
                            onClick={() => deleteLearningEntries(false)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2"
                          >
                            <TrashIcon className="h-4 w-4" />
                            Supprimer la sélection
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShowLearningModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  const categoryData = balance?.categoryBreakdown 
    ? Object.entries(balance.categoryBreakdown)
        .filter(([name, _]) => name !== 'Virement interne')
        .map(([name, value]) => ({
          name,
          value: parseFloat(value)
        }))
    : [];

  const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Calculate stats for couple mode
  const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  const monthlyExpenses = Math.abs(analytics?.totalExpenses || 0);
  const monthlyIncome = analytics?.totalIncome || 0;

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Tableau de bord</h1>

        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[180px] text-center capitalize">
            {formatMonth(currentMonth)}
          </span>
          <button
            onClick={goToNextMonth}
            disabled={isCurrentMonth()}
            className={`p-2 rounded-full transition-colors ${isCurrentMonth() ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
          >
            <ChevronRightIcon className={`h-5 w-5 ${isCurrentMonth() ? 'text-gray-300' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4">
              <div className="flex items-center">
                <BanknotesIcon className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <dt className="text-sm font-medium text-gray-500 truncate">Solde total</dt>
                  <dd className={`text-2xl font-semibold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalBalance)}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4">
              <div className="flex items-center">
                <CreditCardIcon className="h-8 w-8 text-pink-500 mr-3" />
                <div>
                  <dt className="text-sm font-medium text-gray-500 truncate">Dépenses</dt>
                  <dd className="text-2xl font-semibold text-red-600">
                    {formatCurrency(monthlyExpenses)}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4">
              <div className="flex items-center">
                <ChartBarIcon className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <dt className="text-sm font-medium text-gray-500 truncate">Revenus</dt>
                  <dd className="text-2xl font-semibold text-green-600">
                    {formatCurrency(monthlyIncome)}
                  </dd>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4">
              <div className="flex items-center">
                <CalendarDaysIcon className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <dt className="text-sm font-medium text-gray-500 truncate">Balance</dt>
                  <dd className={`text-2xl font-semibold ${monthlyIncome - monthlyExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(monthlyIncome - monthlyExpenses)}
                  </dd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Classification Panel */}
        <div className="mb-8">
          <AIClassificationPanel />
          <div className="mt-3 flex justify-end">
            <button
              onClick={openLearningModal}
              className="text-sm text-gray-500 hover:text-pink-600 flex items-center gap-1"
            >
              <TrashIcon className="h-4 w-4" />
              Gérer l'apprentissage IA
            </button>
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryData.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Dépenses par catégorie
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Transactions récentes
            </h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <li key={transaction.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {transaction.label}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(transaction.date)}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(transaction.category)}`}>
                      {transaction.category}
                    </span>
                    <p className={`text-sm font-semibold ${
                      transaction.amount >= 0 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* AI Learning Management Modal */}
        {showLearningModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Apprentissage IA</h3>
                <button
                  onClick={() => setShowLearningModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {learningLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600"></div>
                  </div>
                ) : learningEntries.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Aucune correction enregistrée pour l'apprentissage IA.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm text-gray-600">
                        {learningEntries.length} correction(s) mémorisée(s)
                      </p>
                      <button
                        onClick={() => {
                          if (confirm('Supprimer TOUTES les corrections mémorisées ?')) {
                            deleteLearningEntries(true);
                          }
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded flex items-center gap-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Tout supprimer
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {learningEntries.map((entry) => (
                        <div 
                          key={entry.id} 
                          className={`p-3 rounded-lg border ${selectedEntries.includes(entry.id) ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-gray-50'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{entry.label}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {entry.original_type}/{entry.original_category} → <span className="text-pink-600 font-medium">{entry.corrected_type}/{entry.corrected_category}</span>
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedEntries.includes(entry.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedEntries([...selectedEntries, entry.id]);
                                } else {
                                  setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                                }
                              }}
                              className="h-4 w-4 text-pink-600 rounded"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {selectedEntries.length > 0 && (
                      <div className="mt-4 pt-4 border-t flex justify-between items-center">
                        <span className="text-sm text-gray-600">{selectedEntries.length} sélectionné(s)</span>
                        <button
                          onClick={() => deleteLearningEntries(false)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center gap-2"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Supprimer la sélection
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowLearningModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

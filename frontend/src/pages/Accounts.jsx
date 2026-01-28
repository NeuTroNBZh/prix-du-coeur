import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import ClassificationCorrectionModal from '../components/ClassificationCorrectionModal';
import { 
  BanknotesIcon, 
  PencilIcon, 
  CheckIcon,
  XMarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  FunnelIcon,
  PencilSquareIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

const COLORS = ['#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#f43f5e'];

const FREQUENCY_LABELS = {
  monthly: 'Mensuel',
  weekly: 'Hebdomadaire',
  quarterly: 'Trimestriel',
  yearly: 'Annuel'
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editBalance, setEditBalance] = useState('');
  const [editDate, setEditDate] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [evolution, setEvolution] = useState(null);
  
  // New states for analytics
  const [activeTab, setActiveTab] = useState('accounts'); // accounts, analytics, recurring
  const [analytics, setAnalytics] = useState(null);
  const [recurring, setRecurring] = useState(null);
  const [allTransactions, setAllTransactions] = useState([]);
  const [subscriptionSettings, setSubscriptionSettings] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [savingSubscription, setSavingSubscription] = useState(null);
  const [editingSubscriptionCategory, setEditingSubscriptionCategory] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date()); // Current viewed month
  
  // Delete account modal
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Analytics filter states
  const [analyticsYear, setAnalyticsYear] = useState('all');
  const [analyticsMonth, setAnalyticsMonth] = useState('all');
  const [analyticsAccount, setAnalyticsAccount] = useState('all');
  
  // Correction modal
  const [showClassifyModal, setShowClassifyModal] = useState(null);
  
  // Edit label state
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  
  // Edit amount state
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

  useEffect(() => {
    fetchAccounts();
    fetchAnalytics();
    fetchRecurring();
    fetchAllTransactions();
    fetchSubscriptionSettings();
  }, []);

  const fetchSubscriptionSettings = async () => {
    try {
      const response = await api.get('/api/transactions/subscriptions/settings');
      // Store current user ID for determining who pays
      if (response.data.currentUserId) {
        setCurrentUserId(response.data.currentUserId);
      }
      // Convert array to map for easy lookup: key -> { isShared, frequency, payerUserId, payerName }
      const settingsMap = {};
      (response.data.settings || []).forEach(s => {
        const normalizedAmount = parseFloat(s.amount);
        const key = `${s.label}_${normalizedAmount}`;
        settingsMap[key] = { 
          isShared: s.is_shared, 
          frequency: s.frequency || 'monthly',
          payerUserId: s.payer_user_id,
          payerName: s.payer_name || 'Inconnu'
        };
      });
      setSubscriptionSettings(settingsMap);
    } catch (err) {
      console.error('Subscription settings error:', err);
    }
  };

  const toggleSubscriptionShared = async (sub) => {
    const key = `${sub.label}_${sub.amount}`;
    const current = subscriptionSettings[key] || { isShared: false, frequency: 'monthly' };
    const newShared = !current.isShared;
    
    setSavingSubscription(key);
    try {
      await api.put('/api/transactions/subscriptions/settings', {
        label: sub.label,
        amount: sub.amount,
        isShared: newShared,
        frequency: current.frequency,
        
      });
      setSubscriptionSettings(prev => ({ 
        ...prev, 
        [key]: { ...current, isShared: newShared } 
      }));
    } catch (err) {
      console.error('Toggle subscription error:', err);
    } finally {
      setSavingSubscription(null);
    }
  };

  const updateSubscriptionFrequency = async (sub, newFrequency) => {
    const key = `${sub.label}_${sub.amount}`;
    const current = subscriptionSettings[key] || { isShared: false, frequency: 'monthly' };
    
    setSavingSubscription(key);
    try {
      await api.put('/api/transactions/subscriptions/settings', {
        label: sub.label,
        amount: sub.amount,
        isShared: current.isShared,
        frequency: newFrequency,
        
      });
      setSubscriptionSettings(prev => ({ 
        ...prev, 
        [key]: { ...current, frequency: newFrequency } 
      }));
    } catch (err) {
      console.error('Update frequency error:', err);
    } finally {
      setSavingSubscription(null);
    }
  };

  // Get effective amount for display (ma part)
  const getEffectiveAmount = (sub) => {
    const key = `${sub.label}_${sub.amount}`;
    const settings = subscriptionSettings[key];
    const isShared = settings?.isShared || false;
    return isShared ? sub.amount / 2 : sub.amount;
  };

  // Get effective monthly amount (for average monthly calculation)
  // Divides annual by 12, quarterly by 3, etc.
  const getMonthlyEquivalent = (sub) => {
    const key = `${sub.label}_${sub.amount}`;
    const settings = subscriptionSettings[key] || {};
    const frequency = settings.frequency || sub.frequency || 'monthly';
    const baseAmount = getEffectiveAmount(sub);
    
    switch (frequency) {
      case 'yearly':
        return baseAmount / 12;
      case 'semiannual':
        return baseAmount / 6;
      case 'quarterly':
        return baseAmount / 3;
      case 'weekly':
        return baseAmount * 4.33; // ~4.33 weeks per month
      default:
        return baseAmount;
    }
  };

  // Get calendar amount (what I need to have on my account)
  const getCalendarAmount = (sub) => {
    const key = `${sub.label}_${sub.amount}`;
    const settings = subscriptionSettings[key];
    const isShared = settings?.isShared || false;
    const iPay = settings?.payerUserId === currentUserId;
    
    if (isShared) {
      // If shared: show full amount if I pay, 0 if the other person pays
      return iPay ? sub.amount : 0;
    }
    // Not shared: always full amount
    return sub.amount;
  };

  // Check if subscription is due in a given month
  const isSubscriptionDueInMonth = (sub, targetMonth, targetYear) => {
    const key = `${sub.label}_${sub.amount}`;
    const settings = subscriptionSettings[key] || {};
    const frequency = settings.frequency || sub.frequency || 'monthly';
    
    // Get the first occurrence month
    const firstDate = new Date(sub.firstDate || sub.lastDate);
    const firstMonth = firstDate.getMonth();
    
    if (frequency === 'monthly' || frequency === 'manual') {
      return true; // Monthly is always due
    } else if (frequency === 'quarterly') {
      // Every 3 months from first occurrence
      const monthDiff = (targetYear * 12 + targetMonth) - (firstDate.getFullYear() * 12 + firstMonth);
      return monthDiff >= 0 && monthDiff % 3 === 0;
    } else if (frequency === 'semiannual') {
      // Every 6 months from first occurrence
      const monthDiff = (targetYear * 12 + targetMonth) - (firstDate.getFullYear() * 12 + firstMonth);
      return monthDiff >= 0 && monthDiff % 6 === 0;
    } else if (frequency === 'yearly') {
      // Same month each year
      return targetMonth === firstMonth;
    }
    return true;
  };

  const updateSubscriptionCategory = async (sub, newCategory) => {
    try {
      await api.put('/api/transactions/subscriptions/category', {
        transactionIds: sub.transactionIds,
        category: newCategory
      });
      // Refresh recurring data
      await fetchRecurring();
      setEditingSubscriptionCategory(null);
    } catch (err) {
      console.error('Update subscription category error:', err);
      setError('Erreur lors de la mise à jour: ' + (err.response?.data?.error || err.message));
    }
  };

  const CATEGORIES_LIST = [
    'Courses', 'Restaurant', 'Transport', 'Logement', 'Loisirs',
    'Santé', 'Shopping', 'Abonnements', 'Vacances', 'Cadeaux', 'Revenus', 'Virement interne', 'Autre'
  ];

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/api/transactions/accounts');
      console.log('Accounts response:', response.data);
      setAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Accounts error:', err);
      setError('Erreur lors du chargement des comptes: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/api/transactions/analytics');
      setAnalytics(response.data);
    } catch (err) {
      console.error('Analytics error:', err);
    }
  };

  const fetchRecurring = async () => {
    try {
      const response = await api.get('/api/transactions/recurring');
      setRecurring(response.data);
    } catch (err) {
      console.error('Recurring error:', err);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const response = await api.get('/api/transactions?limit=500');
      setAllTransactions(response.data.transactions || []);
    } catch (err) {
      console.error('Transactions error:', err);
    }
  };

  // Edit label functions
  const startEditLabel = (tx) => {
    setEditingLabelId(tx.id);
    setEditingLabelValue(tx.label);
  };

  const cancelEditLabel = () => {
    setEditingLabelId(null);
    setEditingLabelValue('');
  };

  const saveLabel = async (txId) => {
    try {
      await api.patch(`/api/transactions/${txId}/label`, { label: editingLabelValue });
      // Update local state
      setAllTransactions(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, label: editingLabelValue } : tx
      ));
      setEditingLabelId(null);
      setEditingLabelValue('');
    } catch (err) {
      setError('Erreur lors de la modification du libellé');
    }
  };

  // Edit amount functions
  const startEditAmount = (tx) => {
    setEditingAmountId(tx.id);
    setEditingAmountValue(tx.amount.toString());
  };

  const cancelEditAmount = () => {
    setEditingAmountId(null);
    setEditingAmountValue('');
  };

  const saveAmount = async (txId) => {
    try {
      const newAmount = parseFloat(editingAmountValue);
      if (isNaN(newAmount)) {
        setError('Montant invalide');
        return;
      }
      await api.patch(`/api/transactions/${txId}/amount`, { amount: newAmount });
      // Update local state
      setAllTransactions(prev => prev.map(tx => 
        tx.id === txId ? { ...tx, amount: newAmount } : tx
      ));
      setEditingAmountId(null);
      setEditingAmountValue('');
      // Refresh accounts to update balances
      fetchAccounts();
    } catch (err) {
      setError('Erreur lors de la modification du montant');
    }
  };

  // Get unique years and months from transactions
  const { years, months, categories } = useMemo(() => {
    const yearsSet = new Set();
    const monthsSet = new Set();
    const categoriesSet = new Set();
    
    allTransactions.forEach(tx => {
      const date = new Date(tx.date);
      yearsSet.add(date.getFullYear());
      monthsSet.add(date.getMonth());
      if (tx.category) categoriesSet.add(tx.category);
    });
    
    return {
      years: Array.from(yearsSet).sort((a, b) => b - a),
      months: Array.from(monthsSet).sort((a, b) => a - b),
      categories: Array.from(categoriesSet).sort()
    };
  }, [allTransactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      const date = new Date(tx.date);
      
      if (selectedYear !== 'all' && date.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== 'all' && date.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedType !== 'all' && tx.type !== selectedType) return false;
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false;
      
      // Search filter - search in label or amount
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const label = (tx.label || '').toLowerCase();
        const amount = Math.abs(parseFloat(tx.amount)).toFixed(2);
        const amountInt = Math.abs(parseFloat(tx.amount)).toFixed(0);
        
        // Match label OR amount (with or without decimals)
        if (!label.includes(query) && !amount.includes(query) && !amountInt.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  }, [allTransactions, selectedYear, selectedMonth, selectedType, selectedCategory, searchQuery]);

  // Filtered analytics data
  const filteredAnalytics = useMemo(() => {
    if (!allTransactions.length) return null;
    
    // Filter transactions for analytics - only expenses (negative amounts), exclude Revenus category
    const filtered = allTransactions.filter(tx => {
      const date = new Date(tx.date);
      if (analyticsYear !== 'all' && date.getFullYear() !== parseInt(analyticsYear)) return false;
      if (analyticsMonth !== 'all' && date.getMonth() !== parseInt(analyticsMonth)) return false;
      if (analyticsAccount !== 'all' && tx.account_id !== parseInt(analyticsAccount)) return false;
      // Only expenses (negative amounts) and exclude Revenus category and internal transfers
      return parseFloat(tx.amount) < 0 && tx.category !== 'Revenus' && tx.type !== 'virement_interne' && tx.category !== 'Virement interne';
    });

    if (!filtered.length) return null;

    // Calculate totals
    const totalSpent = filtered.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0);
    
    // Group by category
    const categoryMap = {};
    filtered.forEach(tx => {
      const cat = tx.category || 'Autre';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, total: 0, count: 0 };
      }
      categoryMap[cat].total += Math.abs(parseFloat(tx.amount));
      categoryMap[cat].count += 1;
    });
    const byCategory = Object.values(categoryMap).sort((a, b) => b.total - a.total);

    // Calculate number of months for average
    const monthsSet = new Set();
    filtered.forEach(tx => {
      const date = new Date(tx.date);
      monthsSet.add(`${date.getFullYear()}-${date.getMonth()}`);
    });
    const numMonths = monthsSet.size || 1;

    return {
      totals: {
        total_spent: totalSpent,
        total_transactions: filtered.length,
        num_months: numMonths,
        monthly_average: totalSpent / numMonths
      },
      byCategory,
      isFiltered: analyticsYear !== 'all' || analyticsMonth !== 'all' || analyticsAccount !== 'all'
    };
  }, [allTransactions, analyticsYear, analyticsMonth, analyticsAccount]);

  const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  const startEdit = (account) => {
    setEditingId(account.id);
    setEditBalance(account.reference_balance || '0');
    setEditDate(account.reference_date || new Date().toISOString().split('T')[0]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBalance('');
    setEditDate('');
  };

  const handleDeleteAccount = async (accountId) => {
    setDeletingAccount(true);
    try {
      await api.delete(`/api/transactions/accounts/${accountId}`);
      setShowDeleteAccountModal(null);
      // Refresh data
      await Promise.all([fetchAccounts(), fetchAllTransactions(), fetchAnalytics()]);
      setSelectedAccount(null);
      setEvolution(null);
    } catch (err) {
      setError('Erreur lors de la suppression: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingAccount(false);
    }
  };

  const saveBalance = async (accountId) => {
    try {
      await api.put(`/api/transactions/accounts/${accountId}/balance`, {
        referenceBalance: parseFloat(editBalance),
        referenceDate: editDate
      });
      
      // Refresh accounts
      await fetchAccounts();
      setEditingId(null);
    } catch (err) {
      setError('Erreur lors de la mise à jour du solde');
    }
  };

  const loadEvolution = async (account) => {
    setSelectedAccount(account);
    try {
      const response = await api.get(`/api/transactions/accounts/${account.id}/evolution`);
      setEvolution(response.data);
    } catch (err) {
      console.error('Error loading evolution:', err);
      setEvolution(null);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Header with tabs */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Mes finances</h1>
          </div>

          {/* Tabs - scrollable on mobile */}
          <div className="border-b border-gray-200 -mx-3 px-3 sm:mx-0 sm:px-0">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto pb-px">
              <button
                onClick={() => setActiveTab('accounts')}
                className={`${
                  activeTab === 'accounts'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 flex-shrink-0`}
              >
                <BanknotesIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Comptes</span>
                <span className="hidden sm:inline">({accounts.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`${
                  activeTab === 'analytics'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 flex-shrink-0`}
              >
                <ChartBarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Analyse</span>
              </button>
              <button
                onClick={() => setActiveTab('recurring')}
                className={`${
                  activeTab === 'recurring'
                    ? 'border-pink-500 text-pink-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 flex-shrink-0`}
              >
                <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Abonnements</span>
                <span className="hidden sm:inline">({recurring?.recurring?.length || 0})</span>
              </button>
            </nav>
          </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <>
          {accounts.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6 sm:p-8 text-center">
              <BanknotesIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-2">Aucun compte</h3>
              <p className="text-sm sm:text-base text-gray-500">
                Importez un fichier CSV depuis la page Import pour ajouter vos comptes.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
              {accounts.map((account) => (
                <div 
                  key={account.id} 
                  className={`bg-white rounded-xl shadow p-4 sm:p-6 transition-all cursor-pointer
                    ${selectedAccount?.id === account.id ? 'ring-2 ring-pink-500' : 'hover:shadow-lg'}`}
                  onClick={() => loadEvolution(account)}
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-800 text-sm sm:text-base truncate">{account.account_label || account.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{account.bank_name}</p>
                      <p className="text-xs text-gray-400 font-mono truncate">N° {account.account_number}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteAccountModal(account); }}
                        className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer ce compte"
                      >
                        <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <BanknotesIcon className="h-6 w-6 sm:h-8 sm:w-8 text-pink-500" />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Solde de référence</span>
                      {editingId === account.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            step="0.01"
                            value={editBalance}
                            onChange={(e) => setEditBalance(e.target.value)}
                            className="w-24 px-2 py-1 text-right border rounded text-sm"
                            autoFocus
                          />
                          <span className="text-sm">€</span>
                          <button
                            onClick={() => saveBalance(account.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {(account.reference_balance || 0).toLocaleString('fr-FR', { 
                              minimumFractionDigits: 2 
                            })} €
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(account); }}
                            className="p-1 text-gray-400 hover:text-pink-500 hover:bg-pink-50 rounded"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === account.id && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs text-gray-500">Date du solde de référence</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    )}

                    {account.balance_date && !editingId && (
                      <p className="text-xs text-gray-400 mt-1">
                        au {new Date(account.balance_date).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Evolution Chart */}
          {selectedAccount && evolution && (
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    Évolution du solde - {selectedAccount.account_label || selectedAccount.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Solde de référence: {(evolution.account.referenceBalance || 0).toLocaleString('fr-FR')} € au {new Date(evolution.account.referenceDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Solde actuel</p>
                  <p className={`text-xl font-bold ${evolution.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {evolution.currentBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </p>
                </div>
              </div>

              {evolution.evolution.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolution.evolution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      />
                      <YAxis 
                        tickFormatter={(val) => `${val} €`}
                      />
                      <Tooltip 
                        formatter={(value) => [`${value.toLocaleString('fr-FR')} €`, 'Solde']}
                        labelFormatter={(date) => new Date(date).toLocaleDateString('fr-FR')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="balance" 
                        stroke="#ec4899" 
                        strokeWidth={2}
                        dot={{ fill: '#ec4899', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  <p>Aucune transaction pour afficher l'évolution</p>
                </div>
              )}

              {/* Recent changes */}
              {evolution.evolution.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Derniers mouvements</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {[...evolution.evolution].slice(-5).reverse().map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {new Date(item.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className={`flex items-center gap-1 ${parseFloat(item.change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(item.change) >= 0 ? (
                            <ArrowTrendingUpIcon className="h-4 w-4" />
                          ) : (
                            <ArrowTrendingDownIcon className="h-4 w-4" />
                          )}
                          {parseFloat(item.change) >= 0 ? '+' : ''}{parseFloat(item.change).toLocaleString('fr-FR')} €
                        </span>
                        <span className="font-medium text-gray-800">
                          {parseFloat(item.balance).toLocaleString('fr-FR')} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <span className="text-xs sm:text-sm font-medium text-gray-700">Filtrer :</span>
              
              {/* Year filter */}
              <select
                value={analyticsYear}
                onChange={(e) => setAnalyticsYear(e.target.value)}
                className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1.5"
              >
                <option value="all">Années</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              {/* Month filter */}
              <select
                value={analyticsMonth}
                onChange={(e) => setAnalyticsMonth(e.target.value)}
                className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1.5"
              >
                <option value="all">Mois</option>
                {months.map(month => (
                  <option key={month} value={month}>{MONTH_NAMES[month].slice(0, 3)}</option>
                ))}
              </select>

              {/* Account filter */}
              <select
                value={analyticsAccount}
                onChange={(e) => setAnalyticsAccount(e.target.value)}
                className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1.5 max-w-[120px] sm:max-w-none"
              >
                <option value="all">Comptes</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.account_label || account.name}
                  </option>
                ))}
              </select>

              {/* Reset */}
              {(analyticsYear !== 'all' || analyticsMonth !== 'all' || analyticsAccount !== 'all') && (
                <button
                  onClick={() => { setAnalyticsYear('all'); setAnalyticsMonth('all'); setAnalyticsAccount('all'); }}
                  className="text-xs sm:text-sm text-pink-600 hover:text-pink-700"
                >
                  × Reset
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-white rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-500">
                {filteredAnalytics?.isFiltered ? 'Total' : 'Total dépensé'}
              </p>
              <p className="text-lg sm:text-2xl font-bold text-pink-600">
                {(filteredAnalytics?.totals?.total_spent || parseFloat(analytics?.totals?.total_spent || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                {filteredAnalytics?.totals?.total_transactions || analytics?.totals?.total_transactions || 0} tx
              </p>
            </div>
            <div className="bg-white rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-500">Moy./mois</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">
                {(filteredAnalytics?.totals?.monthly_average || (parseFloat(analytics?.totals?.total_spent || 0) / (filteredAnalytics?.totals?.num_months || 1))).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-gray-400 mt-1 hidden sm:block">
                sur {filteredAnalytics?.totals?.num_months || '?'} mois
              </p>
            </div>
            <div className="bg-white rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-500">Catégories</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-800">
                {filteredAnalytics?.byCategory?.length || analytics?.byCategory?.length || 0}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-500">Top cat.</p>
              <p className="text-sm sm:text-lg font-bold text-gray-800 truncate">
                {(filteredAnalytics?.byCategory || analytics?.byCategory)?.[0]?.category || 'N/A'}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {parseFloat((filteredAnalytics?.byCategory || analytics?.byCategory)?.[0]?.total || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart - By Category */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                Dépenses par catégorie
                {filteredAnalytics?.isFiltered && (
                  <span className="text-sm font-normal text-gray-500 ml-2">(filtré)</span>
                )}
              </h3>
              {(filteredAnalytics?.byCategory || analytics?.byCategory)?.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(filteredAnalytics?.byCategory || analytics?.byCategory).map((cat, idx) => ({
                          name: cat.category || 'Autre',
                          value: parseFloat(cat.total)
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(filteredAnalytics?.byCategory || analytics?.byCategory).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value.toLocaleString('fr-FR')} €`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-10">Aucune donnée pour cette période</p>
              )}
            </div>

            {/* Bar Chart - Monthly */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Dépenses mensuelles</h3>
              {analytics?.byMonth && analytics.byMonth.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...analytics.byMonth].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(val) => `${val}€`} />
                      <Tooltip formatter={(value) => [`${value.toLocaleString('fr-FR')} €`, 'Total']} />
                      <Bar dataKey="total" fill="#ec4899" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-10">Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Category breakdown list */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Détail par catégorie</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transactions</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Moyenne/tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(filteredAnalytics?.byCategory || analytics?.byCategory)?.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-gray-900">{cat.category || 'Autre'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {cat.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {parseFloat(cat.total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {(parseFloat(cat.total) / parseInt(cat.count)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Transactions List with Filters */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <h3 className="font-semibold text-gray-800">
                Toutes mes transactions ({filteredTransactions.length})
              </h3>
              
              {/* Search + Filters */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1 pl-2 pr-7 w-32 sm:w-40"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                
                {/* Year filter */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1"
                >
                  <option value="all">Années</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                {/* Month filter */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1"
                >
                  <option value="all">Mois</option>
                  {months.map(month => (
                    <option key={month} value={month}>{MONTH_NAMES[month].slice(0, 3)}</option>
                  ))}
                </select>

                {/* Type filter - hidden on mobile */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1 hidden sm:block"
                >
                  <option value="all">Types</option>
                  <option value="commune">Commune</option>
                  <option value="individuelle">Individuelle</option>
                </select>

                {/* Category filter - hidden on mobile */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs sm:text-sm border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500 py-1 hidden sm:block"
                >
                  <option value="all">Catégories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Reset filters */}
                {(selectedYear !== 'all' || selectedMonth !== 'all' || selectedType !== 'all' || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedYear('all');
                      setSelectedMonth('all');
                      setSelectedType('all');
                      setSelectedCategory('all');
                    }}
                    className="text-xs sm:text-sm text-pink-600 hover:text-pink-700"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Filtered totals */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 p-2 sm:p-3 bg-gray-50 rounded-lg">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-500">Dépenses</p>
                <p className="text-sm sm:text-lg font-bold text-red-600">
                  {filteredTransactions.filter(t => parseFloat(t.amount) < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-500">Revenus</p>
                <p className="text-sm sm:text-lg font-bold text-green-600">
                  {filteredTransactions.filter(t => parseFloat(t.amount) > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm text-gray-500">Communes</p>
                <p className="text-sm sm:text-lg font-bold text-pink-600">
                  {filteredTransactions.filter(t => t.type === 'commune' && parseFloat(t.amount) < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(tx.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                        {editingLabelId === tx.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingLabelValue}
                              onChange={(e) => setEditingLabelValue(e.target.value)}
                              className="flex-1 px-2 py-1 border rounded text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveLabel(tx.id);
                                if (e.key === 'Escape') cancelEditLabel();
                              }}
                            />
                            <button onClick={() => saveLabel(tx.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEditLabel} className="text-red-600 hover:bg-red-50 p-1 rounded">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="truncate">{tx.label}</span>
                            <button 
                              onClick={() => startEditLabel(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                              title="Modifier le libellé"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === 'commune' ? 'bg-pink-100 text-pink-700' :
                          tx.type === 'individuelle' ? 'bg-gray-100 text-gray-700' :
                          tx.type === 'virement_interne' ? 'bg-blue-100 text-blue-700' :
                          tx.type === 'abonnement' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {tx.type === 'commune' ? '👫 Commune' :
                           tx.type === 'individuelle' ? '👤 Individuelle' :
                           tx.type === 'virement_interne' ? '🔄 Virement' :
                           tx.type === 'abonnement' ? '📅 Abonnement' :
                           '❓ Non classé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {tx.category || 'N/A'}
                        {tx.ai_confidence && (
                          <span className={`ml-1 text-xs ${
                            tx.ai_confidence >= 80 ? 'text-green-500' :
                            tx.ai_confidence >= 50 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            ({tx.ai_confidence}%)
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-right text-sm font-medium ${
                        parseFloat(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {editingAmountId === tx.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={editingAmountValue}
                              onChange={(e) => setEditingAmountValue(e.target.value)}
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAmount(tx.id);
                                if (e.key === 'Escape') cancelEditAmount();
                              }}
                            />
                            <button onClick={() => saveAmount(tx.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEditAmount} className="text-red-600 hover:bg-red-50 p-1 rounded">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 group">
                            <span>{parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                            <button 
                              onClick={() => startEditAmount(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                              title="Modifier le montant"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => setShowClassifyModal(tx)}
                          className="text-gray-400 hover:text-indigo-600 p-1"
                          title="Corriger la classification"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Aucune transaction ne correspond aux filtres
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recurring Transactions Tab */}
      {activeTab === 'recurring' && recurring && (
        <div className="space-y-6">
          {/* Recurring subscriptions */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-4">
              Abonnements détectés ({recurring.recurring?.length || 0})
            </h3>
            {recurring.recurring && recurring.recurring.length > 0 ? (
              <div className="space-y-4">
                {recurring.recurring.map((sub, idx) => {
                  const key = `${sub.label}_${sub.amount}`;
                  const settings = subscriptionSettings[key] || {};
                  const isFromPartner = sub.isFromPartner || false;
                  const isShared = isFromPartner || settings.isShared || false;
                  const iPay = isFromPartner ? false : settings.payerUserId === currentUserId;
                  const payerName = sub.payerName || settings.payerName || 'Inconnu';
                  const savedFrequency = settings.frequency || sub.frequency || 'monthly';
                  const effectiveAmount = getEffectiveAmount(sub);
                  const calendarAmount = getCalendarAmount(sub);
                  
                  return (
                  <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {sub.label}
                          {isFromPartner && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              Abo. de {payerName}
                            </span>
                          )}
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          {/* Frequency selector */}
                          <select
                            value={savedFrequency}
                            onChange={(e) => updateSubscriptionFrequency(sub, e.target.value)}
                            disabled={savingSubscription === key || isFromPartner}
                            className="text-xs border rounded-lg px-2 py-1 focus:ring-pink-500 focus:border-pink-500"
                          >
                            <option value="monthly">📅 Mensuel</option>
                            <option value="quarterly">📆 Trimestriel</option>
                            <option value="semiannual">📆 Semestriel</option>
                            <option value="yearly">🗓️ Annuel</option>
                          </select>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            ~Jour {sub.avgDayOfMonth} du mois
                          </span>
                          <span className="text-xs">
                            {sub.occurrences} paiements
                          </span>
                        </div>
                        {sub.nextExpected && (
                          <p className="mt-2 text-xs text-gray-400">
                            Prochain paiement estimé : {new Date(sub.nextExpected).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        
                        {/* Toggle Partagé/Individuel + Category */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => toggleSubscriptionShared(sub)}
                            disabled={savingSubscription === key || isFromPartner}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isShared 
                                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' 
                                : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                            }`}
                          >
                            {savingSubscription === key ? (
                              <span className="animate-spin">⏳</span>
                            ) : isShared ? (
                              <>👫 Partagé (÷2)</>
                            ) : (
                              <>👤 Individuel</>
                            )}
                          </button>
                          
                          {/* Affichage de qui paie - only shown when shared */}
                          {isShared && (
                            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                              iPay 
                                ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                                : 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                            }`}>
                              {iPay ? (
                                <>💳 Tu paies</>
                              ) : (
                                <>🤝 {payerName} paie</>
                              )}
                            </span>
                          )}
                          
                          
                          {/* Category selector */}
                          {editingSubscriptionCategory === key ? (
                            <select
                              value={sub.category || 'Abonnements'}
                              onChange={(e) => updateSubscriptionCategory(sub, e.target.value)}
                              className="text-xs border rounded-lg px-2 py-1 focus:ring-pink-500 focus:border-pink-500"
                              autoFocus
                              onBlur={() => setEditingSubscriptionCategory(null)}
                            >
                              {CATEGORIES_LIST.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingSubscriptionCategory(key)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
                            >
                              📁 {sub.category || 'Abonnements'}
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          )}
                          
                          {isShared && (
                            <span className="text-xs text-purple-600">
                              Ma part : {effectiveAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                              {iPay && (
                                <span className="ml-2 text-green-600">
                                  (À prévoir : {calendarAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${isShared ? 'text-purple-600' : 'text-pink-600'}`}>
                          {effectiveAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </p>
                        <p className="text-xs text-gray-500">
                          par {savedFrequency === 'monthly' ? 'mois' : savedFrequency === 'yearly' ? 'an' : savedFrequency === 'quarterly' ? 'trimestre' : savedFrequency === 'semiannual' ? 'semestre' : 'période'}
                        </p>
                        {savedFrequency !== 'monthly' && savedFrequency !== 'manual' && (
                          <p className="text-xs text-blue-500">
                            ≈ {getMonthlyEquivalent(sub).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/mois
                          </p>
                        )}
                        {isShared && (
                          <>
                            <p className="text-xs text-gray-400 line-through">
                              ({parseFloat(sub.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € total)
                            </p>
                            {iPay && (
                              <p className="text-xs text-green-600 mt-1">
                                💳 Tu paies le total
                              </p>
                            )}
                          </>
                        )}
                        {sub.isCategoryBased && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded mt-1 inline-block">
                            Via catégorie
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                Aucun abonnement récurrent détecté
              </p>
            )}
          </div>

          {/* Calendar view */}
          {recurring.recurring && recurring.recurring.length > 0 && (() => {
            const currentMonth = calendarMonth.getMonth();
            const currentYear = calendarMonth.getFullYear();
            const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                              'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            
            // Filter subscriptions due this month
            const subsThisMonth = recurring.recurring.filter(sub => 
              isSubscriptionDueInMonth(sub, currentMonth, currentYear)
            );
            
            // Get days in month
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            
            // Get first day of month (0 = Sunday, we want Monday = 0)
            const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
            const startPadding = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
            
            return (
            <div className="bg-white rounded-xl shadow p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="font-semibold text-gray-800 text-sm sm:text-base">
                  Calendrier des prélèvements
                </h3>
                
                {/* Month navigation */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setCalendarMonth(new Date(currentYear, currentMonth - 1, 1))}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    ←
                  </button>
                  <span className="font-medium text-gray-700 min-w-[100px] sm:min-w-[140px] text-center text-sm sm:text-base">
                    {monthNames[currentMonth].slice(0, 3)} {currentYear}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(new Date(currentYear, currentMonth + 1, 1))}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-lg"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setCalendarMonth(new Date())}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg border"
                  >
                    Auj.
                  </button>
                </div>
              </div>
              
              {/* Total for this month */}
              <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-gray-600" title="Moyenne mensuelle de tous tes abonnements (annuels ÷12, etc.)">
                    Ma part /mois :
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-pink-600">
                    {recurring.recurring
                      .reduce((sum, s) => sum + getMonthlyEquivalent(s), 0)
                      .toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs sm:text-sm text-gray-600">
                    💳 À prévoir :
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-green-600">
                    {subsThisMonth
                      .reduce((sum, s) => sum + getCalendarAmount(s), 0)
                      .toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {subsThisMonth.length} abo. prévu{subsThisMonth.length > 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Header */}
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                  <div key={idx} className="text-center text-xs font-medium text-gray-500 py-1 sm:py-2">
                    {day}
                  </div>
                ))}
                
                {/* Empty cells for start padding */}
                {Array.from({ length: startPadding }, (_, i) => (
                  <div key={`empty-${i}`} className="aspect-square"></div>
                ))}
                
                {/* Days of the month */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const subsOnThisDay = subsThisMonth.filter(
                    sub => sub.avgDayOfMonth === day
                  );
                  const hasShared = subsOnThisDay.some(s => {
                    const key = `${s.label}_${s.amount}`;
                    const settings = subscriptionSettings[key];
                    return settings?.isShared;
                  });
                  const isToday = new Date().getDate() === day && 
                                  new Date().getMonth() === currentMonth && 
                                  new Date().getFullYear() === currentYear;
                  
                  // Calculate amount to plan (what I need on my account)
                  const dayCalendarTotal = subsOnThisDay.reduce((sum, s) => sum + getCalendarAmount(s), 0);
                  
                  return (
                    <div
                      key={day}
                      className={`aspect-square border rounded p-0.5 sm:p-1 text-center relative group ${
                        dayCalendarTotal > 0 
                          ? hasShared 
                            ? 'bg-purple-50 border-purple-300' 
                            : 'bg-pink-50 border-pink-300' 
                          : subsOnThisDay.length > 0
                            ? 'bg-orange-50 border-orange-200' // Has subs but I don't pay
                            : 'bg-gray-50 border-gray-200'
                      } ${isToday ? 'ring-2 ring-pink-500' : ''}`}
                    >
                      <div className={`text-xs sm:text-sm font-medium ${isToday ? 'text-pink-600' : ''}`}>{day}</div>
                      {dayCalendarTotal > 0 && (
                        <>
                          <div className={`text-xs font-bold ${hasShared ? 'text-green-600' : 'text-pink-600'}`}>
                            {dayCalendarTotal.toFixed(0)}
                          </div>
                          {/* Tooltip on hover - hidden on mobile */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden sm:group-hover:block z-10">
                            <div className="bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap">
                              <div className="font-bold mb-1 text-green-400">💳 À prévoir :</div>
                              {subsOnThisDay.filter(s => getCalendarAmount(s) > 0).map((s, i) => (
                                <div key={i} className="flex justify-between gap-4">
                                  <span className="truncate max-w-[120px]">{s.label}</span>
                                  <span>{getCalendarAmount(s).toFixed(2)}€</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      {subsOnThisDay.length > 0 && dayCalendarTotal === 0 && (
                        <div className="text-xs text-orange-500">🤝</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 bg-pink-100 border border-pink-300 rounded"></span>
                  Indiv.
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-100 border border-purple-300 rounded"></span>
                  Partagé
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 bg-orange-50 border border-orange-200 rounded"></span>
                  🤝 Autre
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2 hidden sm:block">
                💡 Le calendrier affiche le montant total à prévoir sur ton compte
              </p>
            </div>
            );
          })()}

          {/* Expired subscriptions */}
          {recurring.expiredSubscriptions && recurring.expiredSubscriptions.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6 opacity-75">
              <h3 className="font-semibold text-gray-600 mb-4 flex items-center gap-2">
                <span className="text-red-400">⏸️</span>
                Abonnements terminés ou en pause ({recurring.expiredSubscriptions.length})
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Ces abonnements n'ont pas eu de prélèvement depuis plus de 2 mois
              </p>
              <div className="space-y-2">
                {recurring.expiredSubscriptions.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-b pb-2">
                    <div>
                      <span className="text-gray-600">{item.label}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        Dernier : {new Date(item.lastDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <span className="font-medium text-gray-500 line-through">
                      {parseFloat(item.amount).toLocaleString('fr-FR')} €
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Possible recurring (not confirmed) */}
          {recurring.possibleRecurring && recurring.possibleRecurring.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-gray-800 mb-4">
                Dépenses récurrentes possibles ({recurring.possibleRecurring.length})
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Ces transactions se répètent mais avec un intervalle irrégulier
              </p>
              <div className="space-y-2">
                {recurring.possibleRecurring.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-b pb-2">
                    <span className="text-gray-900">{item.label}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500">{item.occurrences}x</span>
                      <span className="font-medium text-gray-900">
                        {parseFloat(item.amount).toLocaleString('fr-FR')} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>

      {/* Classification Correction Modal */}
      <ClassificationCorrectionModal
        transaction={showClassifyModal}
        isOpen={!!showClassifyModal}
        onClose={() => setShowClassifyModal(null)}
        onSuccess={() => {
          setShowClassifyModal(null);
          fetchAllTransactions();
          fetchAnalytics();
        }}
      />

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Supprimer le compte</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Êtes-vous sûr de vouloir supprimer le compte <strong>{showDeleteAccountModal.account_label || showDeleteAccountModal.name}</strong> ?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  ⚠️ Cette action supprimera également <strong>toutes les transactions</strong> associées à ce compte. Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteAccountModal(null)}
                disabled={deletingAccount}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteAccount(showDeleteAccountModal.id)}
                disabled={deletingAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingAccount ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Suppression...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    Supprimer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

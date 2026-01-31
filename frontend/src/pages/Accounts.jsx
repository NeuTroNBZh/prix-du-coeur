import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import Navbar from '../components/Navbar';
import ClassificationCorrectionModal from '../components/ClassificationCorrectionModal';
import { useAuth } from '../contexts/AuthContext';
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
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon
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
  Sector,
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
  const { user } = useAuth();
  const isInCouple = user?.isInCouple === true; // Only show couple features if explicitly in couple
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
  
  // Unified filter states (shared between analytics and transactions table)
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort states for transactions table
  const [sortColumn, setSortColumn] = useState('date'); // date, label, type, category, amount
  const [sortDirection, setSortDirection] = useState('desc'); // asc, desc
  
  // Pie chart active index for hover effect
  const [activePieIndex, setActivePieIndex] = useState(-1);
  
  // Correction modal
  const [showClassifyModal, setShowClassifyModal] = useState(null);
  
  // Edit label state
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  
  // Edit amount state
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');
  
  // Edit account name state
  const [editingAccountNameId, setEditingAccountNameId] = useState(null);
  const [editingAccountNameValue, setEditingAccountNameValue] = useState('');
  
  // Delete transaction modal
  const [showDeleteTransactionModal, setShowDeleteTransactionModal] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(false);

  // Add transaction modal
  const [showAddTransactionModal, setShowAddTransactionModal] = useState(false);
  const [addTransactionForm, setAddTransactionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    label: '',
    amount: '',
    category: 'Autre',
    type: 'individuelle',
    isRecurring: false,
    accountId: ''
  });
  const [addingTransaction, setAddingTransaction] = useState(false);

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
      // Refresh recurring data to update active/inactive status
      await fetchRecurring();
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

  // Dismiss subscription (mark as not a subscription)
  const [dismissingSubscription, setDismissingSubscription] = useState(null);
  
  const dismissSubscription = async (sub, reason = 'not_recurring') => {
    const key = `${sub.label}_${sub.amount}`;
    setDismissingSubscription(key);
    try {
      await api.post('/api/transactions/subscriptions/dismiss', {
        label: sub.label,
        amount: sub.amount,
        reason: reason // 'not_recurring' or 'cancelled'
      });
      // Refresh recurring data to remove the dismissed subscription
      await fetchRecurring();
      // Show success feedback
      console.log(`✅ Abonnement "${sub.label}" ${reason === 'cancelled' ? 'marqué comme annulé' : 'marqué comme non récurrent'}`);
    } catch (err) {
      console.error('Dismiss subscription error:', err);
    } finally {
      setDismissingSubscription(null);
    }
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

  // Toggle recurring status
  const toggleRecurring = async (tx) => {
    try {
      const newStatus = !tx.is_recurring;
      await api.patch(`/api/transactions/${tx.id}/recurring`, { isRecurring: newStatus });
      // Update local state
      setAllTransactions(prev => prev.map(t => 
        t.id === tx.id ? { ...t, is_recurring: newStatus } : t
      ));
      // Refresh recurring data
      fetchRecurring();
    } catch (err) {
      setError('Erreur lors de la modification du statut récurrent');
    }
  };

  // Account name editing functions
  const startEditAccountName = (account, e) => {
    e.stopPropagation();
    setEditingAccountNameId(account.id);
    setEditingAccountNameValue(account.account_label || account.name || '');
  };

  const cancelEditAccountName = (e) => {
    if (e) e.stopPropagation();
    setEditingAccountNameId(null);
    setEditingAccountNameValue('');
  };

  const saveAccountName = async (accountId, e) => {
    if (e) e.stopPropagation();
    if (!editingAccountNameValue.trim()) {
      setError('Le nom du compte ne peut pas être vide');
      return;
    }
    try {
      await api.put(`/api/transactions/accounts/${accountId}/name`, { 
        name: editingAccountNameValue.trim() 
      });
      // Update local state
      setAccounts(prev => prev.map(acc => 
        acc.id === accountId ? { ...acc, account_label: editingAccountNameValue.trim() } : acc
      ));
      setEditingAccountNameId(null);
      setEditingAccountNameValue('');
    } catch (err) {
      setError('Erreur lors du renommage du compte');
    }
  };

  // Delete a single transaction
  const handleDeleteTransaction = async (transactionId) => {
    setDeletingTransaction(true);
    try {
      await api.delete(`/api/transactions/${transactionId}`);
      // Remove from local state
      setAllTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      setShowDeleteTransactionModal(null);
    } catch (err) {
      setError('Erreur lors de la suppression: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingTransaction(false);
    }
  };

  // Add a new transaction
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!addTransactionForm.label.trim() || !addTransactionForm.amount) {
      setError('Le libellé et le montant sont requis');
      return;
    }
    setAddingTransaction(true);
    try {
      const response = await api.post('/api/transactions', {
        date: addTransactionForm.date,
        label: addTransactionForm.label.trim(),
        amount: parseFloat(addTransactionForm.amount),
        category: addTransactionForm.category,
        type: addTransactionForm.type,
        isRecurring: addTransactionForm.isRecurring,
        accountId: addTransactionForm.accountId || undefined
      });
      // Add to local state
      const newTx = response.data.transaction;
      setAllTransactions(prev => [newTx, ...prev]);
      // Reset form and close modal
      setShowAddTransactionModal(false);
      setAddTransactionForm({
        date: new Date().toISOString().split('T')[0],
        label: '',
        amount: '',
        category: 'Autre',
        type: 'individuelle',
        isRecurring: false,
        accountId: ''
      });
      // Refresh data
      fetchAccounts();
      if (addTransactionForm.isRecurring) {
        fetchRecurring();
      }
    } catch (err) {
      setError('Erreur lors de l\'ajout: ' + (err.response?.data?.error || err.message));
    } finally {
      setAddingTransaction(false);
    }
  };

  // Open add transaction modal with optional default values (for subscriptions)
  const openAddTransaction = (defaultRecurring = false) => {
    setAddTransactionForm(prev => ({
      ...prev,
      date: new Date().toISOString().split('T')[0],
      label: '',
      amount: '',
      category: defaultRecurring ? 'Abonnements' : 'Autre',
      type: 'individuelle',
      isRecurring: defaultRecurring,
      accountId: accounts.length > 0 ? accounts[0].id.toString() : ''
    }));
    setShowAddTransactionModal(true);
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
    const filtered = allTransactions.filter(tx => {
      const date = new Date(tx.date);
      
      if (selectedYear !== 'all' && date.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== 'all' && date.getMonth() !== parseInt(selectedMonth)) return false;
      if (filterAccount !== 'all' && tx.account_id !== parseInt(filterAccount)) return false;
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
    
    // Sort transactions
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.date) - new Date(b.date);
          break;
        case 'label':
          comparison = (a.label || '').localeCompare(b.label || '', 'fr', { sensitivity: 'base' });
          break;
        case 'type':
          comparison = (a.type || '').localeCompare(b.type || '', 'fr', { sensitivity: 'base' });
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '', 'fr', { sensitivity: 'base' });
          break;
        case 'amount':
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [allTransactions, selectedYear, selectedMonth, filterAccount, selectedType, selectedCategory, searchQuery, sortColumn, sortDirection]);
  
  // Handle column header click for sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, set default direction
      setSortColumn(column);
      setSortDirection(column === 'date' ? 'desc' : 'asc');
    }
  };
  
  // Get sort indicator for a column
  const getSortIndicator = (column) => {
    if (sortColumn !== column) {
      return <span className="ml-1 text-theme-muted opacity-30">⇅</span>;
    }
    return sortDirection === 'asc' 
      ? <ChevronUpIcon className="inline h-4 w-4 ml-1 text-pdc-cyan" />
      : <ChevronDownIcon className="inline h-4 w-4 ml-1 text-pdc-cyan" />;
  };

  // Filtered analytics data
  const filteredAnalytics = useMemo(() => {
    if (!allTransactions.length) return null;
    
    // Filter transactions for analytics - only expenses (negative amounts), exclude Revenus category
    const filtered = allTransactions.filter(tx => {
      const date = new Date(tx.date);
      if (selectedYear !== 'all' && date.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== 'all' && date.getMonth() !== parseInt(selectedMonth)) return false;
      if (filterAccount !== 'all' && tx.account_id !== parseInt(filterAccount)) return false;
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
      isFiltered: selectedYear !== 'all' || selectedMonth !== 'all' || filterAccount !== 'all'
    };
  }, [allTransactions, selectedYear, selectedMonth, filterAccount]);

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pdc-cyan-500"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-28 md:pb-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Header with tabs */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-theme-primary">Mes finances</h1>
          </div>

          {/* Tabs - scrollable on mobile */}
          <div className="border-b border-theme-secondary -mx-3 px-3 sm:mx-0 sm:px-0">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto pb-px hide-scrollbar">
              <button
                onClick={() => setActiveTab('accounts')}
                className={`${
                  activeTab === 'accounts'
                    ? 'border-pdc-cyan-500 text-pdc-cyan'
                    : 'border-transparent text-theme-tertiary hover:text-theme-secondary hover:border-theme-secondary'
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
                    ? 'border-pdc-cyan-500 text-pdc-cyan'
                    : 'border-transparent text-theme-tertiary hover:text-theme-secondary hover:border-theme-secondary'
                } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 flex-shrink-0`}
              >
                <ChartBarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Analyse</span>
              </button>
              <button
                onClick={() => setActiveTab('recurring')}
                className={`${
                  activeTab === 'recurring'
                    ? 'border-pdc-cyan-500 text-pdc-cyan'
                    : 'border-transparent text-theme-tertiary hover:text-theme-secondary hover:border-theme-secondary'
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
            <div className="bg-theme-card rounded-xl shadow p-6 sm:p-8 text-center">
              <BanknotesIcon className="h-12 w-12 sm:h-16 sm:w-16 text-theme-muted mx-auto mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-theme-primary mb-2">Aucun compte</h3>
              <p className="text-sm sm:text-base text-theme-tertiary">
                Importez un fichier CSV depuis la page Import pour ajouter vos comptes.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
              {accounts.map((account) => (
                <div 
                  key={account.id} 
                  className={`bg-theme-card rounded-xl shadow p-4 sm:p-6 transition-all cursor-pointer
                    ${selectedAccount?.id === account.id ? 'ring-2 ring-pdc-cyan-500' : 'hover:shadow-lg'}`}
                  onClick={() => loadEvolution(account)}
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="min-w-0 flex-1">
                      {editingAccountNameId === account.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingAccountNameValue}
                            onChange={(e) => setEditingAccountNameValue(e.target.value)}
                            className="flex-1 px-2 py-1 border rounded text-sm font-semibold text-theme-primary bg-theme-card border-theme-primary"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveAccountName(account.id, e);
                              if (e.key === 'Escape') cancelEditAccountName(e);
                            }}
                          />
                          <button
                            onClick={(e) => saveAccountName(account.id, e)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditAccountName}
                            className="p-1 text-red-600 hover:bg-pdc-coral-100 dark:hover:bg-pdc-coral-900/30 rounded"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <h3 className="font-semibold text-theme-primary text-sm sm:text-base truncate">
                            {account.account_label || account.name}
                          </h3>
                          <button
                            onClick={(e) => startEditAccountName(account, e)}
                            className="p-1 text-theme-muted hover:text-pdc-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Renommer le compte"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs sm:text-sm text-theme-tertiary truncate">{account.bank_name}</p>
                      <p className="text-xs text-theme-muted font-mono truncate">N° {account.account_number}</p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteAccountModal(account); }}
                        className="p-1.5 sm:p-2 text-theme-muted hover:text-red-500 hover:bg-pdc-coral-100 dark:hover:bg-pdc-coral-900/30 rounded-lg transition-colors"
                        title="Supprimer ce compte"
                      >
                        <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                      <BanknotesIcon className="h-6 w-6 sm:h-8 sm:w-8 text-pdc-cyan-500" />
                    </div>
                  </div>

                  <div className="border-t border-theme-secondary pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-theme-secondary">Solde de référence</span>
                      {editingId === account.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            step="0.01"
                            value={editBalance}
                            onChange={(e) => setEditBalance(e.target.value)}
                            className="w-24 px-2 py-1 text-right border rounded text-sm bg-theme-card text-theme-primary border-theme-primary"
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
                            className="p-1 text-red-600 hover:bg-pdc-coral-100 dark:hover:bg-pdc-coral-900/30 rounded"
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
                            className="p-1 text-theme-muted hover:text-pdc-cyan-500 hover:bg-pdc-cyan-50 rounded"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === account.id && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs text-theme-tertiary">Date du solde de référence</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm bg-theme-card text-theme-primary border-theme-primary"
                        />
                      </div>
                    )}

                    {account.balance_date && !editingId && (
                      <p className="text-xs text-theme-muted mt-1">
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
            <div className="bg-theme-card rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-theme-primary">
                    Évolution du solde - {selectedAccount.account_label || selectedAccount.name}
                  </h3>
                  <p className="text-sm text-theme-tertiary">
                    Solde de référence: {(evolution.account.referenceBalance || 0).toLocaleString('fr-FR')} € au {new Date(evolution.account.referenceDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-theme-tertiary">Solde actuel</p>
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
                <div className="h-64 flex items-center justify-center text-theme-muted">
                  <p>Aucune transaction pour afficher l'évolution</p>
                </div>
              )}

              {/* Recent changes */}
              {evolution.evolution.length > 0 && (
                <div className="mt-4 border-t border-theme-secondary pt-4">
                  <h4 className="text-sm font-medium text-theme-secondary mb-2">Derniers mouvements</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto slim-scrollbar">
                    {[...evolution.evolution].slice(-5).reverse().map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-theme-secondary">
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
                        <span className="font-medium text-theme-primary">
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
          <div className="bg-theme-card rounded-xl shadow p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <FunnelIcon className="h-4 w-4 sm:h-5 sm:w-5 text-theme-muted" />
              <span className="text-xs sm:text-sm font-medium text-theme-secondary">Filtrer :</span>
              
              {/* Year filter */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="select-theme text-xs sm:text-sm border border-theme-primary rounded-lg focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 py-1.5 px-2 bg-theme-card text-theme-primary"
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
                className="select-theme text-xs sm:text-sm border border-theme-primary rounded-lg focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 py-1.5 px-2 bg-theme-card text-theme-primary"
              >
                <option value="all">Mois</option>
                {months.map(month => (
                  <option key={month} value={month}>{MONTH_NAMES[month].slice(0, 3)}</option>
                ))}
              </select>

              {/* Account filter */}
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="select-theme text-xs sm:text-sm border border-theme-primary rounded-lg focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 py-1.5 px-2 max-w-[120px] sm:max-w-none bg-theme-card text-theme-primary"
              >
                <option value="all">Comptes</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.account_label || account.name}
                  </option>
                ))}
              </select>

              {/* Type filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="select-theme text-xs sm:text-sm border border-theme-primary rounded-lg focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 py-1.5 px-2 bg-theme-card text-theme-primary"
              >
                <option value="all">Types</option>
                {isInCouple && <option value="commune">Commune</option>}
                <option value="individuelle">Individuelle</option>
              </select>

              {/* Category filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="select-theme text-xs sm:text-sm border border-theme-primary rounded-lg focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 py-1.5 px-2 bg-theme-card text-theme-primary"
              >
                <option value="all">Catégories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Reset */}
              {(selectedYear !== 'all' || selectedMonth !== 'all' || filterAccount !== 'all' || selectedType !== 'all' || selectedCategory !== 'all') && (
                <button
                  onClick={() => { setSelectedYear('all'); setSelectedMonth('all'); setFilterAccount('all'); setSelectedType('all'); setSelectedCategory('all'); }}
                  className="text-xs sm:text-sm text-pdc-cyan hover:text-pdc-cyan-dark"
                >
                  × Reset
                </button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-theme-card rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-theme-tertiary">
                {filteredAnalytics?.isFiltered ? 'Total' : 'Total dépensé'}
              </p>
              <p className="text-lg sm:text-2xl font-bold text-pdc-cyan">
                {(filteredAnalytics?.totals?.total_spent || parseFloat(analytics?.totals?.total_spent || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-theme-muted mt-1 hidden sm:block">
                {filteredAnalytics?.totals?.total_transactions || analytics?.totals?.total_transactions || 0} tx
              </p>
            </div>
            <div className="bg-theme-card rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-theme-tertiary">Moy./mois</p>
              <p className="text-lg sm:text-2xl font-bold text-purple-600">
                {(filteredAnalytics?.totals?.monthly_average || (parseFloat(analytics?.totals?.total_spent || 0) / (filteredAnalytics?.totals?.num_months || 1))).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-theme-muted mt-1 hidden sm:block">
                sur {filteredAnalytics?.totals?.num_months || '?'} mois
              </p>
            </div>
            <div className="bg-theme-card rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-theme-tertiary">Catégories</p>
              <p className="text-lg sm:text-2xl font-bold text-theme-primary">
                {filteredAnalytics?.byCategory?.length || analytics?.byCategory?.length || 0}
              </p>
            </div>
            <div className="bg-theme-card rounded-xl shadow p-3 sm:p-6">
              <p className="text-xs sm:text-sm text-theme-tertiary">Top cat.</p>
              <p className="text-sm sm:text-lg font-bold text-theme-primary truncate">
                {(filteredAnalytics?.byCategory || analytics?.byCategory)?.[0]?.category || 'N/A'}
              </p>
              <p className="text-xs sm:text-sm text-theme-tertiary">
                {parseFloat((filteredAnalytics?.byCategory || analytics?.byCategory)?.[0]?.total || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart - By Category */}
            <div className="bg-theme-card rounded-xl shadow p-6">
              <h3 className="font-semibold text-theme-primary mb-4">
                Dépenses par catégorie
                {filteredAnalytics?.isFiltered && (
                  <span className="text-sm font-normal text-theme-tertiary ml-2">(filtré)</span>
                )}
              </h3>
              {(filteredAnalytics?.byCategory || analytics?.byCategory)?.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(filteredAnalytics?.byCategory || analytics?.byCategory || []).map((cat, idx) => ({
                          name: cat.category || 'Autre',
                          value: parseFloat(cat.total)
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        innerRadius={0}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="var(--bg-card)"
                        strokeWidth={2}
                        activeIndex={activePieIndex}
                        activeShape={(props) => {
                          const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                          return (
                            <g>
                              <Sector
                                cx={cx}
                                cy={cy}
                                innerRadius={innerRadius}
                                outerRadius={outerRadius + 12}
                                startAngle={startAngle}
                                endAngle={endAngle}
                                fill={fill}
                                style={{ filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))', transition: 'all 0.2s ease' }}
                              />
                              <Sector
                                cx={cx}
                                cy={cy}
                                innerRadius={outerRadius + 14}
                                outerRadius={outerRadius + 18}
                                startAngle={startAngle}
                                endAngle={endAngle}
                                fill={fill}
                                opacity={0.4}
                              />
                            </g>
                          );
                        }}
                        onMouseEnter={(_, index) => setActivePieIndex(index)}
                        onMouseLeave={() => setActivePieIndex(-1)}
                      >
                        {(filteredAnalytics?.byCategory || analytics?.byCategory || []).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={COLORS[index % COLORS.length]}
                            style={{ cursor: 'pointer', outline: 'none', transition: 'all 0.2s ease' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            return (
                              <div className="bg-theme-card border border-theme-secondary rounded-xl shadow-lg px-4 py-3" style={{ backdropFilter: 'blur(8px)' }}>
                                <p className="font-semibold text-theme-primary text-sm">{data.name}</p>
                                <p className="text-xl font-bold" style={{ color: data.payload.fill }}>
                                  {data.value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                                </p>
                                <p className="text-xs text-theme-tertiary mt-1">
                                  {((data.value / (filteredAnalytics?.totalSpent || analytics?.totalSpent || 1)) * 100).toFixed(1)}% du total
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-theme-muted text-center py-10">Aucune donnée pour cette période</p>
              )}
            </div>

            {/* Bar Chart - Monthly */}
            <div className="bg-theme-card rounded-xl shadow p-6">
              <h3 className="font-semibold text-theme-primary mb-4">Dépenses mensuelles</h3>
              {analytics?.byMonth && analytics.byMonth.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...analytics.byMonth].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                      <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={12} />
                      <YAxis tickFormatter={(val) => `${val}€`} stroke="var(--text-tertiary)" fontSize={12} />
                      <Tooltip 
                        cursor={{ fill: 'var(--bg-hover)', opacity: 0.3 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-theme-card border border-theme-secondary rounded-xl shadow-lg px-4 py-3">
                                <p className="font-semibold text-theme-primary text-sm">{label}</p>
                                <p className="text-xl font-bold text-pink-500">
                                  {payload[0].value.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="total" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-theme-muted text-center py-10">Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Category breakdown list */}
          <div className="bg-theme-card rounded-xl shadow p-6">
            <h3 className="font-semibold text-theme-primary mb-4">Détail par catégorie</h3>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-theme-secondary">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-tertiary uppercase">Catégorie</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-theme-tertiary uppercase">Transactions</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-theme-tertiary uppercase">Total</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-theme-tertiary uppercase">Moyenne/tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-secondary">
                  {(filteredAnalytics?.byCategory || analytics?.byCategory)?.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-theme-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-theme-primary">{cat.category || 'Autre'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-theme-tertiary">
                        {cat.count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-theme-primary">
                        {parseFloat(cat.total).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-theme-tertiary">
                        {(parseFloat(cat.total) / parseInt(cat.count)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Transactions List with Filters */}
          <div className="bg-theme-card rounded-xl shadow p-3 sm:p-6 -mx-3 sm:mx-0 rounded-none sm:rounded-xl">
            <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-theme-primary text-sm sm:text-base">
                  Transactions ({filteredTransactions.length})
                </h3>
                <button
                  onClick={() => openAddTransaction(false)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-pdc-cyan text-white text-sm font-medium rounded-lg hover:bg-pdc-cyan-dark transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Ajouter
                </button>
              </div>
              
              {/* Filters - Horizontal scroll on mobile */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible hide-scrollbar">
                {/* Search input */}
                <div className="relative flex-shrink-0">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-sm border border-theme-primary rounded-full focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500 py-1.5 pl-3 pr-8 w-32 bg-theme-card text-theme-primary"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-secondary"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filter chips - pill style like native apps */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className={`select-pill text-sm border rounded-full py-1.5 px-3 flex-shrink-0 ${selectedYear !== 'all' ? 'select-pill-active bg-pdc-cyan text-white border-pdc-cyan' : 'bg-theme-card text-theme-primary border-theme-primary'}`}
                >
                  <option value="all">Année</option>
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>

                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`select-pill text-sm border rounded-full py-1.5 px-3 flex-shrink-0 ${selectedMonth !== 'all' ? 'select-pill-active bg-pdc-cyan text-white border-pdc-cyan' : 'bg-theme-card text-theme-primary border-theme-primary'}`}
                >
                  <option value="all">Mois</option>
                  {months.map(month => (
                    <option key={month} value={month}>{MONTH_NAMES[month].slice(0, 3)}</option>
                  ))}
                </select>

                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className={`select-pill text-sm border rounded-full py-1.5 px-3 flex-shrink-0 max-w-[120px] ${filterAccount !== 'all' ? 'select-pill-active bg-pdc-cyan text-white border-pdc-cyan' : 'bg-theme-card text-theme-primary border-theme-primary'}`}
                >
                  <option value="all">Compte</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.account_label || account.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={`select-pill text-sm border rounded-full py-1.5 px-3 flex-shrink-0 ${selectedType !== 'all' ? 'select-pill-active bg-pdc-cyan text-white border-pdc-cyan' : 'bg-theme-card text-theme-primary border-theme-primary'}`}
                >
                  <option value="all">Type</option>
                  {isInCouple && <option value="commune">Commune</option>}
                  <option value="individuelle">Individuelle</option>
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`select-pill text-sm border rounded-full py-1.5 px-3 flex-shrink-0 ${selectedCategory !== 'all' ? 'select-pill-active bg-pdc-cyan text-white border-pdc-cyan' : 'bg-theme-card text-theme-primary border-theme-primary'}`}
                >
                  <option value="all">Catégorie</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Reset - only show when filters active */}
                {(selectedYear !== 'all' || selectedMonth !== 'all' || filterAccount !== 'all' || selectedType !== 'all' || selectedCategory !== 'all' || searchQuery) && (
                  <button
                    onClick={() => { setSelectedYear('all'); setSelectedMonth('all'); setFilterAccount('all'); setSelectedType('all'); setSelectedCategory('all'); setSearchQuery(''); }}
                    className="text-sm text-pdc-cyan hover:text-pdc-cyan-dark font-medium flex-shrink-0 px-2"
                  >
                    × Effacer
                  </button>
                )}
              </div>
            </div>

            {/* Summary stats - compact on mobile */}
            <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4 p-2 bg-theme-secondary rounded-lg">
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-theme-tertiary">Dépenses</p>
                <p className="text-sm sm:text-lg font-bold text-red-600">
                  {filteredTransactions.filter(t => parseFloat(t.amount) < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] sm:text-xs text-theme-tertiary">Revenus</p>
                <p className="text-sm sm:text-lg font-bold text-green-600">
                  {filteredTransactions.filter(t => parseFloat(t.amount) > 0).reduce((sum, t) => sum + parseFloat(t.amount), 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                </p>
              </div>
              {isInCouple && (
                <div className="text-center">
                  <p className="text-[10px] sm:text-xs text-theme-tertiary">Communes</p>
                  <p className="text-sm sm:text-lg font-bold text-pdc-cyan">
                    {filteredTransactions.filter(t => t.type === 'commune' && parseFloat(t.amount) < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </p>
                </div>
              )}
            </div>

            {/* Mobile: Card-style list */}
            <div className="sm:hidden space-y-2 max-h-[60vh] overflow-y-auto slim-scrollbar">
              {filteredTransactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className="flex items-center justify-between py-3 px-2 border-b border-theme-secondary last:border-0"
                >
                  <div 
                    className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 transition-opacity"
                    onClick={() => setShowClassifyModal(tx)}
                  >
                    {/* Category icon/emoji */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 relative ${
                      parseFloat(tx.amount) >= 0 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {tx.is_recurring && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                          <ArrowPathIcon className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      {tx.type === 'commune' ? '👫' :
                       tx.type === 'virement_interne' ? '🔄' :
                       tx.category === 'Alimentation' ? '🍕' :
                       tx.category === 'Transport' ? '🚗' :
                       tx.category === 'Logement' ? '🏠' :
                       tx.category === 'Santé' ? '💊' :
                       tx.category === 'Loisirs' ? '🎮' :
                       tx.category === 'Shopping' ? '🛍️' :
                       tx.category === 'Restaurants' ? '🍽️' :
                       tx.category === 'Revenus' ? '💰' :
                       tx.category === 'Abonnements' ? '📱' :
                       parseFloat(tx.amount) >= 0 ? '💵' : '💳'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-theme-primary truncate">{tx.label}</p>
                      <p className="text-xs text-theme-tertiary">
                        {new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {tx.category && <span> • {tx.category}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                    <div className="text-right" onClick={() => setShowClassifyModal(tx)}>
                      <p className={`text-sm font-semibold ${parseFloat(tx.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </p>
                      {tx.type === 'commune' && (
                        <span className="text-[10px] text-pdc-cyan font-medium">Commune</span>
                      )}
                    </div>
                    {/* Recurring toggle button - always visible on mobile */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRecurring(tx); }}
                      className={`p-2 rounded-lg transition-colors ${
                        tx.is_recurring 
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' 
                          : 'text-theme-muted hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                      }`}
                      title={tx.is_recurring ? 'Récurrent ✓' : 'Marquer récurrent'}
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12 text-theme-tertiary">
                  <p className="text-4xl mb-2">🔍</p>
                  <p>Aucune transaction trouvée</p>
                </div>
              )}
            </div>

            {/* Desktop: Table view */}
            <div className="hidden sm:block overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="min-w-full divide-y divide-theme-secondary">
                <thead className="bg-theme-secondary sticky top-0">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase cursor-pointer hover:text-pdc-cyan select-none transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      Date {getSortIndicator('date')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase cursor-pointer hover:text-pdc-cyan select-none transition-colors"
                      onClick={() => handleSort('label')}
                    >
                      Description {getSortIndicator('label')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase cursor-pointer hover:text-pdc-cyan select-none transition-colors"
                      onClick={() => handleSort('type')}
                    >
                      Type {getSortIndicator('type')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-theme-tertiary uppercase cursor-pointer hover:text-pdc-cyan select-none transition-colors"
                      onClick={() => handleSort('category')}
                    >
                      Catégorie {getSortIndicator('category')}
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-xs font-medium text-theme-tertiary uppercase cursor-pointer hover:text-pdc-cyan select-none transition-colors"
                      onClick={() => handleSort('amount')}
                    >
                      Montant {getSortIndicator('amount')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-theme-tertiary uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-secondary bg-theme-card">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-theme-secondary">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-theme-primary">
                        {new Date(tx.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-primary max-w-xs">
                        {editingLabelId === tx.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingLabelValue}
                              onChange={(e) => setEditingLabelValue(e.target.value)}
                              className="flex-1 px-2 py-1 border rounded text-sm bg-theme-card text-theme-primary border-theme-primary"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveLabel(tx.id);
                                if (e.key === 'Escape') cancelEditLabel();
                              }}
                            />
                            <button onClick={() => saveLabel(tx.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEditLabel} className="text-red-600 hover:bg-pdc-coral-100 dark:hover:bg-pdc-coral-900/30 p-1 rounded">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="truncate">{tx.label}</span>
                            <button 
                              onClick={() => startEditLabel(tx)}
                              className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-pdc-cyan-500 p-1 rounded"
                              title="Modifier le libellé"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === 'commune' ? 'bg-pdc-cyan-100 dark:bg-pdc-cyan-900/30 text-pdc-cyan-dark' :
                          tx.type === 'individuelle' ? 'bg-theme-secondary text-theme-secondary' :
                          tx.type === 'virement_interne' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          tx.type === 'abonnement' ? 'bg-pdc-mint-100 dark:bg-pdc-mint-900/30 text-purple-700 dark:text-purple-300' :
                          'bg-theme-secondary text-theme-tertiary'
                        }`}>
                          {tx.type === 'commune' ? '👫 Commune' :
                           tx.type === 'individuelle' ? '👤 Individuelle' :
                           tx.type === 'virement_interne' ? '🔄 Virement' :
                           tx.type === 'abonnement' ? '📅 Abonnement' :
                           '❓ Non classé'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-theme-tertiary">
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
                              className="w-24 px-2 py-1 border rounded text-sm text-right bg-theme-card text-theme-primary border-theme-primary"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAmount(tx.id);
                                if (e.key === 'Escape') cancelEditAmount();
                              }}
                            />
                            <button onClick={() => saveAmount(tx.id)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEditAmount} className="text-red-600 hover:bg-pdc-coral-100 dark:hover:bg-pdc-coral-900/30 p-1 rounded">
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 group">
                            <span>{parseFloat(tx.amount) >= 0 ? '+' : ''}{parseFloat(tx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                            <button 
                              onClick={() => startEditAmount(tx)}
                              className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-pdc-cyan-500 p-1 rounded"
                              title="Modifier le montant"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Recurring checkbox */}
                          <button
                            onClick={() => toggleRecurring(tx)}
                            className={`p-1 rounded-lg transition-colors ${
                              tx.is_recurring 
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' 
                                : 'text-theme-muted hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                            }`}
                            title={tx.is_recurring ? 'Marquer comme non-récurrent' : 'Marquer comme récurrent (abonnement)'}
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setShowClassifyModal(tx)}
                            className="text-theme-muted hover:text-indigo-600 p-1"
                            title="Corriger la classification"
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteTransactionModal(tx)}
                            className="text-theme-muted hover:text-red-600 p-1"
                            title="Supprimer cette transaction"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-theme-tertiary">
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
          <div className="bg-theme-card rounded-xl shadow p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-theme-primary">
                Abonnements détectés ({recurring.recurring?.length || 0})
              </h3>
              <button
                onClick={() => openAddTransaction(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Ajouter abonnement
              </button>
            </div>
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
                  <div key={idx} className="border border-theme-secondary rounded-lg p-4 hover:bg-theme-secondary">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-theme-primary">
                          {sub.label}
                          {isFromPartner && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              Abo. de {payerName}
                            </span>
                          )}
                        </h4>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-theme-tertiary">
                          {/* Frequency selector */}
                          <select
                            value={savedFrequency}
                            onChange={(e) => updateSubscriptionFrequency(sub, e.target.value)}
                            disabled={savingSubscription === key || isFromPartner}
                            className="select-theme text-xs border border-theme-primary rounded-lg px-2 py-1 bg-theme-card text-theme-primary focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500"
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
                          <p className="mt-2 text-xs text-theme-muted">
                            Prochain paiement estimé : {new Date(sub.nextExpected).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        
                        {/* Toggle Partagé/Individuel + Category */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {/* Only show shared toggle if user is in a couple */}
                          {isInCouple && (
                            <button
                              onClick={() => toggleSubscriptionShared(sub)}
                              disabled={savingSubscription === key || isFromPartner}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isShared 
                                  ? 'bg-pdc-mint-100 dark:bg-pdc-mint-900/30 text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-700' 
                                  : 'bg-theme-secondary text-theme-secondary border-2 border-theme-secondary'
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
                          )}
                          
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
                              className="select-theme text-xs border border-theme-primary rounded-lg px-2 py-1 bg-theme-card text-theme-primary focus:ring-pdc-cyan-500 focus:border-pdc-cyan-500"
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
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-theme-secondary text-theme-secondary rounded-full hover:bg-theme-tertiary"
                            >
                              📁 {sub.category || 'Abonnements'}
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          )}
                          
                          {/* Dismiss subscription buttons */}
                          <button
                            onClick={() => dismissSubscription(sub, 'not_recurring')}
                            disabled={dismissingSubscription === key}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
                            title="Ce n'est pas un abonnement récurrent"
                          >
                            {dismissingSubscription === key ? '⏳' : '🚫'} Pas récurrent
                          </button>
                          <button
                            onClick={() => dismissSubscription(sub, 'cancelled')}
                            disabled={dismissingSubscription === key}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                            title="J'ai résilié cet abonnement"
                          >
                            {dismissingSubscription === key ? '⏳' : '❌'} Résilié
                          </button>
                          
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
                        <p className={`text-lg font-bold ${isShared ? 'text-purple-600' : 'text-pdc-cyan'}`}>
                          {effectiveAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </p>
                        <p className="text-xs text-theme-tertiary">
                          par {savedFrequency === 'monthly' ? 'mois' : savedFrequency === 'yearly' ? 'an' : savedFrequency === 'quarterly' ? 'trimestre' : savedFrequency === 'semiannual' ? 'semestre' : 'période'}
                        </p>
                        {savedFrequency !== 'monthly' && savedFrequency !== 'manual' && (
                          <p className="text-xs text-blue-500">
                            ≈ {getMonthlyEquivalent(sub).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/mois
                          </p>
                        )}
                        {isShared && (
                          <>
                            <p className="text-xs text-theme-muted line-through">
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
              <p className="text-theme-muted text-center py-8">
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
            <div className="bg-theme-card rounded-xl shadow p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="font-semibold text-theme-primary text-sm sm:text-base">
                  Calendrier des prélèvements
                </h3>
                
                {/* Month navigation */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setCalendarMonth(new Date(currentYear, currentMonth - 1, 1))}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-theme-secondary hover:bg-theme-tertiary text-theme-primary rounded-lg"
                  >
                    ←
                  </button>
                  <span className="font-medium text-theme-secondary min-w-[100px] sm:min-w-[140px] text-center text-sm sm:text-base">
                    {monthNames[currentMonth].slice(0, 3)} {currentYear}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(new Date(currentYear, currentMonth + 1, 1))}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-pdc-cyan-100 dark:bg-pdc-cyan-900/30 hover:bg-pdc-cyan-200 text-pdc-cyan-dark rounded-lg"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setCalendarMonth(new Date())}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-theme-secondary hover:bg-theme-tertiary text-theme-tertiary rounded-lg border border-theme-secondary"
                  >
                    Auj.
                  </button>
                </div>
              </div>
              
              {/* Total for this month */}
              <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-pdc-cyan-50 to-pdc-mint-50 dark:from-pdc-cyan-900/20 dark:to-pdc-mint-900/20 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm text-theme-secondary" title="Moyenne mensuelle de tous tes abonnements (annuels ÷12, etc.)">
                    Ma part /mois :
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-pdc-cyan">
                    {recurring.recurring
                      .reduce((sum, s) => sum + getMonthlyEquivalent(s), 0)
                      .toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs sm:text-sm text-theme-secondary">
                    💳 À prévoir :
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-green-600">
                    {subsThisMonth
                      .reduce((sum, s) => sum + getCalendarAmount(s), 0)
                      .toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </span>
                </div>
                <div className="text-xs text-theme-tertiary mt-1">
                  {subsThisMonth.length} abo. prévu{subsThisMonth.length > 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Header */}
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
                  <div key={idx} className="text-center text-xs font-medium text-theme-tertiary py-1 sm:py-2">
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
                            ? 'bg-pdc-mint-50 dark:bg-pdc-mint-900/20 border-purple-300 dark:border-purple-700' 
                            : 'bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20 border-pdc-cyan-300 dark:border-pdc-cyan-700' 
                          : subsOnThisDay.length > 0
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700' // Has subs but I don't pay
                            : 'bg-theme-secondary border-theme-secondary'
                      } ${isToday ? 'ring-2 ring-pdc-cyan-500' : ''}`}
                    >
                      <div className={`text-xs sm:text-sm font-medium ${isToday ? 'text-pdc-cyan' : ''}`}>{day}</div>
                      {dayCalendarTotal > 0 && (
                        <>
                          <div className={`text-xs font-bold ${hasShared ? 'text-green-600' : 'text-pdc-cyan'}`}>
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
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 text-xs text-theme-tertiary">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 sm:w-3 sm:h-3 bg-pdc-cyan-100 dark:bg-pdc-cyan-900/30 border border-pdc-cyan-300 rounded"></span>
                  Indiv.
                </span>
                {isInCouple && (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 sm:w-3 sm:h-3 bg-pdc-mint-100 dark:bg-pdc-mint-900/30 border border-purple-300 rounded"></span>
                      Partagé
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 sm:w-3 sm:h-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded"></span>
                      🤝 Autre
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-theme-tertiary mt-2 hidden sm:block">
                💡 Le calendrier affiche le montant total à prévoir sur ton compte
              </p>
            </div>
            );
          })()}

          {/* Expired subscriptions - can be reactivated by changing frequency */}
          {recurring.expiredSubscriptions && recurring.expiredSubscriptions.length > 0 && (
            <div className="bg-theme-card rounded-xl shadow p-6 border-2 border-dashed border-orange-300 dark:border-orange-700">
              <h3 className="font-semibold text-theme-secondary mb-2 flex items-center gap-2">
                <span className="text-orange-500">⏸️</span>
                Abonnements inactifs ({recurring.expiredSubscriptions.length})
              </h3>
              <p className="text-sm text-theme-tertiary mb-4">
                Ces abonnements semblent inactifs selon leur fréquence configurée. 
                <span className="text-orange-600 dark:text-orange-400 font-medium"> Vérifiez si leur fréquence est correcte</span> (annuel, semestriel...) pour les réactiver.
              </p>
              <div className="space-y-3">
                {recurring.expiredSubscriptions.map((sub, idx) => {
                  const key = `${sub.label}_${sub.amount}`;
                  const settings = subscriptionSettings[key] || {};
                  const savedFrequency = settings.frequency || sub.frequency || 'monthly';
                  const lastDate = new Date(sub.lastDate);
                  const daysSinceLastPayment = Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div key={idx} className="border border-orange-200 dark:border-orange-800 rounded-lg p-4 bg-orange-50/50 dark:bg-orange-900/10">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-theme-primary">{sub.label}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-theme-tertiary">
                            <span className="text-orange-600 dark:text-orange-400">
                              ⚠️ Dernier paiement : {lastDate.toLocaleDateString('fr-FR')} 
                              <span className="text-xs ml-1">({daysSinceLastPayment} jours)</span>
                            </span>
                          </div>
                          {/* Frequency selector to reactivate */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-theme-secondary">Changer la fréquence :</span>
                            <select
                              value={savedFrequency}
                              onChange={(e) => updateSubscriptionFrequency(sub, e.target.value)}
                              disabled={savingSubscription === key}
                              className="select-theme text-xs border border-orange-300 dark:border-orange-700 rounded-lg px-2 py-1 bg-theme-card text-theme-primary focus:ring-orange-500 focus:border-orange-500"
                            >
                              <option value="monthly">📅 Mensuel</option>
                              <option value="quarterly">📆 Trimestriel</option>
                              <option value="semiannual">📆 Semestriel</option>
                              <option value="yearly">🗓️ Annuel</option>
                            </select>
                            {savedFrequency !== 'monthly' && (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                ✓ {savedFrequency === 'yearly' ? 'Annuel' : savedFrequency === 'semiannual' ? 'Semestriel' : savedFrequency === 'quarterly' ? 'Trimestriel' : savedFrequency} défini
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-theme-muted mt-2">
                            💡 Si cet abonnement est annuel/semestriel, changez sa fréquence pour qu'il apparaisse dans les actifs.
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                            {parseFloat(sub.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </p>
                          <p className="text-xs text-theme-tertiary">
                            {sub.occurrences} paiements
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Possible recurring (not confirmed) */}
          {recurring.possibleRecurring && recurring.possibleRecurring.length > 0 && (
            <div className="bg-theme-card rounded-xl shadow p-6">
              <h3 className="font-semibold text-theme-primary mb-4">
                Dépenses récurrentes possibles ({recurring.possibleRecurring.length})
              </h3>
              <p className="text-sm text-theme-tertiary mb-4">
                Ces transactions se répètent mais avec un intervalle irrégulier
              </p>
              <div className="space-y-2">
                {recurring.possibleRecurring.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-b border-theme-secondary pb-2">
                    <span className="text-theme-primary">{item.label}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-theme-tertiary">{item.occurrences}x</span>
                      <span className="font-medium text-theme-primary">
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
          <div className="bg-theme-card rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary">Supprimer le compte</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-theme-secondary mb-3">
                Êtes-vous sûr de vouloir supprimer le compte <strong>{showDeleteAccountModal.account_label || showDeleteAccountModal.name}</strong> ?
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  ⚠️ Cette action supprimera également <strong>toutes les transactions</strong> associées à ce compte. Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteAccountModal(null)}
                disabled={deletingAccount}
                className="px-4 py-2 text-theme-secondary hover:bg-theme-secondary rounded-lg transition-colors"
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

      {/* Delete Transaction Confirmation Modal */}
      {showDeleteTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-theme-card rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary">Supprimer la transaction</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-theme-secondary mb-3">
                Êtes-vous sûr de vouloir supprimer cette transaction ?
              </p>
              <div className="bg-theme-secondary rounded-lg p-3">
                <p className="text-sm text-theme-primary font-medium">{showDeleteTransactionModal.label}</p>
                <p className="text-sm text-theme-tertiary">
                  {new Date(showDeleteTransactionModal.date).toLocaleDateString('fr-FR')} • 
                  <span className={parseFloat(showDeleteTransactionModal.amount) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {' '}{parseFloat(showDeleteTransactionModal.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </span>
                </p>
              </div>
              <p className="text-sm text-red-500 mt-3">
                ⚠️ Cette action est irréversible.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteTransactionModal(null)}
                disabled={deletingTransaction}
                className="px-4 py-2 text-theme-secondary hover:bg-theme-secondary rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteTransaction(showDeleteTransactionModal.id)}
                disabled={deletingTransaction}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deletingTransaction ? (
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

      {/* Add Transaction Modal */}
      {showAddTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-theme-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md sm:mx-4 shadow-2xl max-h-[90vh] overflow-y-auto slim-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-theme-secondary sticky top-0 bg-theme-card">
              <h3 className="text-lg font-semibold text-theme-primary">Nouvelle opération</h3>
              <button
                onClick={() => setShowAddTransactionModal(false)}
                className="p-2 text-theme-muted hover:text-theme-secondary rounded-full hover:bg-theme-secondary"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="p-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={addTransactionForm.date}
                  onChange={(e) => setAddTransactionForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-lg border border-theme-primary p-3 bg-theme-card text-theme-primary focus:ring-pdc-cyan focus:border-pdc-cyan"
                  required
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">
                  Libellé
                </label>
                <input
                  type="text"
                  value={addTransactionForm.label}
                  onChange={(e) => setAddTransactionForm(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: Courses Carrefour"
                  className="w-full rounded-lg border border-theme-primary p-3 bg-theme-card text-theme-primary focus:ring-pdc-cyan focus:border-pdc-cyan"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">
                  Montant (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={addTransactionForm.amount}
                  onChange={(e) => setAddTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="-50.00 pour une dépense, 100.00 pour un revenu"
                  className="w-full rounded-lg border border-theme-primary p-3 bg-theme-card text-theme-primary focus:ring-pdc-cyan focus:border-pdc-cyan"
                  required
                />
                <p className="text-xs text-theme-tertiary mt-1">
                  Utilisez un montant négatif pour les dépenses
                </p>
              </div>

              {/* Account */}
              {accounts.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">
                    Compte
                  </label>
                  <select
                    value={addTransactionForm.accountId}
                    onChange={(e) => setAddTransactionForm(prev => ({ ...prev, accountId: e.target.value }))}
                    className="select-theme w-full rounded-lg border border-theme-primary p-3 bg-theme-card text-theme-primary focus:ring-pdc-cyan focus:border-pdc-cyan"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_label || acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">
                  Catégorie
                </label>
                <select
                  value={addTransactionForm.category}
                  onChange={(e) => setAddTransactionForm(prev => ({ ...prev, category: e.target.value }))}
                  className="select-theme w-full rounded-lg border border-theme-primary p-3 bg-theme-card text-theme-primary focus:ring-pdc-cyan focus:border-pdc-cyan"
                >
                  {CATEGORIES_LIST.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddTransactionForm(prev => ({ ...prev, type: 'individuelle' }))}
                    className={`p-3 rounded-lg border-2 text-center transition ${
                      addTransactionForm.type === 'individuelle'
                        ? 'border-pdc-cyan bg-pdc-cyan/10 text-pdc-cyan'
                        : 'border-theme-secondary hover:border-pdc-cyan/50 text-theme-secondary'
                    }`}
                  >
                    <span className="text-lg">👤</span>
                    <p className="text-sm font-medium mt-1">Individuelle</p>
                  </button>
                  {isInCouple && (
                    <button
                      type="button"
                      onClick={() => setAddTransactionForm(prev => ({ ...prev, type: 'commune' }))}
                      className={`p-3 rounded-lg border-2 text-center transition ${
                        addTransactionForm.type === 'commune'
                          ? 'border-pdc-cyan bg-pdc-cyan/10 text-pdc-cyan'
                          : 'border-theme-secondary hover:border-pdc-cyan/50 text-theme-secondary'
                      }`}
                    >
                      <span className="text-lg">👫</span>
                      <p className="text-sm font-medium mt-1">Commune</p>
                    </button>
                  )}
                </div>
              </div>

              {/* Recurring toggle */}
              <div className="flex items-center justify-between p-3 bg-theme-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${addTransactionForm.isRecurring ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-theme-tertiary'}`}>
                    <ArrowPathIcon className={`h-5 w-5 ${addTransactionForm.isRecurring ? 'text-purple-600' : 'text-theme-muted'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-theme-primary">Opération récurrente</p>
                    <p className="text-xs text-theme-tertiary">Abonnement ou prélèvement régulier</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddTransactionForm(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    addTransactionForm.isRecurring ? 'bg-purple-600' : 'bg-theme-tertiary'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    addTransactionForm.isRecurring ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={addingTransaction}
                className="w-full py-3 bg-pdc-cyan text-white font-medium rounded-lg hover:bg-pdc-cyan-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingTransaction ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-5 w-5" />
                    Ajouter l'opération
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button - Mobile only */}
      {(activeTab === 'analytics' || activeTab === 'recurring') && (
        <button
          onClick={() => openAddTransaction(activeTab === 'recurring')}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-pdc-cyan text-white rounded-full shadow-lg flex items-center justify-center z-40 active:scale-95 transition-transform"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
        >
          <PlusIcon className="h-7 w-7" />
        </button>
      )}
    </>
  );
}

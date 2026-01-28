import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ClassificationCorrectionModal from '../components/ClassificationCorrectionModal';
import { harmonizationAPI, transactionAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';
import { 
  ScaleIcon, 
  CheckCircleIcon, 
  PlusIcon, 
  TrashIcon,
  XMarkIcon,
  BanknotesIcon,
  PencilSquareIcon,
  PencilIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

const CATEGORIES = [
  'Courses', 'Restaurant', 'Loisirs', 'Transport', 'Logement', 
  'Santé', 'Shopping', 'Abonnements', 'Vacances', 'Cadeaux', 'Virement interne', 'Autre'
];

export default function Harmonization() {
  const [balance, setBalance] = useState(null);
  const [history, setHistory] = useState([]);
  const [user1Transactions, setUser1Transactions] = useState([]);
  const [user2Transactions, setUser2Transactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [noCouple, setNoCouple] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showDeleteSettlementModal, setShowDeleteSettlementModal] = useState(null);
  const [showClassifyModal, setShowClassifyModal] = useState(null);
  const [showRatioModal, setShowRatioModal] = useState(null);
  const [addingExpense, setAddingExpense] = useState(false);
  
  // Edit label state
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  
  // Edit amount state
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');
  
  // Form state
  const [newExpense, setNewExpense] = useState({
    amount: '',
    label: '',
    category: 'Autre',
    date: new Date().toISOString().split('T')[0],
    type: 'individuelle'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balanceRes, historyRes] = await Promise.all([
        harmonizationAPI.getBalance(),
        harmonizationAPI.getHistory().catch(() => ({ data: { settlements: [] } }))
      ]);
      setBalance(balanceRes.data);
      setHistory(historyRes.data?.settlements || []);
      setUser1Transactions(balanceRes.data?.user1Transactions || []);
      setUser2Transactions(balanceRes.data?.user2Transactions || []);
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      if (err.response?.status === 404 && err.response?.data?.error === 'No couple found') {
        setNoCouple(true);
      } else if (err.response?.status === 401) {
        setError('Session expirée. Veuillez vous reconnecter.');
      } else {
        setError(err.response?.data?.message || 'Erreur lors du chargement des données.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    const amount = Math.abs(balance?.balance?.netBalance || 0);
    if (amount === 0) return;

    setSettling(true);
    try {
      await harmonizationAPI.settleUp({
        amount: amount,
        note: `Régularisation du ${new Date().toLocaleDateString('fr-FR')}`
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        fetchData();
      }, 2000);
    } catch (error) {
      console.error('Error settling:', error);
      setError('Erreur lors de la régularisation');
    } finally {
      setSettling(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.amount || !newExpense.label) return;

    setAddingExpense(true);
    try {
      await transactionAPI.create({
        ...newExpense,
        amount: -Math.abs(parseFloat(newExpense.amount)) // Dépenses sont négatives
      });
      setShowAddModal(false);
      setNewExpense({
        amount: '',
        label: '',
        category: 'Autre',
        date: new Date().toISOString().split('T')[0],
        type: 'individuelle'
      });
      fetchData();
    } catch (err) {
      console.error('Error adding expense:', err);
      setError('Erreur lors de l\'ajout de la dépense');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await transactionAPI.delete(id);
      setShowDeleteModal(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting:', err);
      setError('Erreur lors de la suppression');
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
      await transactionAPI.updateLabel(txId, editingLabelValue);
      setEditingLabelId(null);
      setEditingLabelValue('');
      fetchData();
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
      await transactionAPI.updateAmount(txId, newAmount);
      setEditingAmountId(null);
      setEditingAmountValue('');
      fetchData();
    } catch (err) {
      setError('Erreur lors de la modification du montant');
    }
  };

  const handleDeleteSettlement = async (id) => {
    try {
      await harmonizationAPI.deleteSettlement(id);
      setShowDeleteSettlementModal(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting settlement:', err);
      setError('Erreur lors de l\'annulation de la régularisation');
    }
  };

  const handleUpdateRatio = async (tx, newRatio) => {
    try {
      await harmonizationAPI.updateType(tx.id, {
        type: tx.type,
        ratio: newRatio / 100 // Convert from percentage to decimal
      });
      setShowRatioModal(null);
      fetchData();
    } catch (err) {
      console.error('Error updating ratio:', err);
      setError('Erreur lors de la mise à jour du taux');
    }
  };

  // Helper to calculate share based on ratio
  const calculateShare = (amount, ratio, isPayerUser1) => {
    const absAmount = Math.abs(parseFloat(amount));
    const r = ratio !== undefined && ratio !== null ? ratio : 0.5;
    // If payer is user1, user2 owes user2's share (1-ratio)
    // If payer is user2, user1 owes user1's share (ratio)
    if (isPayerUser1) {
      return absAmount * (1 - r); // User2 owes this to User1
    } else {
      return absAmount * r; // User1 owes this to User2
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

  if (noCouple) {
    return (
      <>
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-8 text-center">
            <ScaleIcon className="mx-auto h-16 w-16 text-pink-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pas encore en couple</h2>
            <p className="text-gray-600 mb-6">
              Pour accéder à l'harmonisation des dépenses, vous devez d'abord créer ou rejoindre un couple.
            </p>
            <a href="/couple" className="px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700">
              Gérer le couple
            </a>
          </div>
        </div>
      </>
    );
  }

  const user1 = balance?.couple?.user1;
  const user2 = balance?.couple?.user2;
  const netBalance = parseFloat(balance?.balance?.netBalance || 0);
  const user1Paid = parseFloat(balance?.balance?.user1?.totalPaid || 0);
  const user2Paid = parseFloat(balance?.balance?.user2?.totalPaid || 0);

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Harmonisation</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Ajouter une dépense
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Balance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-500 mb-1">
              {user1?.firstName || 'Vous'} a payé
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(Math.abs(user1Paid))}
            </p>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-500 mb-1">
              {user2?.firstName || 'Partenaire'} a payé
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(Math.abs(user2Paid))}
            </p>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-sm text-gray-500 mb-1">Solde</p>
            <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(netBalance))}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {netBalance >= 0 ? 'On vous doit' : 'Vous devez'}
            </p>
          </div>
        </div>

        {/* Settle Up Section */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-8 mb-8 text-center">
          <ScaleIcon className="mx-auto h-12 w-12 text-pink-600 mb-4" />
          
          {Math.abs(netBalance) > 0.01 ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {netBalance > 0 
                  ? `${user2?.firstName || 'Votre partenaire'} vous doit`
                  : `Vous devez à ${user2?.firstName || 'votre partenaire'}`
                }
              </h2>
              <p className="text-4xl font-bold text-pink-600 mb-4">
                {formatCurrency(Math.abs(netBalance))}
              </p>
              
              {/* Détail du calcul */}
              <div className="bg-white/60 rounded-lg p-4 mb-6 max-w-md mx-auto text-left">
                <p className="text-sm font-medium text-gray-700 mb-3 text-center">Détail du calcul :</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{user1?.firstName || 'Vous'} a payé en commun :</span>
                    <span className="font-medium text-gray-900">{formatCurrency(Math.abs(user1Paid))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{user2?.firstName || 'Partenaire'} a payé en commun :</span>
                    <span className="font-medium text-gray-900">{formatCurrency(Math.abs(user2Paid))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{user2?.firstName || 'Partenaire'} doit à {user1?.firstName || 'Vous'} :</span>
                    <span className="font-medium text-gray-900">{formatCurrency(parseFloat(balance?.balance?.user2?.totalOwed || 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{user1?.firstName || 'Vous'} doit à {user2?.firstName || 'Partenaire'} :</span>
                    <span className="font-medium text-gray-900">{formatCurrency(parseFloat(balance?.balance?.user1?.totalOwed || 0))}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    {netBalance > 0 ? (
                      <div className="flex flex-col text-green-600">
                        <span className="font-bold">→ {user2?.firstName || 'Partenaire'} vous doit {formatCurrency(Math.abs(netBalance))}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col text-red-600">
                        <span className="font-bold">→ Vous devez {formatCurrency(Math.abs(netBalance))} à {user2?.firstName || 'Partenaire'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {success ? (
                <div className="inline-flex items-center px-6 py-3 bg-green-50 rounded-lg">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                  <span className="text-green-800 font-medium">
                    Régularisation enregistrée !
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className="px-8 py-4 bg-pink-600 text-white text-lg rounded-lg hover:bg-pink-700 disabled:opacity-50 font-medium shadow-lg"
                >
                  {settling ? 'Enregistrement...' : '✓ Marquer comme réglé'}
                </button>
              )}
            </>
          ) : (
            <>
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                Vous êtes à jour !
              </h2>
              <p className="text-gray-600">
                Aucune régularisation nécessaire pour le moment
              </p>
            </>
          )}
        </div>

        {/* Dépenses communes à régulariser - Deux tableaux côte à côte */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Tableau des dépenses payées par user1 */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-pink-50">
              <h2 className="text-lg font-semibold text-gray-900">
                💳 Payé par {user1?.firstName || 'Membre 1'}
              </h2>
              <p className="text-sm text-gray-500">
                {user1Transactions.length} dépense{user1Transactions.length > 1 ? 's' : ''} commune{user1Transactions.length > 1 ? 's' : ''}
              </p>
            </div>
            
            {user1Transactions.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <BanknotesIcon className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm">Aucune dépense commune</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {user1Transactions.map((tx) => {
                  const ratioPercent = tx.ratio !== undefined && tx.ratio !== null ? Math.round(tx.ratio * 100) : 50;
                  const otherShare = calculateShare(tx.amount, tx.ratio, true);
                  return (
                  <li key={tx.id} className="px-4 sm:px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-2">
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
                            <p className="text-sm font-medium text-gray-900 truncate">{tx.label}</p>
                            <button 
                              onClick={() => startEditLabel(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                              title="Modifier le libellé"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatDate(tx.date)} • {tx.category || 'Autre'}
                          {tx.type === 'abonnement' && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              Abo
                            </span>
                          )}
                          {tx.isRevenue && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Revenu partagé
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingAmountId === tx.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={editingAmountValue}
                              onChange={(e) => setEditingAmountValue(e.target.value)}
                              className="w-20 px-2 py-1 border rounded text-sm text-right"
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
                          <div className="flex items-center gap-1 group">
                            <span className={`text-sm font-semibold whitespace-nowrap ${tx.isRevenue ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(tx.amount)}
                            </span>
                            <button 
                              onClick={() => startEditAmount(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                              title="Modifier le montant"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => setShowClassifyModal(tx)}
                          className="text-gray-400 hover:text-indigo-600 p-1"
                          title="Corriger la classification"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(tx)}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Ratio et part à régulariser */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <button
                        onClick={() => setShowRatioModal({ ...tx, currentRatio: ratioPercent })}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                      >
                        <ScaleIcon className="h-3 w-3" />
                        <span>{user1?.firstName}: {ratioPercent}% / {user2?.firstName}: {100 - ratioPercent}%</span>
                      </button>
                      <span className={tx.isRevenue ? 'text-green-600 font-medium' : 'text-purple-600 font-medium'}>
                        → {tx.isRevenue ? `${user1?.firstName} reçoit` : `${user2?.firstName} doit`} {formatCurrency(otherShare)}
                      </span>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
            {user1Transactions.length > 0 && (
              <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-600">Total payé :</span>
                  <span className="text-pink-600">{formatCurrency(Math.abs(user1Paid))}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tableau des dépenses payées par user2 */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-purple-50">
              <h2 className="text-lg font-semibold text-gray-900">
                💳 Payé par {user2?.firstName || 'Membre 2'}
              </h2>
              <p className="text-sm text-gray-500">
                {user2Transactions.length} dépense{user2Transactions.length > 1 ? 's' : ''} commune{user2Transactions.length > 1 ? 's' : ''}
              </p>
            </div>
            
            {user2Transactions.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                <BanknotesIcon className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                <p className="text-sm">Aucune dépense commune</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                {user2Transactions.map((tx) => {
                  const ratioPercent = tx.ratio !== undefined && tx.ratio !== null ? Math.round(tx.ratio * 100) : 50;
                  const otherShare = calculateShare(tx.amount, tx.ratio, false);
                  return (
                  <li key={tx.id} className="px-4 sm:px-6 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-2">
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
                            <p className="text-sm font-medium text-gray-900 truncate">{tx.label}</p>
                            <button 
                              onClick={() => startEditLabel(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                              title="Modifier le libellé"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          {formatDate(tx.date)} • {tx.category || 'Autre'}
                          {tx.type === 'abonnement' && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              Abo
                            </span>
                          )}
                          {tx.isRevenue && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Revenu partagé
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingAmountId === tx.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={editingAmountValue}
                              onChange={(e) => setEditingAmountValue(e.target.value)}
                              className="w-20 px-2 py-1 border rounded text-sm text-right"
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
                          <div className="flex items-center gap-1 group">
                            <span className={`text-sm font-semibold whitespace-nowrap ${tx.isRevenue ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(tx.amount)}
                            </span>
                            <button 
                              onClick={() => startEditAmount(tx)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                              title="Modifier le montant"
                            >
                              <PencilIcon className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => setShowClassifyModal(tx)}
                          className="text-gray-400 hover:text-indigo-600 p-1"
                          title="Corriger la classification"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(tx)}
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Ratio et part à régulariser */}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <button
                        onClick={() => setShowRatioModal({ ...tx, currentRatio: ratioPercent })}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                      >
                        <ScaleIcon className="h-3 w-3" />
                        <span>{user1?.firstName}: {ratioPercent}% / {user2?.firstName}: {100 - ratioPercent}%</span>
                      </button>
                      <span className={tx.isRevenue ? 'text-green-600 font-medium' : 'text-pink-600 font-medium'}>
                        → {tx.isRevenue ? `${user2?.firstName} reçoit` : `${user1?.firstName} doit`} {formatCurrency(otherShare)}
                      </span>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
            {user2Transactions.length > 0 && (
              <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-600">Total payé :</span>
                  <span className="text-purple-600">{formatCurrency(Math.abs(user2Paid))}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settlement History */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Historique des régularisations
            </h2>
          </div>
          
          {history.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Aucune régularisation pour le moment
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {history.map((settlement) => (
                <li key={settlement.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {settlement.note || 'Régularisation'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(settlement.settled_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-semibold text-pink-600">
                        {formatCurrency(settlement.amount)}
                      </p>
                      <button
                        onClick={() => setShowDeleteSettlementModal(settlement)}
                        className="text-gray-400 hover:text-red-600"
                        title="Annuler cette régularisation"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Ajouter une dépense</h3>
              <button onClick={() => setShowAddModal(false)}>
                <XMarkIcon className="h-6 w-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newExpense.label}
                  onChange={(e) => setNewExpense({...newExpense, label: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
                  placeholder="Ex: Courses Carrefour"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="commune"
                      checked={newExpense.type === 'commune'}
                      onChange={(e) => setNewExpense({...newExpense, type: e.target.value})}
                      className="mr-2 text-pink-600 focus:ring-pink-500"
                    />
                    Commune (partagée)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="individuelle"
                      checked={newExpense.type === 'individuelle'}
                      onChange={(e) => setNewExpense({...newExpense, type: e.target.value})}
                      className="mr-2 text-pink-600 focus:ring-pink-500"
                    />
                    Individuelle
                  </label>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addingExpense}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50"
                >
                  {addingExpense ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Supprimer cette transaction ?</h3>
            <p className="text-gray-600 mb-2">{showDeleteModal.label}</p>
            <p className="text-lg font-bold text-gray-900 mb-6">
              {formatCurrency(showDeleteModal.amount)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteTransaction(showDeleteModal.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Settlement Modal */}
      {showDeleteSettlementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Annuler cette régularisation ?</h3>
            <p className="text-gray-600 mb-2">{showDeleteSettlementModal.note || 'Régularisation'}</p>
            <p className="text-sm text-gray-500 mb-2">
              {formatDate(showDeleteSettlementModal.settled_at)}
            </p>
            <p className="text-lg font-bold text-gray-900 mb-4">
              {formatCurrency(showDeleteSettlementModal.amount)}
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-6">
              <p className="text-sm text-yellow-800">
                ⚠️ Les soldes seront recalculés sans cette régularisation
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSettlementModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Non, garder
              </button>
              <button
                onClick={() => handleDeleteSettlement(showDeleteSettlementModal.id)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Oui, annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Classification Correction Modal */}
      <ClassificationCorrectionModal
        transaction={showClassifyModal}
        isOpen={!!showClassifyModal}
        onClose={() => setShowClassifyModal(null)}
        onSuccess={() => {
          setShowClassifyModal(null);
          fetchData();
        }}
      />

      {/* Ratio Adjustment Modal */}
      {showRatioModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Ajuster le taux de prise en charge
              </h3>
              <p className="text-sm text-gray-500 mt-1 truncate">
                {showRatioModal.label}
              </p>
            </div>
            
            <div className="px-6 py-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-pink-600 font-medium">{user1?.firstName}: {showRatioModal.currentRatio}%</span>
                  <span className="text-purple-600 font-medium">{user2?.firstName}: {100 - showRatioModal.currentRatio}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={showRatioModal.currentRatio}
                  onChange={(e) => setShowRatioModal({
                    ...showRatioModal,
                    currentRatio: parseInt(e.target.value)
                  })}
                  className="w-full h-2 bg-gradient-to-r from-pink-200 to-purple-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>50/50</span>
                  <span>100%</span>
                </div>
                
                {/* Raccourcis */}
                <div className="flex gap-2 mt-4">
                  {[0, 25, 50, 75, 100].map(val => (
                    <button
                      key={val}
                      onClick={() => setShowRatioModal({...showRatioModal, currentRatio: val})}
                      className={`flex-1 py-1 text-xs rounded ${
                        showRatioModal.currentRatio === val 
                          ? 'bg-pink-600 text-white' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                </div>

                {/* Calcul prévisuel */}
                <div className="mt-4 p-3 bg-white rounded border border-gray-200 text-sm">
                  <p className="text-gray-600 mb-1">Pour {formatCurrency(showRatioModal.amount)} :</p>
                  <div className="flex justify-between">
                    <span>{user1?.firstName} paie:</span>
                    <span className="font-medium">{formatCurrency(Math.abs(parseFloat(showRatioModal.amount)) * showRatioModal.currentRatio / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{user2?.firstName} paie:</span>
                    <span className="font-medium">{formatCurrency(Math.abs(parseFloat(showRatioModal.amount)) * (100 - showRatioModal.currentRatio) / 100)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowRatioModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleUpdateRatio(showRatioModal, showRatioModal.currentRatio)}
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api, { transactionAPI } from '../services/api';
import { ArrowUpTrayIcon, CheckCircleIcon, BanknotesIcon, TrashIcon, ExclamationTriangleIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const SUPPORTED_BANKS = [
  { id: 'auto', name: 'Détection automatique', description: 'Le système détecte la banque (CSV ou PDF)' },
  { id: 'credit_agricole', name: 'Crédit Agricole', description: 'Format CSV (Date;Libellé;Débit;Crédit)' },
  { id: 'revolut', name: 'Revolut', description: 'Export CSV Revolut' },
  { id: 'credit_mutuel_bretagne', name: 'Crédit Mutuel (CMB)', description: 'Relevé PDF' },
  { id: 'boursorama', name: 'Boursorama', description: 'Bientôt disponible', disabled: true },
];

export default function ImportCSV() {
  const [file, setFile] = useState(null);
  const [selectedBank, setSelectedBank] = useState('auto');
  const [preview, setPreview] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Existing accounts
  const [existingAccounts, setExistingAccounts] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Edit label state for import preview
  const [editingLabelIdx, setEditingLabelIdx] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  
  // Edit amount state for import preview
  const [editingAmountIdx, setEditingAmountIdx] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');

  useEffect(() => {
    fetchExistingAccounts();
  }, []);

  const fetchExistingAccounts = async () => {
    try {
      const response = await api.get('/api/transactions/accounts');
      setExistingAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    setDeleting(true);
    try {
      await api.delete(`/api/transactions/accounts/${accountId}`);
      setShowDeleteModal(null);
      await fetchExistingAccounts();
    } catch (err) {
      setError('Erreur lors de la suppression: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeleting(false);
    }
  };

  // Edit label functions for import preview
  const startEditLabel = (idx, label) => {
    setEditingLabelIdx(idx);
    setEditingLabelValue(label);
  };

  const cancelEditLabel = () => {
    setEditingLabelIdx(null);
    setEditingLabelValue('');
  };

  const saveEditLabel = (idx) => {
    if (preview && preview.transactions) {
      const newTransactions = [...preview.transactions];
      newTransactions[idx] = { ...newTransactions[idx], label: editingLabelValue };
      setPreview({ ...preview, transactions: newTransactions });
    }
    setEditingLabelIdx(null);
    setEditingLabelValue('');
  };

  // Edit amount functions for import preview
  const startEditAmount = (idx, amount) => {
    setEditingAmountIdx(idx);
    setEditingAmountValue(String(Math.abs(amount)));
  };

  const cancelEditAmount = () => {
    setEditingAmountIdx(null);
    setEditingAmountValue('');
  };

  const saveEditAmount = (idx) => {
    if (preview && preview.transactions) {
      const newTransactions = [...preview.transactions];
      const currentAmount = newTransactions[idx].amount;
      const newAmount = parseFloat(editingAmountValue) || 0;
      // Préserver le signe (débit négatif, crédit positif)
      newTransactions[idx] = { 
        ...newTransactions[idx], 
        amount: currentAmount < 0 ? -Math.abs(newAmount) : Math.abs(newAmount)
      };
      setPreview({ ...preview, transactions: newTransactions });
    }
    setEditingAmountIdx(null);
    setEditingAmountValue('');
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.pdf')) {
      setError('Veuillez sélectionner un fichier CSV ou PDF');
      return;
    }

    setFile(selectedFile);
    setError('');
    setSuccess(false);
    setSelectedAccount(null);

    // Upload for preview
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (selectedBank !== 'auto') {
      formData.append('bank', selectedBank);
    }

    setLoading(true);
    try {
      const response = await transactionAPI.upload(formData);
      setPreview(response.data);
      // Auto-select first account if only one
      if (response.data.accounts?.length === 1) {
        setSelectedAccount(response.data.accounts[0].number);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'analyse du fichier');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setLoading(true);
    setError('');

    // Filter transactions by selected account if applicable
    let transactionsToImport = preview.transactions;
    let accountNumber = selectedAccount || preview.accountNumber;

    if (selectedAccount && preview.accounts?.length > 1) {
      transactionsToImport = preview.transactions.filter(t => t.accountNumber === selectedAccount);
    }

    try {
      await transactionAPI.import({
        transactions: transactionsToImport,
        accountNumber: accountNumber,
        bank: preview.bank
      });
      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'import');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Importer un CSV</h1>

        {/* Existing Accounts Section */}
        {existingAccounts.length > 0 && (
          <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6">
            <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
              📁 Importations ({existingAccounts.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {existingAccounts.map((account) => (
                <div
                  key={account.id}
                  className="p-3 sm:p-4 border rounded-lg bg-gray-50 flex items-start justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{account.account_label || account.name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{account.bank_name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">N° {account.account_number}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {account.transaction_count || 0} tx
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(account)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-2"
                    title="Supprimer cette importation"
                  >
                    <TrashIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bank Selector */}
        <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">1. Choisissez votre banque</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {SUPPORTED_BANKS.map((bank) => (
              <button
                key={bank.id}
                onClick={() => !bank.disabled && setSelectedBank(bank.id)}
                disabled={bank.disabled}
                className={`p-2 sm:p-3 rounded-lg border-2 text-left transition ${
                  selectedBank === bank.id
                    ? 'border-pink-500 bg-pink-50'
                    : bank.disabled
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                    : 'border-gray-200 hover:border-pink-300'
                }`}
              >
                <p className={`text-xs sm:text-sm font-medium ${selectedBank === bank.id ? 'text-pink-700' : 'text-gray-900'}`}>
                  {bank.name}
                </p>
                <p className="text-xs text-gray-500 mt-1 hidden sm:block">{bank.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">2. Sélectionnez votre fichier</h2>
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 sm:p-12 text-center hover:border-pink-500 cursor-pointer transition">
              <ArrowUpTrayIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Cliquez pour sélectionner un fichier CSV ou PDF
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {selectedBank === 'auto' 
                  ? 'Détection automatique (CSV ou PDF CMB)'
                  : `Format : ${SUPPORTED_BANKS.find(b => b.id === selectedBank)?.name}`
                }
              </p>
              <input
                type="file"
                accept=".csv,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </label>

          {file && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-700">
                <strong>Fichier :</strong> {file.name}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-50 rounded flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-sm text-green-800">
                Import réussi ! Redirection...
              </p>
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <>
            {/* Accounts detected */}
            {preview.accounts && preview.accounts.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  3. Comptes détectés ({preview.accounts.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {preview.accounts.map((account) => {
                    const accountTxCount = preview.transactions?.filter(
                      t => t.accountNumber === account.number
                    ).length || 0;
                    
                    return (
                      <button
                        key={account.number}
                        onClick={() => setSelectedAccount(account.number)}
                        className={`p-4 rounded-lg border-2 text-left transition ${
                          selectedAccount === account.number
                            ? 'border-pink-500 bg-pink-50'
                            : 'border-gray-200 hover:border-pink-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{account.label}</p>
                            <p className="text-xs text-gray-500 font-mono">{account.maskedNumber}</p>
                          </div>
                          <BanknotesIcon className={`h-5 w-5 ${
                            selectedAccount === account.number ? 'text-pink-500' : 'text-gray-400'
                          }`} />
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          {accountTxCount} transaction(s)
                        </p>
                        {account.balance && (
                          <p className="text-sm font-medium text-green-600">
                            Solde : {account.balance.toLocaleString('fr-FR')} €
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {preview.accounts.length > 1 && (
                  <p className="text-xs text-gray-500 mt-3">
                    💡 Cliquez sur un compte pour importer uniquement ses transactions
                  </p>
                )}
              </div>
            )}

            {/* Transactions preview */}
            {preview.transactions && preview.transactions.length > 0 && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      4. Aperçu des transactions
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedAccount 
                        ? preview.transactions.filter(t => t.accountNumber === selectedAccount).length
                        : preview.transactions.length
                      } transaction(s) à importer - {preview.bank || 'Banque détectée'}
                    </p>
                  </div>
                  <button
                    onClick={handleImport}
                    disabled={loading || (!selectedAccount && preview.accounts?.length > 1)}
                    className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 disabled:opacity-50"
                  >
                    {loading ? 'Import...' : 'Confirmer l\'import'}
                  </button>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Libellé
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Catégorie
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(selectedAccount 
                        ? preview.transactions.map((t, idx) => ({ ...t, originalIdx: idx })).filter(t => t.accountNumber === selectedAccount)
                        : preview.transactions.map((t, idx) => ({ ...t, originalIdx: idx }))
                      ).map((t) => {
                        const idx = t.originalIdx;
                        return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(t.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {editingLabelIdx === idx ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingLabelValue}
                                  onChange={(e) => setEditingLabelValue(e.target.value)}
                                  className="flex-1 px-2 py-1 border rounded text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditLabel(idx);
                                    if (e.key === 'Escape') cancelEditLabel();
                                  }}
                                />
                                <button onClick={() => saveEditLabel(idx)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button onClick={cancelEditLabel} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <span className="truncate">{t.label}</span>
                                <button 
                                  onClick={() => startEditLabel(idx, t.label)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                                  title="Modifier le libellé pour aider l'IA"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                              {t.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                            {editingAmountIdx === idx ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingAmountValue}
                                  onChange={(e) => setEditingAmountValue(e.target.value)}
                                  className="w-24 px-2 py-1 border rounded text-sm text-right"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditAmount(idx);
                                    if (e.key === 'Escape') cancelEditAmount();
                                  }}
                                />
                                <button onClick={() => saveEditAmount(idx)} className="text-green-600 hover:bg-green-50 p-1 rounded">
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button onClick={cancelEditAmount} className="text-red-600 hover:bg-red-50 p-1 rounded">
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1 group">
                                <span className={t.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {t.amount >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR', {
                                    style: 'currency',
                                    currency: 'EUR'
                                  }).format(t.amount)}
                                </span>
                                <button 
                                  onClick={() => startEditAmount(idx, t.amount)}
                                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-pink-500 p-1 rounded"
                                  title="Modifier le montant"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Supprimer l'importation</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                Êtes-vous sûr de vouloir supprimer le compte <strong>{showDeleteModal.account_label || showDeleteModal.name}</strong> ?
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  ⚠️ Cette action supprimera également <strong>toutes les transactions</strong> associées à ce compte. Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteAccount(showDeleteModal.id)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
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

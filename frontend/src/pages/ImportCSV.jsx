import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api, { transactionAPI } from '../services/api';
import { ArrowUpTrayIcon, CheckCircleIcon, BanknotesIcon, TrashIcon, ExclamationTriangleIcon, PencilIcon, CheckIcon, XMarkIcon, InformationCircleIcon, ComputerDesktopIcon, DevicePhoneMobileIcon, DocumentTextIcon, TableCellsIcon, QuestionMarkCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

const SUPPORTED_BANKS = [
  { id: 'auto', name: 'Détection automatique', description: 'Le système détecte automatiquement', formats: ['CSV', 'PDF'] },
  { id: 'credit_agricole', name: 'Crédit Agricole', description: 'Relevé bancaire', formats: ['CSV', 'PDF'] },
  { id: 'cic', name: 'CIC', description: 'Relevé bancaire', formats: ['CSV'] },
  { id: 'revolut', name: 'Revolut', description: 'Export depuis l\'app mobile', formats: ['CSV'] },
  { id: 'credit_mutuel_bretagne', name: 'Crédit Mutuel (CMB)', description: 'Relevé bancaire', formats: ['CSV', 'PDF'] },
  { id: 'boursorama', name: 'Boursorama', description: 'Bientôt disponible', formats: [], disabled: true },
];

// Tutoriels par banque/appareil/format
const BANK_TUTORIALS = {
  credit_agricole: {
    name: 'Crédit Agricole',
    computer: {
      csv: [
        'Connectez-vous sur www.credit-agricole.fr',
        'Allez dans "Mes comptes" → "Historique des opérations"',
        'Cliquez sur "Télécharger" ou "Exporter"',
        'Sélectionnez le format CSV et la période souhaitée',
        'Téléchargez le fichier'
      ],
      pdf: [
        'Connectez-vous sur www.credit-agricole.fr',
        'Allez dans "Documents" → "Relevés de compte"',
        'Cliquez sur le relevé souhaité pour le télécharger en PDF'
      ]
    },
    phone: {
      csv: [
        '⚠️ L\'export CSV n\'est pas disponible depuis l\'app mobile',
        'Utilisez un ordinateur pour exporter en CSV',
        'Ou téléchargez le relevé PDF depuis l\'app'
      ],
      pdf: [
        'Ouvrez l\'app Ma Banque (Crédit Agricole)',
        'Allez dans "Documents" → "Relevés"',
        'Téléchargez le relevé PDF souhaité'
      ]
    }
  },
  revolut: {
    name: 'Revolut',
    computer: {
      csv: [
        '⚠️ L\'export n\'est pas disponible depuis le site web',
        'Utilisez l\'application mobile Revolut pour exporter vos transactions'
      ],
      pdf: [
        '⚠️ L\'export n\'est pas disponible depuis le site web',
        'Utilisez l\'application mobile Revolut'
      ]
    },
    phone: {
      csv: [
        'Ouvrez l\'app Revolut',
        'Appuyez sur votre compte principal',
        'Faites défiler et appuyez sur "Relevés"',
        'Choisissez "Excel", la période, puis partagez le fichier'
      ],
      pdf: [
        'Le format CSV est recommandé pour Revolut',
        'Suivez les étapes CSV et choisissez "Excel"'
      ]
    }
  },
  credit_mutuel_bretagne: {
    name: 'Crédit Mutuel de Bretagne',
    computer: {
      csv: [
        'Connectez-vous sur www.cmb.fr',
        'Allez dans "Mes comptes" → sélectionnez votre compte',
        'Cliquez sur "Télécharger" ou "Exporter"',
        'Sélectionnez le format CSV'
      ],
      pdf: [
        'Connectez-vous sur www.cmb.fr',
        'Allez dans "E-Documents" → "Relevés de compte"',
        'Cliquez sur le relevé PDF à télécharger'
      ]
    },
    phone: {
      csv: [
        '⚠️ L\'export CSV n\'est pas disponible depuis l\'app mobile',
        'Utilisez un ordinateur pour exporter en CSV',
        'Ou téléchargez le relevé PDF depuis l\'app'
      ],
      pdf: [
        'Ouvrez l\'app Crédit Mutuel',
        'Allez dans "Documents" → "Relevés"',
        'Téléchargez le relevé PDF souhaité'
      ]
    }
  },
  cic: {
    name: 'CIC',
    computer: {
      csv: [
        'Connectez-vous sur www.cic.fr',
        'Allez dans "Mes comptes" → sélectionnez votre compte',
        'Cliquez sur "Télécharger" ou "Exporter les opérations"',
        'Sélectionnez le format CSV et la période',
        'Téléchargez le fichier'
      ],
      pdf: [
        'Connectez-vous sur www.cic.fr',
        'Allez dans "E-Documents" → "Relevés de compte"',
        'Cliquez sur le relevé PDF à télécharger'
      ]
    },
    phone: {
      csv: [
        '⚠️ L\'export CSV n\'est pas disponible depuis l\'app mobile CIC',
        'Utilisez un ordinateur pour exporter en CSV',
        'Ou téléchargez le relevé PDF depuis l\'app'
      ],
      pdf: [
        'Ouvrez l\'app CIC',
        'Allez dans "Documents" → "Relevés"',
        'Téléchargez le relevé PDF souhaité'
      ]
    }
  }
};

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
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  
  // Edit label state for import preview
  const [editingLabelIdx, setEditingLabelIdx] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  
  // Edit amount state for import preview
  const [editingAmountIdx, setEditingAmountIdx] = useState(null);
  const [editingAmountValue, setEditingAmountValue] = useState('');
  
  // Excluded transactions state
  const [excludedTransactions, setExcludedTransactions] = useState(new Set());
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialBank, setTutorialBank] = useState('credit_agricole');
  const [tutorialDevice, setTutorialDevice] = useState('computer');
  const [tutorialFormat, setTutorialFormat] = useState('csv');

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
    setExcludedTransactions(new Set());

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

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      // Simulate file input event
      const fileName = droppedFile.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.pdf')) {
        setError('Veuillez sélectionner un fichier CSV ou PDF');
        return;
      }

      setFile(droppedFile);
      setError('');
      setSuccess(false);
      setSelectedAccount(null);

      const formData = new FormData();
      formData.append('file', droppedFile);
      if (selectedBank !== 'auto') {
        formData.append('bank', selectedBank);
      }

      setLoading(true);
      try {
        const response = await transactionAPI.upload(formData);
        setPreview(response.data);
        if (response.data.accounts?.length === 1) {
          setSelectedAccount(response.data.accounts[0].number);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors de l\'analyse du fichier');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setLoading(true);
    setError('');

    // Filter transactions by selected account if applicable
    let transactionsToImport = preview.transactions.filter((_, idx) => !excludedTransactions.has(idx));
    let accountNumber = selectedAccount || preview.accountNumber;

    if (selectedAccount && preview.accounts?.length > 1) {
      transactionsToImport = transactionsToImport.filter(t => t.accountNumber === selectedAccount);
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
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-28 md:pb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-theme-primary mb-4 sm:mb-6">Importer vos transactions</h1>
        
        {/* Info banner - CSV recommended */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">💡 Le format CSV est recommandé</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                L'import CSV est plus précis et fiable que le PDF. Si votre banque propose les deux formats, privilégiez le CSV.
              </p>
            </div>
          </div>
        </div>
        
        {/* Tutorial Section - Collapsible */}
        <div className="bg-theme-card shadow rounded-lg mb-6 overflow-hidden">
          <button
            onClick={() => setShowTutorial(!showTutorial)}
            className="w-full p-4 sm:p-6 flex items-center justify-between text-left hover:bg-theme-secondary transition"
          >
            <div className="flex items-center">
              <QuestionMarkCircleIcon className="h-6 w-6 text-pdc-cyan-500 mr-3" />
              <div>
                <h2 className="text-base sm:text-lg font-medium text-theme-primary">Comment obtenir mon relevé bancaire ?</h2>
                <p className="text-sm text-theme-tertiary">Guide étape par étape selon votre banque</p>
              </div>
            </div>
            {showTutorial ? (
              <ChevronUpIcon className="h-5 w-5 text-theme-muted" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-theme-muted" />
            )}
          </button>
          
          {showTutorial && (
            <div className="border-t border-theme-secondary p-4 sm:p-6">
              {/* Step 1: Choose bank */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-theme-secondary mb-2">1. Votre banque</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(BANK_TUTORIALS).map(([id, bank]) => (
                    <button
                      key={id}
                      onClick={() => setTutorialBank(id)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition ${
                        tutorialBank === id
                          ? 'border-pdc-cyan-500 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20 text-pdc-cyan-dark'
                          : 'border-theme-secondary hover:border-pdc-cyan-300 text-theme-secondary'
                      }`}
                    >
                      {bank.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Step 2: Choose device */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-theme-secondary mb-2">2. Votre appareil</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTutorialDevice('computer')}
                    className={`flex items-center px-4 py-3 rounded-lg border-2 transition ${
                      tutorialDevice === 'computer'
                        ? 'border-pdc-cyan-500 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20'
                        : 'border-theme-secondary hover:border-pdc-cyan-300'
                    }`}
                  >
                    <ComputerDesktopIcon className={`h-6 w-6 mr-2 ${tutorialDevice === 'computer' ? 'text-pdc-cyan-500' : 'text-theme-muted'}`} />
                    <span className={`text-sm font-medium ${tutorialDevice === 'computer' ? 'text-pdc-cyan-dark' : 'text-theme-secondary'}`}>Ordinateur</span>
                  </button>
                  <button
                    onClick={() => setTutorialDevice('phone')}
                    className={`flex items-center px-4 py-3 rounded-lg border-2 transition ${
                      tutorialDevice === 'phone'
                        ? 'border-pdc-cyan-500 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20'
                        : 'border-theme-secondary hover:border-pdc-cyan-300'
                    }`}
                  >
                    <DevicePhoneMobileIcon className={`h-6 w-6 mr-2 ${tutorialDevice === 'phone' ? 'text-pdc-cyan-500' : 'text-theme-muted'}`} />
                    <span className={`text-sm font-medium ${tutorialDevice === 'phone' ? 'text-pdc-cyan-dark' : 'text-theme-secondary'}`}>Téléphone</span>
                  </button>
                </div>
              </div>
              
              {/* Step 3: Choose format */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-theme-secondary mb-2">3. Format d'export</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTutorialFormat('csv')}
                    className={`flex items-center px-4 py-3 rounded-lg border-2 transition ${
                      tutorialFormat === 'csv'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-theme-secondary hover:border-green-300'
                    }`}
                  >
                    <TableCellsIcon className={`h-6 w-6 mr-2 ${tutorialFormat === 'csv' ? 'text-green-500' : 'text-theme-muted'}`} />
                    <div className="text-left">
                      <span className={`text-sm font-medium block ${tutorialFormat === 'csv' ? 'text-green-700 dark:text-green-400' : 'text-theme-secondary'}`}>CSV</span>
                      <span className="text-xs text-theme-tertiary">Recommandé</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setTutorialFormat('pdf')}
                    className={`flex items-center px-4 py-3 rounded-lg border-2 transition ${
                      tutorialFormat === 'pdf'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-theme-secondary hover:border-orange-300'
                    }`}
                  >
                    <DocumentTextIcon className={`h-6 w-6 mr-2 ${tutorialFormat === 'pdf' ? 'text-orange-500' : 'text-theme-muted'}`} />
                    <div className="text-left">
                      <span className={`text-sm font-medium block ${tutorialFormat === 'pdf' ? 'text-orange-700 dark:text-orange-400' : 'text-theme-secondary'}`}>PDF</span>
                      <span className="text-xs text-theme-tertiary">Relevé mensuel</span>
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Tutorial steps */}
              <div className="bg-theme-secondary rounded-lg p-4">
                <h3 className="text-sm font-medium text-theme-primary mb-3">
                  📝 Étapes pour {BANK_TUTORIALS[tutorialBank]?.name} ({tutorialDevice === 'computer' ? 'Ordinateur' : 'Téléphone'} - {tutorialFormat.toUpperCase()})
                </h3>
                <ol className="list-decimal list-inside space-y-2">
                  {BANK_TUTORIALS[tutorialBank]?.[tutorialDevice]?.[tutorialFormat]?.map((step, idx) => (
                    <li key={idx} className="text-sm text-theme-secondary">{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Existing Accounts Section */}
        {existingAccounts.length > 0 && (
          <div className="bg-theme-card shadow rounded-lg p-4 sm:p-6 mb-6">
            <h2 className="text-base sm:text-lg font-medium text-theme-primary mb-4">
              📁 Importations ({existingAccounts.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {existingAccounts.map((account) => (
                <div
                  key={account.id}
                  className="p-3 sm:p-4 border border-theme-secondary rounded-lg bg-theme-secondary flex items-start justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-theme-primary text-sm sm:text-base truncate">{account.account_label || account.name}</p>
                    <p className="text-xs sm:text-sm text-theme-tertiary truncate">{account.bank_name}</p>
                    <p className="text-xs text-theme-muted font-mono truncate">N° {account.account_number}</p>
                    <p className="text-xs text-theme-tertiary mt-1">
                      {account.transaction_count || 0} tx
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(account)}
                    className="p-1.5 sm:p-2 text-theme-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0 ml-2"
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
        <div className="bg-theme-card shadow rounded-lg p-4 sm:p-6 mb-6">
          <h2 className="text-base sm:text-lg font-medium text-theme-primary mb-3 sm:mb-4">1. Choisissez votre banque (optionnel)</h2>
          <p className="text-sm text-theme-tertiary mb-4">La détection automatique fonctionne dans la plupart des cas</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
            {SUPPORTED_BANKS.map((bank) => (
              <button
                key={bank.id}
                onClick={() => !bank.disabled && setSelectedBank(bank.id)}
                disabled={bank.disabled}
                className={`p-2 sm:p-3 rounded-lg border-2 text-left transition ${
                  selectedBank === bank.id
                    ? 'border-pdc-cyan-500 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20'
                    : bank.disabled
                    ? 'border-theme-secondary bg-theme-secondary cursor-not-allowed opacity-50'
                    : 'border-theme-secondary hover:border-pdc-cyan-300'
                }`}
              >
                <p className={`text-xs sm:text-sm font-medium ${selectedBank === bank.id ? 'text-pdc-cyan-dark' : 'text-theme-primary'}`}>
                  {bank.name}
                </p>
                {bank.formats && bank.formats.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {bank.formats.includes('CSV') && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        CSV
                      </span>
                    )}
                    {bank.formats.includes('PDF') && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        PDF
                      </span>
                    )}
                  </div>
                )}
                {bank.disabled && (
                  <p className="text-xs text-theme-muted mt-1">Bientôt</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-theme-card shadow rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-medium text-theme-primary mb-3 sm:mb-4">2. Sélectionnez votre fichier</h2>
          <label 
            className="block"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className={`border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
              isDragging 
                ? 'border-pdc-cyan-500 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20 scale-[1.02]' 
                : 'border-theme-primary hover:border-pdc-cyan-500'
            }`}>
              <ArrowUpTrayIcon className={`mx-auto h-10 w-10 sm:h-12 sm:w-12 transition-colors ${
                isDragging ? 'text-pdc-cyan-500' : 'text-theme-muted'
              }`} />
              <p className="mt-2 text-sm text-theme-secondary">
                {isDragging ? (
                  <span className="text-pdc-cyan font-medium">Déposez le fichier ici !</span>
                ) : (
                  <>Glissez-déposez ou cliquez pour sélectionner un fichier <strong>CSV</strong> ou <strong>PDF</strong></>
                )}
              </p>
              <p className="mt-1 text-xs text-theme-tertiary">
                Formats acceptés : .csv, .pdf
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
            <div className="mt-4 p-4 bg-theme-secondary rounded">
              <p className="text-sm text-theme-secondary">
                <strong>Fichier :</strong> {file.name}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded flex items-center">
              <CheckCircleIcon className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-sm text-green-800 dark:text-green-400">
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
              <div className="bg-theme-card shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-theme-primary mb-4">
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
                            ? 'border-pdc-cyan-500 bg-pdc-cyan-50 dark:bg-pdc-cyan-900/20'
                            : 'border-theme-secondary hover:border-pdc-cyan-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-theme-primary">{account.label}</p>
                            <p className="text-xs text-theme-tertiary font-mono">{account.maskedNumber}</p>
                          </div>
                          <BanknotesIcon className={`h-5 w-5 ${
                            selectedAccount === account.number ? 'text-pdc-cyan-500' : 'text-theme-muted'
                          }`} />
                        </div>
                        <p className="mt-2 text-sm text-theme-secondary">
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
                  <p className="text-xs text-theme-tertiary mt-3">
                    💡 Cliquez sur un compte pour importer uniquement ses transactions
                  </p>
                )}
              </div>
            )}

            {/* Transactions preview */}
            {preview.transactions && preview.transactions.length > 0 && (
              <div className="bg-theme-card shadow rounded-lg overflow-hidden">
                <div className="px-4 sm:px-6 py-5 sm:py-6 border-b-2 border-theme-secondary bg-gradient-to-r from-theme-card to-theme-secondary">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-theme-primary">
                        4. Aperçu des transactions
                      </h2>
                      <p className="text-sm text-theme-tertiary mt-1">
                        {selectedAccount 
                          ? preview.transactions.filter((t, idx) => t.accountNumber === selectedAccount && !excludedTransactions.has(idx)).length
                          : preview.transactions.filter((_, idx) => !excludedTransactions.has(idx)).length
                        } transaction(s) à importer - {preview.bank || 'Banque détectée'}
                        {excludedTransactions.size > 0 && (
                          <span className="ml-2 text-orange-500">
                            ({excludedTransactions.size} exclue{excludedTransactions.size > 1 ? 's' : ''})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-shrink-0">
                      <button
                        onClick={handleImport}
                        disabled={loading || (!selectedAccount && preview.accounts?.length > 1)}
                        className="px-8 py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-bold text-base transition-all hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 w-full sm:w-auto shadow-lg"
                      >
                        <CheckCircleIcon className="h-6 w-6" />
                        {loading ? 'Import en cours...' : 'Importer les transactions'}
                      </button>
                      {(!selectedAccount && preview.accounts?.length > 1) && (
                        <p className="text-xs text-orange-600 font-medium text-center sm:text-right bg-orange-50 px-3 py-1 rounded-lg">
                          ⚠️ Sélectionnez un compte ci-dessus
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96 custom-scrollbar">
                  <table className="min-w-full divide-y divide-theme-secondary">
                    <thead className="bg-theme-secondary sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                          Libellé
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                          Catégorie
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                          Montant
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-theme-tertiary uppercase tracking-wider">
                          
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-theme-card divide-y divide-theme-secondary">
                      {(selectedAccount 
                        ? preview.transactions.map((t, idx) => ({ ...t, originalIdx: idx })).filter(t => t.accountNumber === selectedAccount && !excludedTransactions.has(t.originalIdx))
                        : preview.transactions.map((t, idx) => ({ ...t, originalIdx: idx })).filter(t => !excludedTransactions.has(t.originalIdx))
                      ).map((t) => {
                        const idx = t.originalIdx;
                        return (
                        <tr key={idx} className="hover:bg-theme-secondary">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-primary">
                            {new Date(t.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 text-sm text-theme-primary">
                            {editingLabelIdx === idx ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingLabelValue}
                                  onChange={(e) => setEditingLabelValue(e.target.value)}
                                  className="flex-1 px-2 py-1 border border-theme-primary rounded text-sm bg-theme-card text-theme-primary"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditLabel(idx);
                                    if (e.key === 'Escape') cancelEditLabel();
                                  }}
                                />
                                <button onClick={() => saveEditLabel(idx)} className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded">
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button onClick={cancelEditLabel} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded">
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <span className="truncate">{t.label}</span>
                                <button 
                                  onClick={() => startEditLabel(idx, t.label)}
                                  className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-pdc-cyan-500 p-1 rounded"
                                  title="Modifier le libellé pour aider l'IA"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-theme-secondary text-theme-primary">
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
                                  className="w-24 px-2 py-1 border border-theme-primary rounded text-sm text-right bg-theme-card text-theme-primary"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditAmount(idx);
                                    if (e.key === 'Escape') cancelEditAmount();
                                  }}
                                />
                                <button onClick={() => saveEditAmount(idx)} className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded">
                                  <CheckIcon className="h-4 w-4" />
                                </button>
                                <button onClick={cancelEditAmount} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded">
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
                                  className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-pdc-cyan-500 p-1 rounded"
                                  title="Modifier le montant"
                                >
                                  <PencilIcon className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => {
                                setExcludedTransactions(prev => {
                                  const newSet = new Set(prev);
                                  newSet.add(idx);
                                  return newSet;
                                });
                              }}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"
                              title="Exclure cette transaction"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
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
          <div className="bg-theme-card rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary">Supprimer l'importation</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-theme-secondary mb-3">
                Êtes-vous sûr de vouloir supprimer le compte <strong>{showDeleteModal.account_label || showDeleteModal.name}</strong> ?
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  ⚠️ Cette action supprimera également <strong>toutes les transactions</strong> associées à ce compte. Cette action est irréversible.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                disabled={deleting}
                className="px-4 py-2 text-theme-secondary hover:bg-theme-secondary rounded-lg transition-colors"
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

import { useState, useEffect } from 'react';
import { classificationAPI } from '../services/api';
import { SparklesIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export default function AIClassificationPanel() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showReclassifyOptions, setShowReclassifyOptions] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        classificationAPI.getHealth(),
        classificationAPI.getStats()
      ]);
      setHealth(healthRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Error fetching AI data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClassifyAll = async () => {
    setClassifying(true);
    setError(null);
    setResult(null);

    try {
      const response = await classificationAPI.classifyAll();
      setResult(response.data.data);
      // Refresh stats after classification
      const statsRes = await classificationAPI.getStats();
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Classification error:', err);
      setError(err.response?.data?.error?.message || 'Erreur lors de la classification');
    } finally {
      setClassifying(false);
    }
  };

  const handleReclassify = async (mode) => {
    setReclassifying(true);
    setShowReclassifyOptions(false);
    setError(null);
    setResult(null);

    try {
      // Reset the transactions as "unclassified" so user can use the classify button
      const response = await classificationAPI.resetForReclassify(mode);
      setResult({ 
        classified: response.data.data.reset,
        isReset: true,
        mode: mode
      });
      // Refresh stats after reset - now they appear as unclassified
      const statsRes = await classificationAPI.getStats();
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Reset for reclassification error:', err);
      setError(err.response?.data?.error?.message || 'Erreur lors de la préparation à la reclassification');
    } finally {
      setReclassifying(false);
    }
  };

  // Get max transactions for reclassify options
  const maxTransactions = stats?.totalTransactions || 0;
  const reclassifyOptions = [
    { mode: 'last100', label: '100 dernières', max: 100 },
    { mode: 'last200', label: '200 dernières', max: 200 },
    { mode: 'last300', label: '300 dernières', max: 300 },
    { mode: 'last500', label: '500 dernières', max: 500 },
    { mode: 'all', label: 'Toutes', max: maxTransactions },
  ].filter(opt => opt.max <= maxTransactions || opt.mode === 'all');

  if (loading) {
    return (
      <div className="bg-theme-card shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-theme-tertiary rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-theme-tertiary rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const isConfigured = health?.configured;
  const isAvailable = health?.mistralAvailable;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-pdc-mint-50 dark:from-indigo-950/30 dark:to-pdc-mint-950/30 shadow rounded-lg p-6 border border-indigo-100 dark:border-indigo-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <SparklesIcon className="h-6 w-6 text-indigo-600 mr-2" />
          <h3 className="text-lg font-medium text-theme-primary">Classification IA</h3>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center">
          {isConfigured && isAvailable ? (
            <span className="flex items-center text-sm text-green-600">
              <CheckCircleIcon className="h-4 w-4 mr-1" />
              Mistral connecté
            </span>
          ) : isConfigured ? (
            <span className="flex items-center text-sm text-yellow-600">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
              API indisponible
            </span>
          ) : (
            <span className="flex items-center text-sm text-theme-tertiary">
              <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
              Non configuré
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-theme-primary">{stats.totalTransactions}</p>
            <p className="text-xs text-theme-tertiary">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.classified}</p>
            <p className="text-xs text-theme-tertiary">Classifiées</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.unclassified}</p>
            <p className="text-xs text-theme-tertiary">À classifier</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.avgConfidence}%</p>
            <p className="text-xs text-theme-tertiary">Confiance moy.</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {isConfigured ? (
        <div className="space-y-3">
          {/* Classify unclassified button */}
          <button
            onClick={handleClassifyAll}
            disabled={classifying || reclassifying || !isAvailable || (stats?.unclassified === 0)}
            className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {classifying ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Classification en cours...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5 mr-2" />
                {stats?.unclassified > 0 
                  ? `Classifier ${stats.unclassified} transaction${stats.unclassified > 1 ? 's' : ''}`
                  : 'Toutes les transactions sont classifiées'
                }
              </>
            )}
          </button>

          {/* Reclassify dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowReclassifyOptions(!showReclassifyOptions)}
              disabled={classifying || reclassifying || !isAvailable || maxTransactions === 0}
              className="w-full flex items-center justify-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {reclassifying ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Reclassification en cours...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2" />
                  Marquer à reclassifier
                  <ChevronDownIcon className={`h-4 w-4 ml-2 transition-transform ${showReclassifyOptions ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {/* Dropdown options */}
            {showReclassifyOptions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 overflow-hidden">
                {reclassifyOptions.map((opt) => (
                  <button
                    key={opt.mode}
                    onClick={() => handleReclassify(opt.mode)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-theme-primary flex justify-between items-center"
                  >
                    <span>{opt.label}</span>
                    <span className="text-xs text-theme-tertiary">
                      {opt.mode === 'all' ? maxTransactions : Math.min(opt.max, maxTransactions)} transactions
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-theme-tertiary text-center">
            💡 Marque les transactions comme "à classifier", puis utilisez le bouton Classifier (100 à la fois)
          </p>
        </div>
      ) : (
        <div className="text-center p-4 bg-theme-secondary rounded-lg">
          <p className="text-sm text-theme-secondary mb-2">
            L'IA n'est pas configurée. Ajoutez votre clé API Mistral dans le fichier .env du backend.
          </p>
          <a 
            href="https://console.mistral.ai/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline text-sm"
          >
            Obtenir une clé gratuite →
          </a>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-800 dark:text-green-300">
            {result.isReset ? (
              <>
                ✅ {result.classified} transaction{result.classified > 1 ? 's' : ''} marquée{result.classified > 1 ? 's' : ''} comme à classifier.
                <br />
                <span className="font-medium">Cliquez maintenant sur "Classifier" pour les traiter (100 à la fois).</span>
              </>
            ) : (
              <>
                ✅ {result.classified} transaction{result.classified > 1 ? 's' : ''} classifiée{result.classified > 1 ? 's' : ''} avec succès !
              </>
            )}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-800 dark:text-red-300">❌ {error}</p>
        </div>
      )}

      {/* Learning info */}
      {stats?.learningEntries > 0 && (
        <p className="text-xs text-theme-tertiary mt-3 text-center">
          🧠 {stats.learningEntries} correction{stats.learningEntries > 1 ? 's' : ''} sauvegardée{stats.learningEntries > 1 ? 's' : ''} pour améliorer l'IA
        </p>
      )}
    </div>
  );
}

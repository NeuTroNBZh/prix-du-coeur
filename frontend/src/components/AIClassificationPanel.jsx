import { useState, useEffect } from 'react';
import { classificationAPI } from '../services/api';
import { SparklesIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function AIClassificationPanel() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const isConfigured = health?.configured;
  const isAvailable = health?.mistralAvailable;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 shadow rounded-lg p-6 border border-indigo-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <SparklesIcon className="h-6 w-6 text-indigo-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Classification IA</h3>
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
            <span className="flex items-center text-sm text-gray-500">
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
            <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.classified}</p>
            <p className="text-xs text-gray-500">Classifiées</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.unclassified}</p>
            <p className="text-xs text-gray-500">À classifier</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{stats.avgConfidence}%</p>
            <p className="text-xs text-gray-500">Confiance moy.</p>
          </div>
        </div>
      )}

      {/* Action button */}
      {isConfigured ? (
        <button
          onClick={handleClassifyAll}
          disabled={classifying || !isAvailable || (stats?.unclassified === 0)}
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
      ) : (
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">
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
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-800">
            ✅ {result.classified} transaction{result.classified > 1 ? 's' : ''} classifiée{result.classified > 1 ? 's' : ''} avec succès !
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-800">❌ {error}</p>
        </div>
      )}

      {/* Learning info */}
      {stats?.learningEntries > 0 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          🧠 {stats.learningEntries} correction{stats.learningEntries > 1 ? 's' : ''} sauvegardée{stats.learningEntries > 1 ? 's' : ''} pour améliorer l'IA
        </p>
      )}
    </div>
  );
}

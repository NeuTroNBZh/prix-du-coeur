import { useState, useEffect } from 'react';
import { classificationAPI } from '../services/api';
import { XMarkIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

const TYPES = [
  { value: 'commune', label: 'Commune', description: 'Dépense partagée entre vous' },
  { value: 'individuelle', label: 'Individuelle', description: 'Dépense personnelle' },
  { value: 'virement_interne', label: 'Virement interne', description: 'Entre vos propres comptes' },
];

const CATEGORIES = [
  'Courses',
  'Restaurant',
  'Transport',
  'Logement',
  'Loisirs',
  'Santé',
  'Shopping',
  'Abonnements',
  'Vacances',
  'Cadeaux',
  'Revenus',
  'Virement interne',
  'Autre'
];

export default function ClassificationCorrectionModal({ 
  transaction, 
  isOpen, 
  onClose, 
  onSuccess 
}) {
  const [type, setType] = useState('commune');
  const [category, setCategory] = useState('Autre');
  const [ratio, setRatio] = useState(50); // Pourcentage (0-100)
  const [shouldLearn, setShouldLearn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Update state when transaction changes
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'commune');
      setCategory(transaction.category || 'Autre');
      // Convert ratio (0-1) to percentage (0-100), default 50%
      setRatio(transaction.ratio !== undefined ? Math.round(transaction.ratio * 100) : 50);
      setError(null);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await classificationAPI.correct(transaction.id, {
        type,
        category,
        ratio: type !== 'individuelle' ? ratio / 100 : null, // Convert back to 0-1
        shouldLearn
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Correction error:', err);
      setError(err.response?.data?.error?.message || 'Erreur lors de la correction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Corriger la classification
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Transaction info */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {transaction.label}
              </p>
              <p className="text-sm text-gray-500">
                {new Date(transaction.date).toLocaleDateString('fr-FR')} • 
                <span className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {' '}{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(transaction.amount)}
                </span>
              </p>
              {transaction.ai_confidence && (
                <p className="text-xs text-gray-400 mt-1">
                  Confiance IA actuelle : {transaction.ai_confidence}%
                </p>
              )}
            </div>

            {/* Type selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type de dépense
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      type === t.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <p className={`text-sm font-medium ${type === t.value ? 'text-indigo-700' : 'text-gray-900'}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Ratio slider - only for shared expenses */}
            {type !== 'individuelle' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taux de prise en charge
                </label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-pink-600 font-medium">Vous: {ratio}%</span>
                    <span className="text-purple-600 font-medium">Partenaire: {100 - ratio}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={ratio}
                    onChange={(e) => setRatio(parseInt(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-pink-200 to-purple-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0%</span>
                    <span>50/50</span>
                    <span>100%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {ratio === 50 ? 'Partage équitable' : 
                     ratio > 50 ? `Vous payez ${ratio}% de cette dépense` : 
                     `Votre partenaire paie ${100 - ratio}% de cette dépense`}
                  </p>
                </div>
              </div>
            )}

            {/* Learn checkbox */}
            <div className="flex items-start">
              <input
                type="checkbox"
                id="shouldLearn"
                checked={shouldLearn}
                onChange={(e) => setShouldLearn(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="shouldLearn" className="ml-3">
                <span className="flex items-center text-sm font-medium text-gray-700">
                  <AcademicCapIcon className="h-4 w-4 mr-1 text-indigo-600" />
                  L'IA doit apprendre de cette correction
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Les transactions similaires seront classifiées de la même façon à l'avenir
                </p>
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

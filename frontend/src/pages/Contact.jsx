import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  EnvelopeIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import api from '../services/api';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    document.title = 'Contact | Prix du Cœur - Nous contacter';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Contactez l\'équipe Prix du Cœur pour toute question, suggestion ou demande d\'assistance.');
    }
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      await api.post('/api/contact', formData);
      setStatus({ 
        type: 'success', 
        message: 'Votre message a été envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.' 
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Une erreur est survenue. Veuillez réessayer ou nous contacter directement par email.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <nav className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-pdc-cyan-600 dark:text-pdc-cyan-400 hover:opacity-80 transition-opacity">
            <span className="text-xl">←</span>
            <img src="/logo.svg" alt="Prix du Cœur" className="w-6 h-6" />
            <span className="font-bold">Prix du Cœur</span>
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Nous contacter
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Une question, une suggestion ou besoin d'aide ? Nous sommes là pour vous accompagner.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Contact Info */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Informations de contact
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <EnvelopeIcon className="h-6 w-6 text-pdc-cyan flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Email</p>
                    <a 
                      href="mailto:contact@prixducoeur.fr" 
                      className="text-pdc-cyan hover:underline"
                    >
                      contact@prixducoeur.fr
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPinIcon className="h-6 w-6 text-pdc-cyan flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Adresse</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      29 rue Duperre<br />
                      29200 Brest, France
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-pdc-cyan flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Délai de réponse</p>
                    <p className="text-gray-600 dark:text-gray-300">
                      Sous 24-48h en jours ouvrés
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-pdc-cyan/10 to-pdc-magenta/10 dark:from-pdc-cyan/20 dark:to-pdc-magenta/20 p-6 rounded-xl border border-pdc-cyan/20">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                💡 Questions fréquentes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Vous trouverez peut-être la réponse à votre question dans nos pages d'information :
              </p>
              <ul className="text-sm space-y-2">
                <li>
                  <Link to="/cgu" className="text-pdc-cyan hover:underline">
                    → Conditions d'utilisation
                  </Link>
                </li>
                <li>
                  <Link to="/confidentialite" className="text-pdc-cyan hover:underline">
                    → Politique de confidentialité
                  </Link>
                </li>
                <li>
                  <Link to="/mentions-legales" className="text-pdc-cyan hover:underline">
                    → Mentions légales
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div className="md:col-span-2">
            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-xl shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Envoyez-nous un message
              </h2>

              {status.message && (
                <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
                  status.type === 'success' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                }`}>
                  {status.type === 'success' ? (
                    <CheckCircleIcon className="h-6 w-6 flex-shrink-0" />
                  ) : (
                    <ExclamationCircleIcon className="h-6 w-6 flex-shrink-0" />
                  )}
                  <p>{status.message}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pdc-cyan focus:border-transparent"
                      placeholder="Votre nom"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pdc-cyan focus:border-transparent"
                      placeholder="votre@email.fr"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sujet *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pdc-cyan focus:border-transparent"
                  >
                    <option value="">Sélectionnez un sujet</option>
                    <option value="question">Question générale</option>
                    <option value="bug">Signaler un bug</option>
                    <option value="feature">Suggestion de fonctionnalité</option>
                    <option value="account">Problème de compte</option>
                    <option value="bank">Question sur la connexion bancaire</option>
                    <option value="data">Demande RGPD (accès/suppression données)</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pdc-cyan focus:border-transparent resize-none"
                    placeholder="Décrivez votre demande en détail..."
                  />
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  * Champs obligatoires. Vos données sont utilisées uniquement pour répondre à votre demande, 
                  conformément à notre <Link to="/confidentialite" className="text-pdc-cyan hover:underline">politique de confidentialité</Link>.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-8 py-3 bg-pdc-cyan text-white font-semibold rounded-lg hover:bg-pdc-cyan-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-5 w-5" />
                      Envoyer le message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} Prix du Cœur. Tous droits réservés.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/mentions-legales" className="hover:text-pdc-cyan">Mentions légales</Link>
            <span>•</span>
            <Link to="/confidentialite" className="hover:text-pdc-cyan">Confidentialité</Link>
            <span>•</span>
            <Link to="/cgu" className="hover:text-pdc-cyan">CGU</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const location = useLocation();
  
  // SEO: Mettre à jour le titre de la page
  useEffect(() => {
    document.title = 'Prix du Cœur | Application Gratuite de Gestion de Budget en Couple';
    
    // Mettre à jour les meta tags
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', "Prix du Cœur - L'application 100% gratuite pour gérer votre budget de couple. Suivez vos dépenses communes, équilibrez vos contributions et économisez ensemble.");
    }
  }, []);
  
  // Initialiser avec le mode système de l'appareil
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      // Vérifier si l'utilisateur a déjà fait un choix sur la landing
      const landingChoice = sessionStorage.getItem('landing-theme');
      if (landingChoice) {
        return landingChoice === 'dark';
      }
      // Sinon utiliser la préférence système
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Appliquer le thème au document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Écouter les changements de préférence système
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Uniquement si l'utilisateur n'a pas fait de choix manuel
      const landingChoice = sessionStorage.getItem('landing-theme');
      if (!landingChoice) {
        setDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Toggle dark mode (choix manuel)
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    // Sauvegarder le choix pour cette session uniquement
    sessionStorage.setItem('landing-theme', newMode ? 'dark' : 'light');
  };

  return (
    <>
      <main className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-sky-50 via-white to-cyan-50'}`} role="main">
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-sm border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'} sticky top-0 z-50`} role="banner">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Navigation principale">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Logo Prix du Cœur" className="w-7 h-7 sm:w-8 sm:h-8" width="32" height="32" />
              <span className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>Prix du Cœur</span>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden sm:flex items-center gap-3">
              {/* Dark mode toggle */}
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} transition-colors`}
                aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              
              {user ? (
                <Link
                  to="/dashboard"
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg border-2 border-cyan-600 transition-all"
                >
                  Mon tableau de bord
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={`${darkMode ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-700 hover:text-cyan-600'} font-medium transition-colors`}
                  >
                    Connexion
                  </Link>
                  <Link
                    to="/register"
                    className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
                  >
                    Créer un compte
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex sm:hidden items-center gap-2">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'} transition-colors`}
                aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
              >
                {darkMode ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'} transition-colors`}
                aria-label="Menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className={`sm:hidden py-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex flex-col gap-3">
                {user ? (
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="bg-cyan-500 text-white px-4 py-3 rounded-lg font-semibold text-center shadow-md"
                  >
                    Mon tableau de bord
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'} px-4 py-3 rounded-lg font-medium text-center`}
                    >
                      Connexion
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="bg-cyan-500 text-white px-4 py-3 rounded-lg font-medium text-center shadow-md"
                    >
                      Créer un compte
                    </Link>
                  </>
                )}
                <a
                  href="#fonctionnalites"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} px-4 py-2 text-center`}
                >
                  Fonctionnalités
                </a>
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="py-10 sm:py-16 lg:py-24 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold ${darkMode ? 'text-white' : 'text-gray-900'} mb-4 sm:mb-6 leading-tight`}>
            Gérez vos finances de couple
            <span className={`block ${darkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>en toute simplicité</span>
          </h1>
          <p className={`text-base sm:text-lg md:text-xl ${darkMode ? 'text-gray-300' : 'text-gray-600'} max-w-3xl mx-auto mb-6 sm:mb-10 px-2`}>
            Prix du Cœur est une application web qui vous aide à suivre vos dépenses,
            équilibrer vos contributions et maintenir une harmonie financière dans votre couple.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link
              to="/register"
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl border-2 border-cyan-600 transition-all text-center"
            >
              Commencer gratuitement
            </Link>
            <a
              href="#fonctionnalites"
              className={`${darkMode ? 'bg-gray-800 text-cyan-400 border-cyan-500 hover:bg-gray-700' : 'bg-white text-cyan-600 border-cyan-500 hover:bg-cyan-50'} px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg border-2 shadow-md transition-all text-center`}
            >
              En savoir plus
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className={`py-12 sm:py-16 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center ${darkMode ? 'text-white' : 'text-gray-900'} mb-8 sm:mb-12`}>
            Fonctionnalités principales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gradient-to-br from-cyan-50 to-sky-50 border border-cyan-100'} p-5 sm:p-8 rounded-2xl shadow-lg`}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-cyan-500 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                <img src="/icons/bank.svg" alt="" className="w-6 h-6 sm:w-7 sm:h-7 text-white" style={{filter: 'brightness(0) invert(1)'}} />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2 sm:mb-3`}>Import bancaire</h3>
              <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Importez facilement vos relevés bancaires au format CSV ou PDF pour un suivi automatique de vos transactions.
              </p>
            </div>
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100'} p-5 sm:p-8 rounded-2xl shadow-lg`}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                <img src="/icons/balance.svg" alt="" className="w-6 h-6 sm:w-7 sm:h-7" style={{filter: 'brightness(0) invert(1)'}} />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2 sm:mb-3`}>Harmonisation</h3>
              <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Équilibrez automatiquement les dépenses communes entre partenaires selon vos préférences.
              </p>
            </div>
            <div className={`${darkMode ? 'bg-gray-700' : 'bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100'} p-5 sm:p-8 rounded-2xl shadow-lg sm:col-span-2 lg:col-span-1`}>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-rose-500 rounded-xl flex items-center justify-center mb-4 sm:mb-6">
                <img src="/icons/lock.svg" alt="" className="w-6 h-6 sm:w-7 sm:h-7" style={{filter: 'brightness(0) invert(1)'}} />
              </div>
              <h3 className={`text-lg sm:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-2 sm:mb-3`}>Sécurité avancée</h3>
              <p className={`text-sm sm:text-base ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Vos données sont chiffrées de bout en bout. Authentification à deux facteurs disponible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`py-12 sm:py-16 ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-sky-50 to-cyan-50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center ${darkMode ? 'text-white' : 'text-gray-900'} mb-8 sm:mb-12`}>
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {[
              { step: '1', icon: '/icons/user.svg', title: 'Créez votre compte', desc: 'Inscription gratuite en quelques secondes' },
              { step: '2', icon: '/icons/credit-card.svg', title: 'Ajoutez vos comptes', desc: 'Configurez vos comptes bancaires' },
              { step: '3', icon: '/icons/download.svg', title: 'Importez vos relevés', desc: 'Téléchargez vos fichiers CSV ou PDF' },
              { step: '4', icon: '/icons/star.svg', title: 'Analysez & équilibrez', desc: 'Visualisez et harmonisez vos dépenses' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="relative inline-block">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 ${darkMode ? 'bg-gray-700' : 'bg-white'} rounded-full flex items-center justify-center shadow-lg`}>
                    <img src={item.icon} alt="" className={`w-6 h-6 sm:w-8 sm:h-8 ${darkMode ? 'invert' : ''}`} style={{filter: darkMode ? 'invert(1)' : 'invert(0.3)'}} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-7 sm:h-7 bg-cyan-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md border-2 border-white dark:border-gray-900">
                    {item.step}
                  </div>
                </div>
                <h3 className={`text-sm sm:text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'} mb-1 sm:mb-2 mt-3 sm:mt-4`}>{item.title}</h3>
                <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'} text-xs sm:text-sm`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className={`py-12 sm:py-16 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center ${darkMode ? 'text-white' : 'text-gray-900'} mb-8 sm:mb-12`}>
            Pourquoi nous faire confiance ?
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {[
              { icon: '/icons/shield.svg', title: 'Chiffrement', desc: 'Données chiffrées AES-256' },
              { icon: '/icons/heart.svg', title: 'Made in France', desc: 'Hébergé en France' },
              { icon: '/icons/smartphone.svg', title: 'PWA', desc: 'Installable sur mobile' },
              { icon: '/icons/moon.svg', title: 'Mode sombre', desc: 'Confort visuel optimal' },
            ].map((item, idx) => (
              <div key={idx} className={`flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50 border border-gray-100'} rounded-xl text-center sm:text-left`}>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${darkMode ? 'bg-gray-600' : 'bg-cyan-100'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <img src={item.icon} alt="" className="w-5 h-5 sm:w-6 sm:h-6" style={{filter: darkMode ? 'invert(1)' : 'invert(0.4) sepia(1) saturate(5) hue-rotate(160deg)'}} />
                </div>
                <div>
                  <h4 className={`font-bold text-sm sm:text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>{item.title}</h4>
                  <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-cyan-500 to-emerald-500">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 sm:mb-6">
            Prêt à simplifier vos finances de couple ?
          </h2>
          <p className="text-white/90 text-sm sm:text-lg mb-6 sm:mb-8 px-2">
            Rejoignez Prix du Cœur et commencez à gérer vos dépenses en toute sérénité.
          </p>
          <Link
            to="/register"
            className="inline-block bg-white text-cyan-600 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg shadow-lg hover:shadow-xl hover:bg-gray-50 border-2 border-white hover:scale-105 transition-all"
          >
            Créer mon compte gratuitement
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className={`${darkMode ? 'bg-gray-900 border-t border-gray-800' : 'bg-gray-800'} text-white py-8 sm:py-12 mt-auto`} style={{paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {/* Brand */}
            <div className="col-span-2">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-lg p-1.5 flex items-center justify-center">
                  <img src="/logo.svg" alt="Prix du Cœur" className="w-full h-full object-contain" />
                </div>
                <span className="text-lg sm:text-xl font-bold">Prix du Cœur</span>
              </div>
              <p className="text-gray-400 text-sm sm:text-base mb-3 sm:mb-4">
                Application de gestion des finances de couple. Suivez vos dépenses, 
                équilibrez vos contributions et maintenez l'harmonie financière.
              </p>
              <p className="text-gray-500 text-xs sm:text-sm">
                © {new Date().getFullYear()} Prix du Cœur. Tous droits réservés.
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h4 className="font-bold mb-3 sm:mb-4 text-cyan-400 text-sm sm:text-base">Navigation</h4>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link to="/login" className="text-gray-400 hover:text-white transition-colors text-sm">Connexion</Link></li>
                <li><Link to="/register" className="text-gray-400 hover:text-white transition-colors text-sm">Inscription</Link></li>
                <li><a href="#fonctionnalites" className="text-gray-400 hover:text-white transition-colors text-sm">Fonctionnalités</a></li>
              </ul>
            </div>

            {/* Legal */}
            <nav aria-label="Informations légales">
              <h4 className="font-bold mb-3 sm:mb-4 text-cyan-400 text-sm sm:text-base">Informations légales</h4>
              <ul className="space-y-1 sm:space-y-2">
                <li><Link to="/mentions-legales" className="text-gray-400 hover:text-white transition-colors text-sm">Mentions légales</Link></li>
                <li><Link to="/confidentialite" className="text-gray-400 hover:text-white transition-colors text-sm">Confidentialité</Link></li>
                <li><Link to="/cgu" className="text-gray-400 hover:text-white transition-colors text-sm">CGU</Link></li>
                <li><Link to="/contact" className="text-gray-400 hover:text-white transition-colors text-sm">Contact</Link></li>
              </ul>
            </nav>
          </div>

          <div className="border-t border-gray-700 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center text-gray-500 text-xs sm:text-sm flex items-center justify-center gap-2 flex-wrap">
            <span>Application développée avec</span>
            <img src="/icons/heart.svg" alt="amour" className="w-3 h-3 sm:w-4 sm:h-4" width="16" height="16" style={{filter: 'invert(0.5) sepia(1) saturate(5) hue-rotate(310deg)'}} />
            <span>en France</span>
          </div>
        </div>
      </footer>
    </main>
    </>
  );
}

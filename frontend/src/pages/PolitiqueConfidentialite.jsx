import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PolitiqueConfidentialite() {
  // SEO: Mettre à jour le titre et scroll to top
  useEffect(() => {
    document.title = 'Politique de Confidentialité | Prix du Cœur - RGPD';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Politique de confidentialité de Prix du Cœur - Protection de vos données personnelles selon le RGPD. Collecte, utilisation et sécurité de vos informations.');
    }
    window.scrollTo(0, 0);
  }, []);

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
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Politique de Confidentialité
        </h1>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                La présente politique de confidentialité a pour but d'informer les utilisateurs du site Prix du Cœur 
                sur la manière dont leurs données personnelles sont collectées, utilisées et protégées, conformément 
                au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
              </p>
              <p>
                En utilisant notre service, vous acceptez les pratiques décrites dans cette politique.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Responsable du traitement</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-2">
              <p><strong>Identité :</strong> Louis Cerclé</p>
              <p><strong>Adresse :</strong> 29 rue Duperre, 29200 Brest, France</p>
              <p><strong>Email :</strong> contact@prixducoeur.fr</p>
              <p><strong>Délégué à la Protection des Données (DPO) :</strong> louis.cercle35@gmail.com</p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Données collectées</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>Nous collectons les données suivantes :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Données d'identification :</strong> nom, prénom, adresse email</li>
                <li><strong>Données de connexion :</strong> mot de passe (hashé), adresse IP, logs de connexion</li>
                <li><strong>Données financières :</strong> transactions bancaires importées (chiffrées), noms de comptes</li>
                <li><strong>Données de profil :</strong> photo de profil (optionnelle), préférences utilisateur</li>
                <li><strong>Données techniques :</strong> type de navigateur, système d'exploitation</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Finalités du traitement</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>Vos données sont collectées pour les finalités suivantes :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Création et gestion de votre compte utilisateur</li>
                <li>Fourniture du service de gestion des finances de couple</li>
                <li>Authentification et sécurisation de l'accès à votre compte</li>
                <li>Communication relative au service (emails transactionnels)</li>
                <li>Amélioration de nos services et de l'expérience utilisateur</li>
                <li>Respect de nos obligations légales</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Base légale du traitement</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>Le traitement de vos données repose sur :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Exécution du contrat :</strong> pour fournir le service que vous avez demandé</li>
                <li><strong>Consentement :</strong> pour certaines fonctionnalités optionnelles</li>
                <li><strong>Intérêt légitime :</strong> pour améliorer nos services et assurer la sécurité</li>
                <li><strong>Obligation légale :</strong> pour respecter nos obligations réglementaires</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Sécurité des données</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>Nous prenons la sécurité de vos données très au sérieux :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Chiffrement :</strong> toutes les données sensibles (transactions, labels) sont chiffrées avec AES-256</li>
                <li><strong>Mots de passe :</strong> hashés avec bcrypt (jamais stockés en clair)</li>
                <li><strong>HTTPS :</strong> toutes les communications sont chiffrées via TLS/SSL</li>
                <li><strong>2FA :</strong> authentification à deux facteurs disponible</li>
                <li><strong>Hébergement :</strong> serveurs sécurisés en France (OVH)</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Durée de conservation</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Données de compte :</strong> conservées pendant la durée de votre inscription, puis 3 ans après la suppression du compte</li>
                <li><strong>Données financières :</strong> conservées pendant la durée de votre inscription</li>
                <li><strong>Logs de connexion :</strong> conservés 12 mois</li>
                <li><strong>Cookies :</strong> voir notre politique de cookies</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">8. Partage des données</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                <strong>Nous ne vendons jamais vos données personnelles.</strong>
              </p>
              <p>Vos données peuvent être partagées uniquement avec :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Votre partenaire :</strong> les données liées aux comptes partagés sont accessibles par les deux partenaires</li>
                <li><strong>Hébergeur :</strong> OVH (sous-traitant technique conforme RGPD)</li>
                <li><strong>Autorités :</strong> si requis par la loi</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">9. Vos droits</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles</li>
                <li><strong>Droit de rectification :</strong> corriger vos données inexactes</li>
                <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données</li>
                <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
                <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
                <li><strong>Droit de retirer votre consentement :</strong> à tout moment</li>
              </ul>
              <p>
                Pour exercer ces droits, contactez-nous à : 
                <a href="mailto:contact@prixducoeur.fr" className="text-pdc-cyan-600 dark:text-pdc-cyan-400 hover:underline ml-1">
                  contact@prixducoeur.fr
                </a>
              </p>
              <p>
                En cas de litige, vous pouvez également introduire une réclamation auprès de la CNIL 
                (Commission Nationale de l'Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-pdc-cyan-600 dark:text-pdc-cyan-400 hover:underline">www.cnil.fr</a>
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">10. Cookies</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>Notre site utilise uniquement des cookies essentiels au fonctionnement du service :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Cookies d'authentification :</strong> pour maintenir votre session</li>
                <li><strong>Cookies de préférences :</strong> pour sauvegarder vos préférences (thème, langue)</li>
              </ul>
              <p>
                Nous n'utilisons pas de cookies de tracking, d'analytics tiers, ni de cookies publicitaires.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">11. Modifications</h2>
            <div className="text-gray-600 dark:text-gray-300">
              <p>
                Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. 
                Toute modification sera publiée sur cette page avec une date de mise à jour. 
                Nous vous encourageons à consulter régulièrement cette page.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">12. Contact</h2>
            <div className="text-gray-600 dark:text-gray-300">
              <p>
                Pour toute question concernant cette politique de confidentialité ou vos données personnelles :
              </p>
              <p className="mt-2">
                📧 Email : <a href="mailto:contact@prixducoeur.fr" className="text-pdc-cyan-600 dark:text-pdc-cyan-400 hover:underline">contact@prixducoeur.fr</a>
              </p>
            </div>
          </section>

          <p className="text-gray-500 text-sm text-center pt-4">
            Dernière mise à jour : Janvier 2026
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-6 mb-4">
            <Link to="/mentions-legales" className="text-gray-400 hover:text-white transition-colors">Mentions légales</Link>
            <Link to="/confidentialite" className="text-pdc-cyan-400 hover:text-white transition-colors">Confidentialité</Link>
            <Link to="/cgu" className="text-gray-400 hover:text-white transition-colors">CGU</Link>
          </div>
          <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Prix du Cœur. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

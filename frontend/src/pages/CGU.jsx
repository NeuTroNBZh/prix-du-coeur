import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function CGU() {
  // SEO: Mettre à jour le titre et scroll to top
  useEffect(() => {
    document.title = 'Conditions Générales d\'Utilisation (CGU) | Prix du Cœur';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'CGU de Prix du Cœur - Conditions d\'utilisation de l\'application gratuite de gestion de budget en couple. Droits, obligations et règles d\'utilisation.');
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
          Conditions Générales d'Utilisation
        </h1>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Objet</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Les présentes Conditions Générales d'Utilisation (CGU) ont pour objet de définir les modalités 
                et conditions d'utilisation des services proposés par Prix du Cœur, ainsi que de définir les 
                droits et obligations des parties dans ce cadre.
              </p>
              <p>
                En créant un compte ou en utilisant le service, vous acceptez sans réserve les présentes CGU.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Description du service</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Prix du Cœur est une application web de gestion des finances de couple permettant :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>L'import et le suivi des transactions bancaires</li>
                <li>La catégorisation des dépenses</li>
                <li>L'harmonisation des contributions entre partenaires</li>
                <li>La visualisation des statistiques financières</li>
                <li>La gestion multi-comptes (personnels et partagés)</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Accès au service</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Le service est accessible gratuitement à tout utilisateur disposant d'un accès Internet.
              </p>
              <p>
                L'inscription est obligatoire pour utiliser le service. L'utilisateur doit fournir des 
                informations exactes et à jour lors de son inscription.
              </p>
              <p>
                L'utilisateur est responsable de la confidentialité de ses identifiants de connexion et 
                de toutes les activités effectuées depuis son compte.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Obligations de l'utilisateur</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>L'utilisateur s'engage à :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fournir des informations exactes lors de l'inscription</li>
                <li>Maintenir la confidentialité de ses identifiants</li>
                <li>Ne pas utiliser le service à des fins illégales ou non autorisées</li>
                <li>Ne pas tenter de compromettre la sécurité du service</li>
                <li>Ne pas usurper l'identité d'un tiers</li>
                <li>Respecter les droits de propriété intellectuelle</li>
                <li>Ne pas transmettre de virus ou code malveillant</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Comptes partagés et partenaires</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Le service permet de partager certaines données financières avec un partenaire. En utilisant 
                cette fonctionnalité :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Vous garantissez avoir le consentement de votre partenaire</li>
                <li>Vous acceptez que votre partenaire ait accès aux données des comptes partagés</li>
                <li>Vous êtes responsable des données que vous choisissez de partager</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Données bancaires</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Le service permet d'importer vos transactions bancaires via des fichiers CSV téléchargés depuis votre banque.
              </p>
              
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">Import manuel (CSV)</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Vous pouvez télécharger des relevés au format CSV depuis votre banque</li>
                <li>Prix du Cœur n'a jamais accès à vos identifiants bancaires</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4">Protection des données</h3>
              <p>Vos données importées sont :</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Chiffrées de bout en bout (AES-256)</li>
                <li>Stockées de manière sécurisée</li>
                <li>Accessibles uniquement par vous et votre partenaire (pour les comptes partagés)</li>
                <li>Jamais vendues ou partagées à des tiers</li>
              </ul>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Propriété intellectuelle</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                L'ensemble des éléments du service (code, design, textes, logos, etc.) sont protégés par 
                le droit de la propriété intellectuelle et appartiennent à l'éditeur.
              </p>
              <p>
                L'utilisateur conserve tous les droits sur les données qu'il importe dans le service.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">8. Limitation de responsabilité</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Le service est fourni "tel quel" sans garantie d'aucune sorte. L'éditeur ne peut être tenu 
                responsable :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Des interruptions ou dysfonctionnements du service</li>
                <li>Des pertes de données (malgré les mesures de sauvegarde)</li>
                <li>De l'exactitude des calculs d'harmonisation (à titre indicatif uniquement)</li>
                <li>Des décisions financières prises sur la base des informations du service</li>
                <li>Des erreurs dans les données importées par l'utilisateur</li>
              </ul>
              <p className="font-semibold">
                Prix du Cœur n'est pas un service de conseil financier. Les informations fournies sont 
                à titre indicatif uniquement.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">9. Suspension et résiliation</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                L'éditeur se réserve le droit de suspendre ou supprimer un compte en cas de :
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violation des présentes CGU</li>
                <li>Utilisation frauduleuse ou abusive du service</li>
                <li>Inactivité prolongée (après notification)</li>
              </ul>
              <p>
                L'utilisateur peut à tout moment demander la suppression de son compte et de ses données 
                depuis les paramètres de son profil ou en contactant le support.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">10. Disponibilité du service</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                L'éditeur s'efforce d'assurer une disponibilité maximale du service mais ne garantit pas 
                une disponibilité continue. Des interruptions pour maintenance peuvent survenir.
              </p>
              <p>
                L'éditeur se réserve le droit de modifier ou d'arrêter le service à tout moment, avec 
                un préavis raisonnable pour permettre aux utilisateurs de récupérer leurs données.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">11. Modification des CGU</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications 
                seront notifiées aux utilisateurs par email ou via le service.
              </p>
              <p>
                La continuation de l'utilisation du service après modification des CGU vaut acceptation 
                des nouvelles conditions.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">12. Droit applicable et litiges</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Les présentes CGU sont régies par le droit français.
              </p>
              <p>
                En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute 
                action judiciaire. À défaut d'accord, les tribunaux français seront compétents.
              </p>
              <p>
                Conformément à l'article L.612-1 du Code de la consommation, le consommateur peut recourir 
                gratuitement au service de médiation de la consommation.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">13. Contact</h2>
            <div className="text-gray-600 dark:text-gray-300">
              <p>
                Pour toute question concernant ces CGU :
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
            <Link to="/confidentialite" className="text-gray-400 hover:text-white transition-colors">Confidentialité</Link>
            <Link to="/cgu" className="text-pdc-cyan-400 hover:text-white transition-colors">CGU</Link>
          </div>
          <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Prix du Cœur. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

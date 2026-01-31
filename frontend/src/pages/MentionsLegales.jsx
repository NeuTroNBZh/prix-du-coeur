import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function MentionsLegales() {
  // SEO: Mettre à jour le titre et scroll to top
  useEffect(() => {
    document.title = 'Mentions Légales | Prix du Cœur - Gestion de Budget en Couple';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Mentions légales de Prix du Cœur - Application gratuite de gestion de budget en couple. Informations sur l\'éditeur, l\'hébergeur et les droits de propriété intellectuelle.');
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
          Mentions Légales
        </h1>

        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">1. Éditeur du site</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-2">
              <p><strong>Nom du site :</strong> Prix du Cœur</p>
              <p><strong>URL :</strong> https://prixducoeur.fr</p>
              <p><strong>Éditeur :</strong> Louis Cerclé</p>
              <p><strong>Adresse :</strong> 29 rue Duperre, 29200 Brest, France</p>
              <p><strong>Email :</strong> contact@prixducoeur.fr</p>
              <p><strong>Statut juridique :</strong> Particulier</p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">2. Directeur de la publication</h2>
            <div className="text-gray-600 dark:text-gray-300">
              <p><strong>Nom :</strong> Louis Cerclé</p>
              <p><strong>Email :</strong> contact@prixducoeur.fr</p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">3. Hébergement</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-2">
              <p><strong>Hébergeur :</strong> OVH SAS</p>
              <p><strong>Adresse :</strong> 2 rue Kellermann - 59100 Roubaix - France</p>
              <p><strong>Téléphone :</strong> 1007 (depuis la France)</p>
              <p><strong>Site web :</strong> https://www.ovhcloud.com</p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">4. Propriété intellectuelle</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, sons, logiciels, etc.) 
                est la propriété exclusive de l'éditeur ou de ses partenaires et est protégé par les lois françaises 
                et internationales relatives à la propriété intellectuelle.
              </p>
              <p>
                Toute reproduction, représentation, modification, publication, adaptation totale ou partielle des 
                éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation 
                écrite préalable de l'éditeur.
              </p>
              <p>
                Toute exploitation non autorisée du site ou de son contenu sera considérée comme constitutive 
                d'une contrefaçon et poursuivie conformément aux dispositions des articles L.335-2 et suivants 
                du Code de Propriété Intellectuelle.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">5. Limitation de responsabilité</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                L'éditeur s'efforce de fournir des informations aussi précises que possible. Toutefois, il ne 
                pourra être tenu responsable des omissions, des inexactitudes et des carences dans la mise à jour, 
                qu'elles soient de son fait ou du fait des tiers partenaires qui lui fournissent ces informations.
              </p>
              <p>
                L'éditeur ne saurait être tenu pour responsable des dommages directs ou indirects qui pourraient 
                résulter de l'accès ou de l'utilisation du site, y compris l'inaccessibilité, les pertes de données, 
                détériorations, destructions ou virus qui pourraient affecter l'équipement informatique de l'utilisateur.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">6. Liens hypertextes</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Le site peut contenir des liens hypertextes vers d'autres sites internet ou ressources disponibles 
                sur Internet. L'éditeur ne dispose d'aucun moyen de contrôler les sites en connexion avec son site 
                et ne répond pas de la disponibilité de tels sites et sources externes.
              </p>
              <p>
                L'éditeur ne peut être tenu pour responsable de tout dommage, de quelque nature que ce soit, 
                résultant du contenu de ces sites ou sources externes.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">7. Protection des données personnelles</h2>
            <div className="text-gray-600 dark:text-gray-300 space-y-4">
              <p>
                Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique 
                et Libertés, vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition 
                aux données personnelles vous concernant.
              </p>
              <p>
                Pour plus d'informations sur le traitement de vos données personnelles, veuillez consulter notre 
                <Link to="/confidentialite" className="text-pdc-cyan-600 dark:text-pdc-cyan-400 hover:underline ml-1">
                  Politique de Confidentialité
                </Link>.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">8. Droit applicable</h2>
            <div className="text-gray-600 dark:text-gray-300">
              <p>
                Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux 
                français seront seuls compétents.
              </p>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">9. Contact</h2>
            <div className="text-gray-600 dark:text-gray-300">
              <p>
                Pour toute question concernant ces mentions légales, vous pouvez nous contacter à l'adresse : 
                <a href="mailto:contact@prixducoeur.fr" className="text-pdc-cyan-600 dark:text-pdc-cyan-400 hover:underline ml-1">
                  contact@prixducoeur.fr
                </a>
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
            <Link to="/mentions-legales" className="text-pdc-cyan-400 hover:text-white transition-colors">Mentions légales</Link>
            <Link to="/confidentialite" className="text-gray-400 hover:text-white transition-colors">Confidentialité</Link>
            <Link to="/cgu" className="text-gray-400 hover:text-white transition-colors">CGU</Link>
          </div>
          <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Prix du Cœur. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

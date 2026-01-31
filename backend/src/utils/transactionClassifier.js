/**
 * Transaction Classifier
 * Automatically categorizes transactions based on their labels/descriptions
 */

// Keywords for each category
const CATEGORY_KEYWORDS = {
  'Courses': [
    'carrefour', 'leclerc', 'auchan', 'lidl', 'intermarche', 'super u', 'monoprix',
    'franprix', 'casino', 'picard', 'aldi', 'biocoop', 'naturalia', 'grand frais',
    'primeur', 'boucherie', 'boulangerie', 'epicerie', 'supermarche', 'hypermarche',
    'alimentaire', 'primaprix', 'netto', 'leader price', 'match'
  ],
  'Restaurant': [
    'restaurant', 'resto', 'brasserie', 'bistro', 'mcdo', 'mcdonald', 'burger king',
    'kfc', 'subway', 'domino', 'pizza', 'sushi', 'wok', 'kebab', 'tacos',
    'deliveroo', 'uber eats', 'just eat', 'cafe', 'starbucks', 'paul', 'brioche doree',
    'flunch', 'hippopotamus', 'buffalo grill', 'courtepaille', 'quick'
  ],
  'Transport': [
    'sncf', 'ratp', 'uber', 'bolt', 'taxi', 'vtc', 'blablacar', 'essence', 'carburant',
    'total', 'bp', 'shell', 'esso', 'station service', 'parking', 'peage', 'autoroute',
    'vinci', 'sanef', 'aprr', 'velib', 'lime', 'tier', 'dott', 'metro', 'bus', 'tram',
    'train', 'avion', 'air france', 'easyjet', 'ryanair', 'eurostar'
  ],
  'Logement': [
    'loyer', 'edf', 'engie', 'gaz', 'electricite', 'eau', 'veolia', 'suez',
    'assurance habitation', 'syndic', 'charges', 'copropriete', 'immobilier',
    'agence', 'foncier', 'taxe', 'impot', 'credit immobilier', 'pret', 'emprunt',
    'bailleur', 'proprietaire'
  ],
  'Santé': [
    'pharmacie', 'medecin', 'docteur', 'hopital', 'clinique', 'dentiste', 'ophtalmo',
    'dermato', 'kine', 'osteo', 'psy', 'mutuelle', 'cpam', 'ameli', 'sante',
    'laboratoire', 'analyse', 'radio', 'irm', 'scanner', 'ordonnance'
  ],
  'Shopping': [
    'amazon', 'cdiscount', 'fnac', 'darty', 'boulanger', 'ikea', 'leroy merlin',
    'castorama', 'decathlon', 'zara', 'h&m', 'kiabi', 'primark', 'uniqlo',
    'mango', 'celio', 'jules', 'sephora', 'nocibe', 'yves rocher', 'galeries',
    'printemps', 'veepee', 'showroomprive', 'aliexpress', 'wish', 'shein',
    'asos', 'zalando', 'la redoute', 'action', 'gifi', 'centrakor'
  ],
  'Loisirs': [
    'cinema', 'ugc', 'pathe', 'gaumont', 'mk2', 'theatre', 'concert', 'spectacle',
    'musee', 'expo', 'sport', 'fitness', 'salle', 'piscine', 'bowling', 'escape',
    'laser', 'parc', 'disney', 'asterix', 'futuroscope', 'zoo', 'aquarium',
    'jeu', 'playstation', 'xbox', 'nintendo', 'steam', 'gaming'
  ],
  'Abonnements': [
    'netflix', 'spotify', 'deezer', 'apple music', 'disney+', 'prime video',
    'canal+', 'ocs', 'youtube', 'twitch', 'amazon prime', 'audible',
    'orange', 'sfr', 'bouygues', 'free', 'sosh', 'red', 'telephone', 'mobile',
    'internet', 'box', 'fibre', 'forfait', 'abonnement', 'subscription',
    'adobe', 'microsoft', 'office', 'cloud', 'icloud', 'dropbox'
  ],
  'Vacances': [
    'hotel', 'airbnb', 'booking', 'trivago', 'expedia', 'voyage', 'vacances',
    'sejour', 'camping', 'location', 'club med', 'pierre et vacances', 'center parcs',
    'tui', 'fram', 'look voyages', 'promovacances', 'lastminute'
  ],
  'Cadeaux': [
    'cadeau', 'gift', 'anniversaire', 'noel', 'fete', 'bijou', 'fleur', 'parfum',
    'jouet', 'king jouet', 'toys r us', 'cultura', 'nature et decouvertes'
  ],
  'Virement interne': [
    'virement', 'transfert', 'vers compte', 'de compte', 'epargne', 'livret',
    'pel', 'cel', 'ldd', 'lea', 'assurance vie', 'placement'
  ]
};

/**
 * Classify a transaction based on its label
 * @param {string} label - The transaction description/label
 * @returns {{ category: string, confidence: number }}
 */
const classifyTransaction = (label) => {
  if (!label) {
    return { category: 'Autre', confidence: 0 };
  }
  
  const normalizedLabel = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedLabel.includes(normalizedKeyword)) {
        return { 
          category, 
          confidence: keyword.length > 5 ? 0.9 : 0.7 // Higher confidence for longer keywords
        };
      }
    }
  }
  
  return { category: 'Autre', confidence: 0.3 };
};

/**
 * Batch classify multiple transactions
 * @param {string[]} labels - Array of transaction descriptions
 * @returns {Array<{ category: string, confidence: number }>}
 */
const classifyTransactions = (labels) => {
  return labels.map(label => classifyTransaction(label));
};

module.exports = {
  classifyTransaction,
  classifyTransactions,
  CATEGORY_KEYWORDS
};

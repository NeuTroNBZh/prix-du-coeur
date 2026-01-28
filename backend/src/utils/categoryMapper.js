/**
 * Basic category mapping based on transaction labels
 * This will be enhanced with AI classification later
 */

const CATEGORY_PATTERNS = {
  'PAIEMENT PAR CARTE': 'Dépense',
  'PRELEVEMENT': 'Abonnements',
  'PRLV': 'Abonnements',
  'VIREMENT EMIS': 'Virement interne',
  'VIREMENT EN VOTRE FAVEUR': 'Revenus',
  'VIR INST vers': 'Virement interne',
  'VIR INST de': 'Revenus',
  'VIR de': 'Revenus',
  'VIR vers LIVRET': 'Virement interne',
  'VIR de LIVRET': 'Virement interne',
  'INTERETS CREDITEURS': 'Revenus',
  'CARTE': 'Dépense',
  'CB:': 'Dépense',
  'RETRAIT': 'Retrait',
  'CHEQUE': 'Chèque',
  'CAF': 'Revenus',
  'DRFIP': 'Revenus',
  'SALAIRE': 'Revenus',
  'TRESORERIE': 'Revenus',
  'WERO': 'Virement interne',
  'F COTISATION': 'Abonnements',
  'FRAIS BANCAIRES': 'Abonnements'
};

// Specific merchant patterns
const MERCHANT_CATEGORIES = {
  'APPLE.COM': 'Abonnements',
  'APPLE.COM/BILL': 'Abonnements',
  'NETFLIX': 'Abonnements',
  'SPOTIFY': 'Abonnements',
  'FREE': 'Abonnements',
  'ORANGE': 'Abonnements',
  'SFR': 'Abonnements',
  'BOUYGUES': 'Abonnements',
  'GOOGLE ONE': 'Abonnements',
  'AMAZON PRIME': 'Abonnements',
  'DISNEY': 'Abonnements',
  'BLISSIM': 'Abonnements',
  'HPI INSTANT INK': 'Abonnements',
  'PHARMACIE': 'Santé',
  'PHCIE': 'Santé',
  'DOCTEUR': 'Santé',
  'DR ': 'Santé',
  'SNCF': 'Transport',
  'RATP': 'Transport',
  'ESSENCE': 'Transport',
  'TOTAL': 'Transport',
  'SHELL': 'Transport',
  'CARREFOUR': 'Courses',
  'LECLERC': 'Courses',
  'E LECLERC': 'Courses',
  'AUCHAN': 'Courses',
  'LIDL': 'Courses',
  'INTERMARCHE': 'Courses',
  'U EXPRESS': 'Courses',
  'SUPER U': 'Courses',
  'HYPER U': 'Courses',
  'MONOPRIX': 'Courses',
  'CASINO': 'Courses',
  'RESTAURANT': 'Restaurant',
  'MCDO': 'Restaurant',
  'KFC': 'Restaurant',
  'BURGER': 'Restaurant',
  'CREP': 'Restaurant',
  'BEURRE SALE': 'Restaurant',
  'LA FOURNEE': 'Restaurant',
  'IZLY': 'Restaurant',
  'UBER EATS': 'Restaurant',
  'DELIVEROO': 'Restaurant',
  'MANGO': 'Shopping',
  'ZARA': 'Shopping',
  'H&M': 'Shopping',
  'H  M': 'Shopping',
  'PRIMARK': 'Shopping',
  'ETAM': 'Shopping',
  'VEEPEE': 'Shopping',
  'LA REDOUTE': 'Shopping',
  'DECATHLON': 'Loisirs',
  'IKEA': 'Logement',
  'CASTORAMA': 'Logement',
  'LEROY MERLIN': 'Logement',
  'EDF': 'Logement',
  'ENGIE': 'Logement',
  'ZOOPLUS': 'Autre'
};

/**
 * Categorize a transaction based on its label
 * @param {string} label - Transaction label
 * @returns {string} - Category name or 'Non catégorisé'
 */
function categorizeBasic(label) {
  if (!label) return 'Non catégorisé';

  const upperLabel = label.toUpperCase();

  // Check transaction type patterns first
  for (const [pattern, category] of Object.entries(CATEGORY_PATTERNS)) {
    if (upperLabel.includes(pattern)) {
      return category;
    }
  }

  // Check merchant-specific patterns
  for (const [merchant, category] of Object.entries(MERCHANT_CATEGORIES)) {
    if (upperLabel.includes(merchant)) {
      return category;
    }
  }

  // Default
  return 'Non catégorisé';
}

module.exports = {
  categorizeBasic,
  CATEGORY_PATTERNS,
  MERCHANT_CATEGORIES
};

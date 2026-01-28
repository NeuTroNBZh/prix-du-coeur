const { PDFParse } = require('pdf-parse');

/**
 * Parser for Crédit Mutuel de Bretagne (CMB) PDF statements
 * Format détecté depuis l'exemple fourni
 */
class CMBPdfParser {
  static getBankName() {
    return 'credit_mutuel_bretagne';
  }

  static getDisplayName() {
    return 'Crédit Mutuel de Bretagne';
  }

  /**
   * Check if this PDF is from CMB
   */
  static canParse(pdfText) {
    const cmbIndicators = [
      'crédit mutuel',
      'credit mutuel',
      'cmb.fr',
      'arkea',
      'cmbrfr2bark',
      'crédit mutuel de bretagne',
      'credit mutuel de bretagne',
      'crédit mutuel arkéa'
    ];
    
    const lowerText = pdfText.toLowerCase();
    return cmbIndicators.some(indicator => lowerText.includes(indicator));
  }

  /**
   * Extract account information from PDF text
   */
  static extractAccounts(pdfText) {
    const accounts = [];
    
    // Look for IBAN pattern: FR76 XXXX...
    const ibanMatch = pdfText.match(/IBAN\s*(FR\d{2}\s*[\d\s]+)/i);
    if (ibanMatch) {
      const iban = ibanMatch[1].replace(/\s/g, '');
      accounts.push({
        number: iban,
        label: 'Compte CMB',
        bank: 'credit_mutuel_bretagne'
      });
    }
    
    // Look for Compte pattern: Compte4211973040
    const compteMatch = pdfText.match(/Compte\s*(\d{10,})/i);
    if (compteMatch && accounts.length === 0) {
      accounts.push({
        number: compteMatch[1],
        label: 'Compte CMB',
        bank: 'credit_mutuel_bretagne'
      });
    }
    
    // Fallback
    if (accounts.length === 0) {
      accounts.push({
        number: 'CMB_DEFAULT',
        label: 'Compte Crédit Mutuel',
        bank: 'credit_mutuel_bretagne'
      });
    }
    
    return accounts;
  }

  /**
   * Parse transactions from PDF text
   * Format: DD/MM DD/MM/YYYY Libellé Montant
   */
  static parseTransactions(pdfText, accountFilter = null) {
    const transactions = [];
    const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log('📄 CMB PDF: Parsing', lines.length, 'lines');
    
    // Detect current section (to know if debit or credit)
    let currentSection = null; // 'credit' or 'debit'
    
    // Section headers
    const creditSections = ['VIREMENTSRECUS', 'VIREMENTS RECUS', 'VIREMENTS REÇUS'];
    const debitSections = [
      'VIREMENTSEMISETPRELEVEMENTS', 'VIREMENTS EMIS ET PRELEVEMENTS',
      'PAIEMENTSPARCARTE', 'PAIEMENTS PAR CARTE',
      'SERVICESETFRAISBANCAIRES', 'SERVICES ET FRAIS BANCAIRES',
      'RETRAITS', 'PRELEVEMENTS'
    ];
    
    // Transaction line pattern: DD/MM DD/MM/YYYY ... amount
    const txPattern = /^(\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d\s]+[,\.]\d{2})\s*€?\s*$/;
    
    // Also handle lines where amount might be on separate line
    const dateOnlyPattern = /^(\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+)$/;
    const amountPattern = /^([\d\s]+[,\.]\d{2})\s*€?\s*$/;
    
    let pendingTransaction = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineUpper = line.toUpperCase().replace(/\s/g, '');
      
      // Check for section changes
      if (creditSections.some(s => lineUpper.includes(s.replace(/\s/g, '')))) {
        currentSection = 'credit';
        console.log('📄 Section: CREDIT');
        continue;
      }
      if (debitSections.some(s => lineUpper.includes(s.replace(/\s/g, '')))) {
        currentSection = 'debit';
        console.log('📄 Section: DEBIT');
        continue;
      }
      
      // Skip header lines and totals
      if (this.isHeaderOrFooter(line)) {
        continue;
      }
      
      // Try to match full transaction line
      let match = line.match(txPattern);
      if (match) {
        const [, dateOp, dateValeur, label, amountStr] = match;
        const tx = this.createTransaction(dateOp, dateValeur, label, amountStr, currentSection, accountFilter);
        if (tx) {
          transactions.push(tx);
        }
        continue;
      }
      
      // Try date-only pattern (amount might be on next line or embedded)
      match = line.match(dateOnlyPattern);
      if (match) {
        const [, dateOp, dateValeur, rest] = match;
        
        // Check if amount is at the end of 'rest'
        const amountAtEnd = rest.match(/(.+?)\s+([\d\s]+[,\.]\d{2})\s*€?\s*$/);
        if (amountAtEnd) {
          const tx = this.createTransaction(dateOp, dateValeur, amountAtEnd[1], amountAtEnd[2], currentSection, accountFilter);
          if (tx) {
            transactions.push(tx);
          }
        } else {
          // Store pending, check next line for amount
          pendingTransaction = { dateOp, dateValeur, label: rest };
        }
        continue;
      }
      
      // Check if this is an amount line for pending transaction
      if (pendingTransaction) {
        const amountMatch = line.match(amountPattern);
        if (amountMatch) {
          const tx = this.createTransaction(
            pendingTransaction.dateOp,
            pendingTransaction.dateValeur,
            pendingTransaction.label,
            amountMatch[1],
            currentSection,
            accountFilter
          );
          if (tx) {
            transactions.push(tx);
          }
          pendingTransaction = null;
        } else {
          // Append to label
          pendingTransaction.label += ' ' + line;
        }
      }
    }
    
    console.log('📄 CMB PDF: Found', transactions.length, 'transactions');
    return transactions;
  }

  /**
   * Create a transaction object
   */
  static createTransaction(dateOp, dateValeur, label, amountStr, section, accountFilter) {
    // Parse date (use dateValeur which has full year)
    const dateParts = dateValeur.split('/');
    if (dateParts.length !== 3) return null;
    
    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1;
    const year = parseInt(dateParts[2]);
    const date = new Date(year, month, day);
    
    if (isNaN(date.getTime())) return null;
    
    // Parse amount
    let amount = parseFloat(
      amountStr
        .replace(/\s/g, '')
        .replace(',', '.')
    );
    
    if (isNaN(amount)) return null;
    
    // Apply sign based on section
    if (section === 'debit' && amount > 0) {
      amount = -amount;
    } else if (section === 'credit' && amount < 0) {
      amount = -amount;
    }
    
    // Clean label
    label = this.cleanLabel(label);
    
    if (label.length < 2) return null;
    
    return {
      date: date.toISOString().split('T')[0],
      label: label,
      amount: amount,
      category: this.guessCategory(label),
      type: this.guessType(label, amount),
      accountNumber: accountFilter || 'CMB_DEFAULT'
    };
  }

  /**
   * Clean and format label
   */
  static cleanLabel(label) {
    // Remove extra spaces
    label = label.replace(/\s+/g, ' ').trim();
    
    // Try to separate concatenated words
    label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Common prefixes to clean up
    const prefixes = [
      { pattern: /^VIRINST\s*/i, replacement: 'Virement ' },
      { pattern: /^VIR\s*/i, replacement: 'Virement ' },
      { pattern: /^PRLVSEPA\s*/i, replacement: 'Prélèvement ' },
      { pattern: /^PRLV\s*/i, replacement: 'Prélèvement ' },
      { pattern: /^CARTE\s*\d{2}\/\d{2}\s*/i, replacement: 'CB ' },
      { pattern: /^CB\s*/i, replacement: 'CB ' },
      { pattern: /^WERO\s*/i, replacement: 'Wero ' },
    ];
    
    for (const { pattern, replacement } of prefixes) {
      if (pattern.test(label)) {
        label = label.replace(pattern, replacement);
        break;
      }
    }
    
    // Remove UUIDs and long alphanumeric codes
    label = label.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '');
    label = label.replace(/[a-f0-9]{20,}/gi, '');
    label = label.replace(/\d{10,}/g, '');
    
    // Clean up extra spaces again
    label = label.replace(/\s+/g, ' ').trim();
    
    return label;
  }

  /**
   * Check if line is header/footer
   */
  static isHeaderOrFooter(line) {
    const skipPatterns = [
      /^Date\s+Date\s*de\s*Valeur/i,
      /^Date\s+DatedeValeur/i,
      /^Opération\s+Débit\s+Crédit/i,
      /ANCIENSOLDECRÉDITEUR/i,
      /ANCIEN\s*SOLDE/i,
      /NOUVEAUSOLDECRÉDITEUR/i,
      /NOUVEAU\s*SOLDE/i,
      /^TOTALDESOPÉRATIONS/i,
      /^TOTAL\s*DES\s*OPÉRATIONS/i,
      /Sous-total/i,
      /^Page\s*\d/i,
      /^Émis\s*le/i,
      /^Relevé\s*de\s*Compte/i,
      /^Titulaire/i,
      /^Compte\s*\d/i,
      /^N°\s*\d/i,
      /Garantie.*dépôts/i,
      /www\.cmb\.fr/i,
      /IBAN\s*FR/i,
      /^BIC\s/i,
      /Crédit\s*Mutuel\s*Arkéa/i,
      /ORIAS/i,
      /Siren/i,
      /RCS/i
    ];
    
    return skipPatterns.some(p => p.test(line));
  }

  /**
   * Guess category from transaction label
   */
  static guessCategory(label) {
    const lower = label.toLowerCase();
    
    // Transfers
    if (/virement|vir\s|livret|compte\s*cheque/i.test(lower)) return 'Virement interne';
    if (/wero/i.test(lower)) return 'Virement interne';
    
    // Income
    if (/salaire|paie|tresorerie|drfip|caf\s|allocations/i.test(lower)) return 'Revenus';
    
    // Subscriptions
    if (/netflix|spotify|amazon|google\s*one|disney|deezer|apple/i.test(lower)) return 'Abonnements';
    if (/edf|engie|electricite|gaz|eau|veolia/i.test(lower)) return 'Logement';
    if (/assurance|mutuelle|maif|maaf|axa|generali/i.test(lower)) return 'Assurance';
    if (/cotisation|frais\s*bancaires|offrejeunes/i.test(lower)) return 'Frais bancaires';
    
    // Shopping
    if (/leclerc|carrefour|auchan|lidl|intermarche|super|marche|courses/i.test(lower)) return 'Courses';
    if (/decathlon|hm|hennes|zara|mango|kiabi|celio|jules/i.test(lower)) return 'Shopping';
    if (/fnac|darty|boulanger|mediamarkt/i.test(lower)) return 'Shopping';
    if (/amazon|veepee|zalando|asos|shein/i.test(lower)) return 'Shopping';
    if (/papeterie|librairie/i.test(lower)) return 'Shopping';
    if (/castorama|leroy\s*merlin|bricorama|brico/i.test(lower)) return 'Maison';
    if (/zooplus|animaux|animalerie/i.test(lower)) return 'Animaux';
    
    // Food & Restaurants
    if (/restaurant|resto|mcdo|burger|pizza|kebab|sushi/i.test(lower)) return 'Restaurant';
    if (/boulangerie|fournier|fournee|patisserie/i.test(lower)) return 'Restaurant';
    if (/beurre\s*sale|creperie|cafe/i.test(lower)) return 'Restaurant';
    if (/deliveroo|uber\s*eats|just\s*eat/i.test(lower)) return 'Restaurant';
    
    // Transport
    if (/sncf|train|tgv|ouigo|ratp|metro|bus|transdev/i.test(lower)) return 'Transport';
    if (/carburant|essence|total|shell|bp\s|station/i.test(lower)) return 'Transport';
    if (/parking|autoroute|peage/i.test(lower)) return 'Transport';
    if (/blablacar|uber(?!\s*eats)|taxi|vtc/i.test(lower)) return 'Transport';
    
    // Health
    if (/pharmacie|phcie|medecin|docteur|sante|hopital|clinique/i.test(lower)) return 'Santé';
    if (/dentiste|ophtalmo|kine|osteo/i.test(lower)) return 'Santé';
    if (/blissim|beaute|parfum/i.test(lower)) return 'Beauté';
    
    // Loisirs
    if (/cinema|ugc|pathe|gaumont|theatre|concert|spectacle/i.test(lower)) return 'Loisirs';
    if (/sostrene\s*grene|flying\s*tiger|hema|gifi|action/i.test(lower)) return 'Loisirs';
    
    return 'Autre';
  }

  /**
   * Guess transaction type
   */
  static guessType(label, amount) {
    const lower = label.toLowerCase();
    
    // Internal transfers
    if (/virement.*vers|vir\s*vers|vers\s*livret|vers\s*compte/i.test(lower)) {
      return 'virement_interne';
    }
    if (/virement.*de|vir\s*de|de\s*livret|de\s*compte/i.test(lower)) {
      return 'virement_interne';
    }
    if (/wero/i.test(lower)) {
      return 'virement_interne';
    }
    
    // Subscriptions
    if (/netflix|spotify|amazon\s*prime|google\s*one|disney|edf|engie|assurance|cotisation/i.test(lower)) {
      return 'abonnement';
    }
    if (/prélèvement|prlv/i.test(lower)) {
      return 'abonnement';
    }
    
    // Default
    return 'individuelle';
  }

  /**
   * Parse PDF buffer - Main entry point
   */
  static async parsePdf(pdfBuffer) {
    try {
      // New pdf-parse v2 API
      const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
      const textResult = await parser.getText();
      const pdfText = textResult.text;
      
      console.log('📄 CMB PDF: Extracted', pdfText.length, 'characters');
      console.log('📄 CMB PDF: Preview:', pdfText.substring(0, 500));
      
      if (!this.canParse(pdfText)) {
        return {
          success: false,
          error: 'Ce PDF ne semble pas être un relevé Crédit Mutuel'
        };
      }
      
      const accounts = this.extractAccounts(pdfText);
      const transactions = this.parseTransactions(pdfText, accounts[0]?.number);
      
      return {
        success: true,
        bank: this.getBankName(),
        bankDisplay: this.getDisplayName(),
        accounts: accounts,
        transactions: transactions,
        rawText: pdfText // For debugging
      };
    } catch (err) {
      console.error('CMB PDF parsing error:', err);
      return {
        success: false,
        error: 'Erreur lors de la lecture du PDF: ' + err.message
      };
    }
  }
}

module.exports = CMBPdfParser;

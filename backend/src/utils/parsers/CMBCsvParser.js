const iconv = require('iconv-lite');
const IParser = require('./IParser');
const { categorizeBasic } = require('../categoryMapper');

/**
 * Crédit Mutuel de Bretagne CSV Parser
 * Format: "Date operation";"Date valeur";"Libelle";"Debit";"Credit"
 * - Separator: semicolon (;)
 * - Date format: DD/MM/YYYY
 * - Amount format: French (comma as decimal separator: 25,86)
 * - Debit = expense (negative), Credit = income (positive)
 */
class CMBCsvParser extends IParser {
  static canParse(csvContent) {
    const content = this.decodeContent(csvContent);
    // Check for CMB CSV header
    return content.includes('"Date operation"') && 
           content.includes('"Libelle"') &&
           (content.includes('"Debit"') || content.includes('"Credit"'));
  }

  static getBankName() {
    return 'credit_mutuel_bretagne';
  }

  static decodeContent(csvContent) {
    // Check if needs ISO-8859-1 decoding (common for French bank exports)
    if (csvContent.includes('\xe9') || csvContent.includes('\xe0') || 
        csvContent.includes('\xf4') || csvContent.includes('\xb0') ||
        csvContent.includes('\x80')) {
      try {
        const buffer = Buffer.from(csvContent, 'binary');
        return iconv.decode(buffer, 'ISO-8859-1');
      } catch (err) {
        return csvContent;
      }
    }
    return csvContent;
  }

  static extractAccounts(csvContent) {
    // CMB CSV doesn't include account info in the export
    // Return a default account
    return [{
      type: 'checking',
      label: 'Compte Chèques CMB',
      number: 'CMB_CSV_IMPORT',
      maskedNumber: '***CMB',
      balance: null
    }];
  }

  static async parseTransactions(csvContent, accountFilter = null) {
    const content = this.decodeContent(csvContent);
    const transactions = [];
    
    // Split into lines
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 2) {
      return transactions;
    }
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const tx = this.parseLine(line);
      if (tx) {
        transactions.push(tx);
      }
    }
    
    return transactions;
  }

  /**
   * Parse a single CSV line
   * Format: "Date operation";"Date valeur";"Libelle";"Debit";"Credit"
   */
  static parseLine(line) {
    // Parse CSV with quoted fields and semicolon separator
    const fields = this.parseCSVLine(line);
    
    if (fields.length < 5) {
      return null;
    }
    
    const dateOperation = fields[0];
    // const dateValeur = fields[1]; // Not used currently
    const label = fields[2];
    const debitStr = fields[3];
    const creditStr = fields[4];
    
    // Parse date (DD/MM/YYYY → YYYY-MM-DD)
    const dateParts = dateOperation.split('/');
    if (dateParts.length !== 3) {
      return null;
    }
    const date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
    
    // Parse amounts (French format with comma: 25,86)
    const debit = this.parseAmount(debitStr);
    const credit = this.parseAmount(creditStr);
    
    // Skip if no amount
    if (debit === 0 && credit === 0) {
      return null;
    }
    
    // Determine final amount
    // Debit = expense (should be negative)
    // Credit = income (should be positive)
    let amount;
    if (credit !== 0) {
      amount = Math.abs(credit);
    } else {
      amount = -Math.abs(debit);
    }
    
    // Simplify label
    const simplifiedLabel = this.simplifyLabel(label);
    
    // Categorize using ORIGINAL label for better matching
    let category = categorizeBasic(label);
    
    // Additional CMB-specific categorization
    if (category === 'Non catégorisé' || category === 'Dépense') {
      category = this.categorizeCMB(label, simplifiedLabel);
    }
    
    return {
      date,
      label: simplifiedLabel,
      amount,
      category,
      accountNumber: 'CMB_CSV_IMPORT'
    };
  }

  /**
   * Parse a CSV line with quoted fields and semicolon separator
   */
  static parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    fields.push(current.trim());
    
    return fields;
  }

  /**
   * Parse French format amount (25,86 → 25.86)
   */
  static parseAmount(str) {
    if (!str || str.trim() === '') return 0;
    // Replace comma with dot for decimal
    const cleaned = str.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Simplify and clean transaction labels
   */
  static simplifyLabel(label) {
    if (!label) return 'Transaction';
    
    // Remove extra spaces
    label = label.replace(/\s+/g, ' ').trim();
    
    // Card payment: "CARTE DD/MM MERCHANT CITY"
    const cardMatch = label.match(/^CARTE\s+\d{2}\/\d{2}\s+(.+)/i);
    if (cardMatch) {
      let merchant = cardMatch[1].trim();
      // Remove trailing city/country code patterns
      merchant = merchant.replace(/\s+\d{5,}.*$/, ''); // Remove postal codes
      merchant = merchant.replace(/\s+[A-Z]{2}$/, ''); // Remove country codes
      if (merchant.length > 40) {
        merchant = merchant.substring(0, 37) + '...';
      }
      return 'CB: ' + merchant;
    }
    
    // Instant transfer sent: "VIR INST vers NAME"
    if (label.match(/^VIR\s+INST\s+vers\s+/i)) {
      const match = label.match(/^VIR\s+INST\s+vers\s+(.+)/i);
      if (match) {
        return 'Virement vers: ' + match[1].trim().substring(0, 25);
      }
    }
    
    // Wero transfer: "VIR INST WERO WERO NAME"
    if (label.match(/^VIR\s+INST\s+WERO/i)) {
      const match = label.match(/^VIR\s+INST\s+WERO\s+(?:WERO\s+)?(.+)/i);
      if (match) {
        return 'Wero vers: ' + match[1].trim().substring(0, 25);
      }
    }
    
    // Transfer received: "VIR de NAME / ..."
    if (label.match(/^VIR\s+de\s+/i)) {
      const match = label.match(/^VIR\s+de\s+([^\/]+)/i);
      if (match) {
        let source = match[1].trim();
        if (source.includes('LIVRET')) {
          return 'Virement depuis: Livret';
        }
        return 'Virement reçu: ' + source.substring(0, 25);
      }
    }
    
    // Transfer to savings: "VIR vers LIVRET..."
    if (label.match(/^VIR\s+vers\s+LIVRET/i)) {
      return 'Virement vers: Livret';
    }
    
    // Direct debit: "PRLV COMPANY"
    if (label.match(/^PRLV\s+/i)) {
      const match = label.match(/^PRLV\s+(.+)/i);
      if (match) {
        return 'Prélèvement: ' + match[1].trim().substring(0, 25);
      }
    }
    
    // Bank fee: "F COTISATION..."
    if (label.match(/^F\s+COTISATION/i)) {
      return 'Frais bancaires CMB';
    }
    
    // CAF payment
    if (label.includes('CAF')) {
      return 'CAF';
    }
    
    // DRFIP (tax refund/government)
    if (label.includes('DRFIP')) {
      return 'DRFIP (Prime/Impôts)';
    }
    
    // Salary from employer (common patterns)
    if (label.includes('TRESORERIE') && label.includes('CHR')) {
      return 'Salaire CHU/Hôpital';
    }
    
    // Truncate if too long
    if (label.length > 50) {
      return label.substring(0, 47) + '...';
    }
    
    return label;
  }

  /**
   * CMB-specific categorization
   */
  static categorizeCMB(originalLabel, simplifiedLabel) {
    const upper = originalLabel.toUpperCase();
    
    // Courses / Supermarkets
    if (upper.includes('U EXPRESS') || upper.includes('SUPER U') || upper.includes('HYPER U') ||
        upper.includes('LECLERC') || upper.includes('CARREFOUR') || upper.includes('INTERMARCHE') ||
        upper.includes('LIDL') || upper.includes('ALDI') || upper.includes('MONOPRIX')) {
      return 'Courses';
    }
    
    // Abonnements
    if (upper.includes('GOOGLE ONE') || upper.includes('NETFLIX') || upper.includes('SPOTIFY') ||
        upper.includes('APPLE.COM') || upper.includes('AMAZON PRIME') || upper.includes('DISNEY') ||
        upper.includes('BLISSIM') || upper.includes('HPI INSTANT INK') || upper.includes('DEEZER')) {
      return 'Abonnements';
    }
    
    // Shopping / Vêtements
    if (upper.includes('MANGO') || upper.includes('ZARA') || upper.includes('H&M') || upper.includes('H  M') ||
        upper.includes('PRIMARK') || upper.includes('ETAM') || upper.includes('VEEPEE') ||
        upper.includes('LA REDOUTE') || upper.includes('KIABI') || upper.includes('C&A') ||
        upper.includes('DECATHLON') || upper.includes('NORMAL')) {
      return 'Shopping';
    }
    
    // Logement
    if (upper.includes('IKEA') || upper.includes('CASTORAMA') || upper.includes('LEROY MERLIN') ||
        upper.includes('BRICO') || upper.includes('SOSTRENE GRENE')) {
      return 'Logement';
    }
    
    // Restaurant / Food
    if (upper.includes('CREP') || upper.includes('RESTAURANT') || upper.includes('BEURRE SALE') ||
        upper.includes('LA FOURNEE') || upper.includes('BOULANG') || upper.includes('CUISINE') ||
        upper.includes('MCDO') || upper.includes('KFC') || upper.includes('BURGER') ||
        upper.includes('UBER EATS') || upper.includes('DELIVEROO') || upper.includes('IZLY')) {
      return 'Restaurant';
    }
    
    // Santé
    if (upper.includes('PHCIE') || upper.includes('PHARMACIE') || upper.includes('DR ') ||
        upper.includes('DOCTEUR') || upper.includes('LONGEPE') || upper.includes('MEDECIN')) {
      return 'Santé';
    }
    
    // Transport
    if (upper.includes('SNCF') || upper.includes('TRAIN') || upper.includes('ESSENCE') ||
        upper.includes('TOTAL') || upper.includes('SHELL') || upper.includes('TAXI')) {
      return 'Transport';
    }
    
    // Loisirs
    if (upper.includes('LIBRAIRIE') || upper.includes('PAPETERIE') || upper.includes('CINEMA') ||
        upper.includes('FNAC') || upper.includes('CULTURA')) {
      return 'Loisirs';
    }
    
    // Virements internes (vers partenaire, livrets, etc.)
    if (upper.includes('VIR INST VERS') || upper.includes('WERO') || upper.includes('VIR VERS LIVRET')) {
      return 'Virement interne';
    }
    
    // Revenus
    if (upper.includes('VIR DE') || upper.includes('CAF') || upper.includes('DRFIP') ||
        upper.includes('TRESORERIE') || upper.includes('SALAIRE')) {
      return 'Revenus';
    }
    
    return 'Autre';
  }
}

module.exports = CMBCsvParser;

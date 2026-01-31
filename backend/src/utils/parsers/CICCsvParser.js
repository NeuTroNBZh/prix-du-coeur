/**
 * Parser for CIC CSV exports
 * Format: Date;Date de valeur;Débit;Crédit;Libellé;Solde
 */
class CICCsvParser {
  static getBankName() {
    return 'cic';
  }

  static getDisplayName() {
    return 'CIC';
  }

  /**
   * Check if this CSV is from CIC
   * Headers: Date;Date de valeur;Débit;Crédit;Libellé;Solde
   */
  static canParse(csvContent) {
    const firstLines = csvContent.substring(0, 500).toLowerCase();
    
    // Check for CIC specific headers
    const hasCicHeaders = 
      firstLines.includes('date de valeur') &&
      firstLines.includes('débit') &&
      firstLines.includes('crédit') &&
      firstLines.includes('libellé') &&
      firstLines.includes('solde');
    
    // Alternative check with semicolon separator
    const hasHeaderPattern = /date;date de valeur;d[ée]bit;cr[ée]dit;libell[ée];solde/i.test(firstLines);
    
    return hasCicHeaders || hasHeaderPattern;
  }

  /**
   * Extract account info from CSV
   */
  static extractAccounts(csvContent) {
    // CIC CSV doesn't include account number in the file
    // Try to extract from filename pattern or use default
    const accounts = [{
      number: 'CIC_IMPORT',
      label: 'Compte CIC',
      bank: 'cic'
    }];
    
    return accounts;
  }

  /**
   * Parse transactions from CSV content
   */
  static async parseTransactions(csvContent, accountFilter = null) {
    const transactions = [];
    const lines = csvContent.split('\n');
    
    // Find header line
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      if (lines[i].toLowerCase().includes('date') && 
          lines[i].toLowerCase().includes('libellé')) {
        headerIdx = i;
        break;
      }
    }
    
    if (headerIdx === -1) {
      console.log('CIC Parser: No header found');
      return [];
    }
    
    // Parse header to get column indices
    const headers = lines[headerIdx].split(';').map(h => h.trim().toLowerCase());
    const dateIdx = headers.findIndex(h => h === 'date');
    const debitIdx = headers.findIndex(h => h.includes('débit') || h.includes('debit'));
    const creditIdx = headers.findIndex(h => h.includes('crédit') || h.includes('credit'));
    const labelIdx = headers.findIndex(h => h.includes('libellé') || h.includes('libelle'));
    
    console.log('CIC Parser: Column indices - date:', dateIdx, 'debit:', debitIdx, 'credit:', creditIdx, 'label:', labelIdx);
    
    // Parse data lines
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = this.parseCSVLine(line);
      if (cols.length < 5) continue;
      
      // Parse date (DD/MM/YYYY)
      const dateStr = cols[dateIdx];
      if (!dateStr || !dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) continue;
      
      const [day, month, year] = dateStr.split('/');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      if (isNaN(date.getTime())) continue;
      
      // Parse amount (debit is negative, credit is positive)
      let amount = 0;
      const debitStr = cols[debitIdx]?.trim();
      const creditStr = cols[creditIdx]?.trim();
      
      if (debitStr) {
        // Debit values are already negative in the CSV (-5,99)
        amount = this.parseAmount(debitStr);
      } else if (creditStr) {
        // Credit values are positive
        amount = this.parseAmount(creditStr);
      }
      
      if (amount === 0) continue;
      
      // Get label
      const label = cols[labelIdx]?.trim() || 'Transaction CIC';
      
      transactions.push({
        date: date.toISOString().split('T')[0],
        label: this.cleanLabel(label),
        amount: amount,
        type: amount > 0 ? 'credit' : 'debit',
        category: this.guessCategory(label),
        accountNumber: accountFilter || 'CIC_IMPORT'
      });
    }
    
    console.log('CIC Parser: Found', transactions.length, 'transactions');
    return transactions;
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  }

  /**
   * Parse French amount format (1 234,56 or -1234,56)
   */
  static parseAmount(amountStr) {
    if (!amountStr) return 0;
    
    // Remove spaces and replace comma with dot
    const cleaned = amountStr
      .replace(/\s/g, '')
      .replace(',', '.');
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Clean up label
   */
  static cleanLabel(label) {
    return label
      .replace(/\s+/g, ' ')
      .replace(/CARTE \d+/g, '')
      .trim();
  }

  /**
   * Guess category based on label
   */
  static guessCategory(label) {
    const lowerLabel = label.toLowerCase();
    
    if (lowerLabel.includes('carrefour') || lowerLabel.includes('leclerc') || 
        lowerLabel.includes('auchan') || lowerLabel.includes('lidl') ||
        lowerLabel.includes('intermarche')) {
      return 'Courses';
    }
    if (lowerLabel.includes('sncf') || lowerLabel.includes('ratp') || 
        lowerLabel.includes('uber') || lowerLabel.includes('easypark')) {
      return 'Transport';
    }
    if (lowerLabel.includes('restaurant') || lowerLabel.includes('mcdo') || 
        lowerLabel.includes('burger') || lowerLabel.includes('bar')) {
      return 'Restauration';
    }
    if (lowerLabel.includes('netflix') || lowerLabel.includes('spotify') || 
        lowerLabel.includes('amazon prime')) {
      return 'Abonnements';
    }
    if (lowerLabel.includes('vir') && (lowerLabel.includes('salaire') || lowerLabel.includes('paie'))) {
      return 'Revenus';
    }
    if (lowerLabel.includes('bourse') || lowerLabel.includes('drfip')) {
      return 'Aides';
    }
    if (lowerLabel.includes('loyer') || lowerLabel.includes('kerdiles')) {
      return 'Logement';
    }
    if (lowerLabel.includes('paypal')) {
      return 'Achats en ligne';
    }
    
    return null;
  }
}

module.exports = CICCsvParser;

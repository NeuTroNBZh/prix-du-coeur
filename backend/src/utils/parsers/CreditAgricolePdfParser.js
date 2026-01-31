const { PDFParse } = require('pdf-parse');

/**
 * Parser for Crédit Agricole PDF statements
 * Format: DD.MM DD.MM Libellé Débit Crédit
 */
class CreditAgricolePdfParser {
  static getBankName() {
    return 'credit_agricole';
  }

  static getDisplayName() {
    return 'Crédit Agricole';
  }

  /**
   * Check if this PDF is from Crédit Agricole
   */
  static canParse(pdfText) {
    const caIndicators = [
      'credit agricole',
      'crédit agricole',
      'ca-illeetvilaine',
      'ca-bretagne',
      'agrifrpp',
      'caisse régionale de crédit agricole',
      'crédit agricole mutuel'
    ];
    
    const lowerText = pdfText.toLowerCase();
    return caIndicators.some(indicator => lowerText.includes(indicator));
  }

  /**
   * Parse PDF buffer and extract transactions
   */
  static async parsePdf(pdfBuffer) {
    try {
      // pdf-parse v2 API
      const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
      const textResult = await parser.getText();
      const pdfText = textResult.text;
      
      console.log('📄 CA PDF: Extracted', pdfText.length, 'characters');
      
      // Check if this is a CA PDF
      if (!this.canParse(pdfText)) {
        return {
          success: false,
          error: 'Ce PDF ne semble pas être un relevé Crédit Agricole'
        };
      }
      
      // Extract account info
      const accounts = this.extractAccounts(pdfText);
      console.log('💳 CA PDF: Found accounts:', accounts);
      
      // Get account number for transactions
      const accountNumber = accounts.length > 0 ? accounts[0].number : 'CA_DEFAULT';
      
      // Parse transactions
      const transactions = this.parseTransactions(pdfText, accountNumber);
      console.log('📊 CA PDF: Found', transactions.length, 'transactions');
      
      // Log first 3 transactions for debugging
      if (transactions.length > 0) {
        console.log('📊 CA PDF: Sample transactions:', JSON.stringify(transactions.slice(0, 3), null, 2));
      } else {
        console.log('⚠️ CA PDF: No transactions found! Text sample:', pdfText.substring(0, 1000));
      }
      
      return {
        success: true,
        bank: this.getBankName(),
        bankDisplay: this.getDisplayName(),
        accounts,
        transactions
      };
    } catch (error) {
      console.error('CA PDF parsing error:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'analyse du PDF'
      };
    }
  }

  /**
   * Extract account information from PDF text
   */
  static extractAccounts(pdfText) {
    const accounts = [];
    
    // Look for IBAN pattern: FR76 XXXX XXXX XXXX...
    const ibanMatch = pdfText.match(/IBAN\s*:\s*(FR\d{2}\s*[\d\s]+)/i);
    if (ibanMatch) {
      const iban = ibanMatch[1].replace(/\s/g, '').substring(0, 27);
      accounts.push({
        number: iban,
        label: 'Compte Crédit Agricole',
        bank: 'credit_agricole'
      });
    }
    
    // Look for Compte Chèque pattern: Compte Chèque n° XXXXXXXXXXX
    const compteMatch = pdfText.match(/Compte\s*(?:Chèque|Cheque)?\s*n°?\s*(\d{10,})/i);
    if (compteMatch) {
      const existing = accounts.find(a => a.number.includes(compteMatch[1]));
      if (!existing) {
        accounts.push({
          number: compteMatch[1],
          label: 'Compte Chèque Crédit Agricole',
          bank: 'credit_agricole'
        });
      }
    }
    
    // Fallback
    if (accounts.length === 0) {
      accounts.push({
        number: 'CA_DEFAULT',
        label: 'Compte Crédit Agricole',
        bank: 'credit_agricole'
      });
    }
    
    return accounts;
  }

  /**
   * Parse transactions from PDF text
   * Format CA: DD.MM DD.MM Libellé Montant (avec þ pour crédit, ̈ pour débit parfois)
   */
  static parseTransactions(pdfText, accountNumber = 'CA_DEFAULT') {
    const transactions = [];
    const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    console.log('📄 CA PDF: Processing', lines.length, 'lines for account:', accountNumber);
    
    // Detect current year from the document
    let currentYear = new Date().getFullYear();
    const yearMatch = pdfText.match(/(\d{4})/);
    if (yearMatch) {
      const foundYear = parseInt(yearMatch[1]);
      if (foundYear >= 2020 && foundYear <= 2030) {
        currentYear = foundYear;
      }
    }
    
    // Pattern pour les lignes de transaction CA
    // Format: DD.MM DD.MM Libellé Montant
    // Le montant peut avoir des espaces (1 706,14) et se terminer par  ̈
    const txPatterns = [
      // Pattern avec deux dates DD.MM DD.MM
      /^(\d{2}\.\d{2})\s+(\d{2}\.\d{2})\s+(.+?)\s+([\d\s]+,\d{2})\s*[̈þ]?\s*$/,
      // Pattern avec dates DD.MM et montant
      /^(\d{2})\.(\d{2})\s+\d{2}\.\d{2}\s+(.+?)\s+([\d\s]+,\d{2})/,
    ];
    
    // Mots-clés pour identifier les débits vs crédits
    const creditKeywords = [
      'virement', 'vir inst de', 'avoir', 'remboursement', 'retour',
      'castorama france', 'virt. appointements', 'salaire', 'paie'
    ];
    const debitKeywords = [
      'carte x', 'prlv', 'prélèvement', 'vir inst vers', 'achat',
      'paiement', 'retrait'
    ];
    
    let pendingLabel = '';
    let lastTransaction = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip headers and footers
      if (this.isHeaderOrFooter(line)) {
        continue;
      }
      
      // Try to match transaction pattern
      let matched = false;
      
      for (const pattern of txPatterns) {
        const match = line.match(pattern);
        if (match) {
          const dateOpStr = match[1].includes('.') ? match[1] : `${match[1]}.${match[2]}`;
          const label = match[3].trim();
          const amountStr = match[4] || match[match.length - 1];
          
          // Parse date
          const [day, month] = dateOpStr.split('.');
          const date = this.buildDate(day, month, currentYear, pdfText);
          
          // Parse amount
          const amount = this.parseAmount(amountStr);
          
          if (amount !== 0) {
            // Determine if debit or credit based on context
            const isCredit = this.isCredit(label, line);
            const finalAmount = isCredit ? Math.abs(amount) : -Math.abs(amount);
            
            const tx = {
              date: date.toISOString().split('T')[0],
              label: this.cleanLabel(label),
              amount: finalAmount,
              type: isCredit ? 'credit' : 'debit',
              category: null,
              source: 'pdf_import',
              bank: 'credit_agricole',
              accountNumber: accountNumber
            };
            
            transactions.push(tx);
            lastTransaction = tx;
            matched = true;
          }
          break;
        }
      }
      
      // If not matched, might be a continuation of previous label
      if (!matched && lastTransaction && !this.isHeaderOrFooter(line) && !line.match(/^\d/)) {
        // Check if it's additional info for last transaction
        if (line.length > 5 && line.length < 100) {
          lastTransaction.label += ' ' + this.cleanLabel(line);
        }
      }
    }
    
    // Remove duplicates and sort by date
    const uniqueTx = this.removeDuplicates(transactions);
    uniqueTx.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return uniqueTx;
  }

  /**
   * Build date from day/month, handling year transitions
   */
  static buildDate(day, month, baseYear, pdfText) {
    const d = parseInt(day);
    const m = parseInt(month);
    
    // Check if we need to adjust year (December transactions in January statement)
    let year = baseYear;
    
    // Look for date context in PDF
    const dateArrete = pdfText.match(/Date d'arrêté\s*:\s*(\d{1,2})\s*(\w+)\s*(\d{4})/i);
    if (dateArrete) {
      const statementYear = parseInt(dateArrete[3]);
      const statementMonth = this.parseMonthName(dateArrete[2]);
      
      // If transaction month is December and statement is January, use previous year
      if (m === 12 && statementMonth === 1) {
        year = statementYear - 1;
      } else {
        year = statementYear;
      }
    }
    
    return new Date(year, m - 1, d);
  }

  /**
   * Parse French month name to number
   */
  static parseMonthName(monthName) {
    const months = {
      'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4,
      'mai': 5, 'juin': 6, 'juillet': 7, 'août': 8, 'aout': 8,
      'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12
    };
    return months[monthName.toLowerCase()] || 1;
  }

  /**
   * Parse amount string to number
   */
  static parseAmount(amountStr) {
    if (!amountStr) return 0;
    
    // Remove spaces and special characters, replace comma with dot
    const cleaned = amountStr
      .replace(/\s/g, '')
      .replace(/[̈þ€]/g, '')
      .replace(',', '.');
    
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  /**
   * Determine if a transaction is a credit (income)
   */
  static isCredit(label, fullLine) {
    const lowerLabel = label.toLowerCase();
    const lowerLine = fullLine.toLowerCase();
    
    // Check for credit indicators
    const creditIndicators = [
      'virt. appointements',
      'vir inst de ',  // Note: space after "de"
      'avoir carte',
      'remboursement',
      'retour noel',
      'trajet brest',  // Reimbursement
    ];
    
    // Check for debit indicators (these override credit)
    const debitIndicators = [
      'carte x',
      'prlv ',
      'prélèvement',
      'vir inst vers',  // Note: "vers" = sending money
      'virement vir inst vers'
    ];
    
    // First check for explicit debit indicators
    for (const indicator of debitIndicators) {
      if (lowerLabel.includes(indicator) || lowerLine.includes(indicator)) {
        return false;
      }
    }
    
    // Then check for credit indicators
    for (const indicator of creditIndicators) {
      if (lowerLabel.includes(indicator) || lowerLine.includes(indicator)) {
        return true;
      }
    }
    
    // Check if þ symbol is present (often indicates credit in CA PDFs)
    if (fullLine.includes('þ')) {
      return true;
    }
    
    // Check if  ̈ symbol is present (often indicates debit)
    if (fullLine.includes('̈')) {
      return false;
    }
    
    // Default: check common patterns
    if (lowerLabel.includes('salaire') || lowerLabel.includes('paie')) {
      return true;
    }
    
    // By default, assume debit (expense)
    return false;
  }

  /**
   * Clean up transaction label
   */
  static cleanLabel(label) {
    return label
      .replace(/\s+/g, ' ')
      .replace(/[̈þ]/g, '')
      .replace(/^\d{2}\/\d{2}\s*/, '') // Remove leading dates
      .trim();
  }

  /**
   * Check if line is header or footer (should be skipped)
   */
  static isHeaderOrFooter(line) {
    const skipPatterns = [
      /^page\s*\d/i,
      /^releve de comptes/i,
      /^relevé de comptes/i,
      /^date d'arrêté/i,
      /^credit agricole/i,
      /^crédit agricole/i,
      /^m\.\s+cercle/i,
      /^votre agence/i,
      /^votre conseiller/i,
      /^vos contacts/i,
      /^synthese/i,
      /^iban\s*:/i,
      /^bic\s*:/i,
      /^total des opérations/i,
      /^nouveau solde/i,
      /^ancien solde/i,
      /^solde au/i,
      /^date\s+opé/i,
      /^date\s+valeur/i,
      /^libellé/i,
      /^débit/i,
      /^crédit/i,
      /^tél\s*:/i,
      /^internet\s*:/i,
      /^www\./i,
      /^\d{6}\s+\d{6}/,  // Reference numbers
      /^vous concernant/i,
      /^indice de référence/i,
      /^conditions de dépassement/i,
      /^garantie des dépôts/i,
      /^les opérations dont/i,
      /^caisse régionale/i,
      /^\+\s*\d/,  // Solde positif
      /^−\s*\d/,  // Solde négatif
    ];
    
    return skipPatterns.some(p => p.test(line));
  }

  /**
   * Remove duplicate transactions
   */
  static removeDuplicates(transactions) {
    const seen = new Set();
    return transactions.filter(tx => {
      const key = `${tx.date}|${tx.label.substring(0, 30)}|${tx.amount}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = CreditAgricolePdfParser;

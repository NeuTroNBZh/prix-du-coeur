const IParser = require('./IParser');
const { categorizeBasic } = require('../categoryMapper');

/**
 * Revolut CSV Parser
 * Format: Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
 */
class RevolutParser extends IParser {
  static canParse(csvContent) {
    // Detect Revolut format by checking header
    // Support both French and English headers
    const firstLine = csvContent.split('\n')[0].toLowerCase();
    
    // Check for key Revolut header fields (French or English)
    const hasType = firstLine.includes('type');
    const hasProduit = firstLine.includes('produit') || firstLine.includes('product');
    const hasDescription = firstLine.includes('description');
    const hasMontant = firstLine.includes('montant') || firstLine.includes('amount');
    const hasDevise = firstLine.includes('devise') || firstLine.includes('currency');
    const hasSolde = firstLine.includes('solde') || firstLine.includes('balance');
    const hasDate = firstLine.includes('date');
    const hasState = firstLine.includes('état') || firstLine.includes('state');
    
    // If we have most key fields, it's probably Revolut
    const keyFieldsCount = [hasType, hasProduit, hasDescription, hasMontant, hasDevise, hasSolde, hasDate, hasState]
      .filter(Boolean).length;
    
    return keyFieldsCount >= 6;
  }

  static getBankName() {
    return 'revolut';
  }

  static extractAccounts(csvContent) {
    // Revolut exports are per account, extract from "Produit" column
    const lines = csvContent.split('\n');
    const accounts = new Set();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const cols = this.parseCSVLine(line);
      if (cols.length >= 2 && cols[1]) {
        accounts.add(cols[1]); // Produit column
      }
    }
    
    // Return unique accounts
    return Array.from(accounts).map(name => ({
      type: 'Compte Revolut',
      label: name,
      number: name // Use product name as identifier
    }));
  }

  static async parseTransactions(csvContent, accountFilter = null) {
    const lines = csvContent.split('\n');
    const transactions = [];
    
    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const tx = this.parseTransaction(line, accountFilter);
        if (tx) {
          transactions.push(tx);
        }
      } catch (err) {
        console.error(`Error parsing Revolut line ${i}:`, err.message);
        continue;
      }
    }
    
    return transactions;
  }

  /**
   * Parse CSV line handling quoted fields with commas
   */
  static parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
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
   * Parse a single transaction line
   * Format: Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
   */
  static parseTransaction(line, accountFilter) {
    const cols = this.parseCSVLine(line);
    
    if (cols.length < 10) {
      return null;
    }
    
    const [type, product, startDate, endDate, description, amountStr, feesStr, currency, status, balance] = cols;
    
    // Filter by account if specified
    if (accountFilter && product !== accountFilter) {
      return null;
    }
    
    // Skip if not completed (French: TERMINÉ, English: COMPLETED)
    if (status !== 'TERMINÉ' && status !== 'COMPLETED') {
      return null;
    }
    
    // Skip "Changes" (currency conversions) - they're technical transactions
    if (type === 'Changes') {
      return null;
    }
    
    // Parse amount (format: -123.45 or 123.45)
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount) || amount === 0) {
      return null;
    }
    
    // Parse date (format: YYYY-MM-DD HH:MM:SS)
    // Use "Date de fin" as it's the completion date
    const dateMatch = endDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dateMatch) {
      return null;
    }
    
    const [, year, month, day] = dateMatch;
    // PostgreSQL expects YYYY-MM-DD format
    const date = `${year}-${month}-${day}`;
    
    // Build label from type and description
    let label = description;
    
    // Add type prefix for clarity
    if (type === 'Paiement par carte') {
      label = `Achat: ${description}`;
    } else if (type === 'Ajout de fonds') {
      label = `Virement reçu: ${description}`;
    } else if (type === 'Virement') {
      label = `Virement: ${description}`;
    } else if (type === 'Remboursement sur carte') {
      label = `Remboursement: ${description}`;
    }
    
    // Categorize transaction
    const category = categorizeBasic(label);
    
    return {
      date,
      label,
      amount,
      category,
      accountNumber: product,
      type: type,
      currency: currency
    };
  }
}

module.exports = RevolutParser;

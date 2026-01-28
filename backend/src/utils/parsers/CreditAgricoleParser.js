const iconv = require('iconv-lite');
const IParser = require('./IParser');
const { categorizeBasic } = require('../categoryMapper');

/**
 * Crédit Agricole CSV Parser
 * Format: Date;Libellé;Débit euros;Crédit euros;
 * Handles multi-line labels within quotes (with empty lines inside)
 */
class CreditAgricoleParser extends IParser {
  static canParse(csvContent) {
    // Detect CA format
    const content = this.decodeContent(csvContent);
    return content.includes('Crédit euros') || 
           content.includes('Débit euros') ||
           content.includes('bit euros') ||
           content.includes('carte n');
  }

  static getBankName() {
    return 'credit_agricole';
  }

  static decodeContent(csvContent) {
    // Check if needs ISO-8859-1 decoding
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
    const content = this.decodeContent(csvContent);
    const accounts = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match "carte n° XXXXXXX" or "carte n° XXXXXXX;"
      const cardMatch = line.match(/carte\s*n[°º]?\s*(\d+)/i);
      if (cardMatch) {
        const accountNumber = cardMatch[1];
        
        // Determine account type from this line
        let accountType = 'checking';
        let accountLabel = 'Compte bancaire';
        
        if (/Compte de D[ée]p[oô]t/i.test(line)) {
          accountType = 'checking';
          accountLabel = 'Compte de Dépôt';
        } else if (/Livret A(?!\w)/i.test(line)) {
          accountType = 'savings';
          accountLabel = 'Livret A';
        } else if (/Compte Sur Livret/i.test(line)) {
          accountType = 'savings';
          accountLabel = 'Compte Sur Livret';
        } else if (/Livret Jeune/i.test(line)) {
          accountType = 'youth_savings';
          accountLabel = 'Livret Jeune';
        }
        
        // Try to find balance on next lines
        let balance = null;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const balanceMatch = lines[j].match(/Solde\s+au.*?([\d\s]+[,.][\d]{2})\s*[€EUR]/i);
          if (balanceMatch) {
            balance = parseFloat(balanceMatch[1].replace(/\s/g, '').replace(',', '.'));
            break;
          }
        }

        accounts.push({
          type: accountType,
          label: accountLabel,
          number: accountNumber,
          maskedNumber: '***' + accountNumber.slice(-4),
          balance: balance
        });
      }
    }

    return accounts;
  }

  static async parseTransactions(csvContent, accountFilter = null) {
    const content = this.decodeContent(csvContent);
    const allTransactions = [];
    
    // Split into account sections
    const sections = this.splitIntoAccountSections(content);
    
    for (const section of sections) {
      if (accountFilter && section.accountNumber !== accountFilter) {
        continue;
      }
      
      const transactions = this.parseSection(section);
      allTransactions.push(...transactions);
    }

    return allTransactions;
  }

  /**
   * Split content into sections by account
   */
  static splitIntoAccountSections(content) {
    const sections = [];
    const lines = content.split('\n');
    
    let currentSection = null;
    let inTransactionArea = false;
    let rawTransactionLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for new account
      const cardMatch = line.match(/carte\s*n[°º]?\s*(\d+)/i);
      if (cardMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.rawLines = rawTransactionLines;
          sections.push(currentSection);
        }
        
        currentSection = {
          accountNumber: cardMatch[1],
          rawLines: []
        };
        inTransactionArea = false;
        rawTransactionLines = [];
        continue;
      }
      
      // Check for transaction header
      if (line.includes('Date;Libell') || line.match(/Date;.*bit.*euros/i)) {
        inTransactionArea = true;
        continue;
      }
      
      // Stop collecting if we hit a new section marker
      if (inTransactionArea && (line.match(/^M\.\s+/i) || line.match(/^Mme\s+/i) || 
          line.match(/^CERCLE\s/i) || line.match(/Solde au/i) || 
          line.match(/Liste des op/i))) {
        inTransactionArea = false;
        continue;
      }
      
      // Collect transaction lines
      if (inTransactionArea && currentSection) {
        rawTransactionLines.push(line);
      }
    }
    
    // Don't forget last section
    if (currentSection) {
      currentSection.rawLines = rawTransactionLines;
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Parse a section's raw lines into transactions
   */
  static parseSection(section) {
    const transactions = [];
    const rawLines = section.rawLines;
    
    // Join all lines
    const fullText = rawLines.join('\n');
    
    // Split by transaction start (date pattern at start of line)
    const parts = fullText.split(/(?=^\d{2}\/\d{2}\/\d{4};)/m);
    
    for (const part of parts) {
      if (!part.trim()) continue;
      
      // Extract date and rest
      const match = part.match(/^(\d{2}\/\d{2}\/\d{4});(.+)/s);
      if (match) {
        const dateStr = match[1];
        const rest = match[2];
        
        // Parse the transaction
        const tx = this.parseTransaction(dateStr, rest, section.accountNumber);
        if (tx) {
          transactions.push(tx);
        }
      }
    }
    
    return transactions;
  }

  /**
   * Parse a single transaction from date and remaining text
   */
  static parseTransaction(dateStr, rest, accountNumber) {
    // rest contains: "LABEL";DEBIT;CREDIT; possibly with newlines in label
    
    // Find the label (everything in quotes or until first semicolon)
    let label = '';
    let amounts = '';
    
    if (rest.startsWith('"')) {
      // Find closing quote
      const closeQuote = rest.indexOf('";', 1);
      if (closeQuote > 0) {
        label = rest.substring(1, closeQuote);
        amounts = rest.substring(closeQuote + 2);
      } else {
        // No closing quote found, take everything
        label = rest.replace(/"/g, '');
      }
    } else {
      // No quotes, split by semicolon
      const parts = rest.split(';');
      label = parts[0] || '';
      amounts = parts.slice(1).join(';');
    }
    
    // Clean label
    label = label.replace(/\s+/g, ' ').trim();
    
    // Parse amounts
    const amountParts = amounts.split(';');
    const debitStr = amountParts[0] ? amountParts[0].trim() : '';
    const creditStr = amountParts[1] ? amountParts[1].trim() : '';
    
    const debit = this.parseAmount(debitStr);
    const credit = this.parseAmount(creditStr);
    
    // Skip if no valid amount
    if (debit === 0 && credit === 0) return null;
    
    // CA format: debit column has negative amounts, credit column has positive amounts
    // If debit is filled (negative or positive), it's an expense → should be negative
    // If credit is filled, it's income → should be positive
    let amount;
    if (credit !== 0) {
      // Income (credit column)
      amount = Math.abs(credit);
    } else if (debit !== 0) {
      // Expense (debit column) - ensure it's negative
      amount = -Math.abs(debit);
    } else {
      return null;
    }
    
    // Parse date (DD/MM/YYYY → YYYY-MM-DD)
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) return null;
    const date = dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0];
    
    // Simplify label
    const simplifiedLabel = this.simplifyLabel(label);
    
    // Categorize
    const category = categorizeBasic(simplifiedLabel);

    return {
      date,
      label: simplifiedLabel,
      amount,
      category,
      accountNumber
    };
  }

  static parseAmount(str) {
    if (!str) return 0;
    // Handle French format: 1 000,50 or 1000,50
    const cleaned = str.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  static simplifyLabel(label) {
    // Remove extra spaces
    label = label.replace(/\s+/g, ' ').trim();
    
    // Card payment: extract merchant name
    if (label.toUpperCase().includes('PAIEMENT PAR CARTE')) {
      const match = label.match(/X\d+\s+(.+?)(?:\s+\d{2}\/\d{2}|$)/i);
      if (match) {
        return 'CB ' + match[1].trim();
      }
      return 'Paiement carte';
    }
    
    // Transfer sent
    if (label.toUpperCase().includes('VIREMENT EMIS') || label.toUpperCase().includes('VIR INST vers')) {
      const match = label.match(/vers\s+(.+?)(?:\s{2,}|$)/i);
      if (match) {
        let dest = match[1].trim().substring(0, 25);
        return 'Virement vers ' + dest;
      }
      return 'Virement émis';
    }
    
    // Transfer received
    if (label.toUpperCase().includes('VIREMENT EN VOTRE FAVEUR') || label.toUpperCase().includes('VIR INST de')) {
      const match = label.match(/de\s+(.+?)(?:\s{2,}|$)/i);
      if (match) {
        let source = match[1].trim().substring(0, 25);
        return 'Virement de ' + source;
      }
      return 'Virement reçu';
    }
    
    // Direct debit
    if (label.toUpperCase().includes('PRELEVEMENT')) {
      const match = label.match(/PRELEVEMENT\s+(.+?)(?:\s{2,}|FR\d|$)/i);
      if (match) {
        return 'Prélèvement ' + match[1].trim().substring(0, 20);
      }
      return 'Prélèvement';
    }
    
    // Interest credit
    if (label.toUpperCase().includes('INTERETS CREDITEURS')) {
      const match = label.match(/TAUX\s+([\d,]+%)/i);
      if (match) {
        return 'Intérêts ' + match[1];
      }
      return 'Intérêts créditeurs';
    }

    // Truncate long labels
    if (label.length > 50) {
      return label.substring(0, 47) + '...';
    }
    
    return label;
  }
}

module.exports = CreditAgricoleParser;

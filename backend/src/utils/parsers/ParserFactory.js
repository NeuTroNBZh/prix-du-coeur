const CreditAgricoleParser = require('./CreditAgricoleParser');
const RevolutParser = require('./RevolutParser');
const CMBCsvParser = require('./CMBCsvParser');

/**
 * Parser Factory - Auto-detects CSV format and returns appropriate parser
 */
class ParserFactory {
  static parsers = [
    RevolutParser,        // Check Revolut first (more specific header)
    CMBCsvParser,         // CMB CSV format
    CreditAgricoleParser, // Crédit Agricole
  ];

  /**
   * Detect which parser can handle the CSV content
   * @param {string} csvContent - Raw CSV content
   * @returns {Object|null} - Parser class or null if no match
   */
  static detectParser(csvContent) {
    for (const parser of this.parsers) {
      if (parser.canParse(csvContent)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Get bank name from CSV content
   * @param {string} csvContent - Raw CSV content
   * @returns {string|null} - Bank identifier or null
   */
  static detectBankName(csvContent) {
    const parser = this.detectParser(csvContent);
    return parser ? parser.getBankName() : null;
  }

  /**
   * Extract accounts from CSV
   * @param {string} csvContent - Raw CSV content
   * @returns {Array} - List of accounts or empty array
   */
  static extractAccounts(csvContent) {
    const parser = this.detectParser(csvContent);
    return parser ? parser.extractAccounts(csvContent) : [];
  }

  /**
   * Parse transactions from CSV
   * @param {string} csvContent - Raw CSV content
   * @param {string} accountFilter - Account number to filter (optional)
   * @returns {Promise<Array>} - List of transactions
   */
  static async parseTransactions(csvContent, accountFilter = null) {
    const parser = this.detectParser(csvContent);
    if (!parser) {
      throw new Error('Unsupported CSV format');
    }
    return parser.parseTransactions(csvContent, accountFilter);
  }
}

module.exports = ParserFactory;

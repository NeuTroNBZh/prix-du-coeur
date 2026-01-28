/**
 * Base Parser Interface for all bank CSV formats
 */
class IParser {
  /**
   * Detect if this parser can handle the CSV content
   * @param {string} csvContent - Raw CSV content
   * @returns {boolean} - True if this parser can handle the format
   */
  static canParse(csvContent) {
    throw new Error('canParse() must be implemented');
  }

  /**
   * Extract available accounts from CSV
   * @param {string} csvContent - Raw CSV content
   * @returns {Array<{type: string, label: string, number: string}>}
   */
  static extractAccounts(csvContent) {
    throw new Error('extractAccounts() must be implemented');
  }

  /**
   * Parse transactions for a specific account
   * @param {string} csvContent - Raw CSV content
   * @param {string} accountFilter - Account number to filter (optional)
   * @returns {Promise<Array<{date, label, amount, category}>>}
   */
  static async parseTransactions(csvContent, accountFilter = null) {
    throw new Error('parseTransactions() must be implemented');
  }

  /**
   * Get bank name identifier
   * @returns {string} - Bank identifier
   */
  static getBankName() {
    throw new Error('getBankName() must be implemented');
  }
}

module.exports = IParser;

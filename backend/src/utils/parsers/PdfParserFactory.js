const { PDFParse } = require('pdf-parse');
const CMBPdfParser = require('./CMBPdfParser');
const CreditAgricolePdfParser = require('./CreditAgricolePdfParser');

/**
 * PDF Parser Factory - Auto-detects bank and returns appropriate parser
 */
class PdfParserFactory {
  static pdfParsers = [
    CreditAgricolePdfParser, // Check CA first (more specific indicators)
    CMBPdfParser,            // Crédit Mutuel de Bretagne
  ];

  /**
   * Extract text from PDF buffer
   * @param {Buffer} pdfBuffer - Raw PDF buffer
   * @returns {Promise<string>} - Extracted text
   */
  static async extractText(pdfBuffer) {
    const parser = new PDFParse({ data: pdfBuffer, verbosity: 0 });
    const textResult = await parser.getText();
    return textResult.text;
  }

  /**
   * Detect which parser can handle the PDF content
   * @param {string} pdfText - Extracted PDF text
   * @returns {Object|null} - Parser class or null if no match
   */
  static detectParser(pdfText) {
    for (const parser of this.pdfParsers) {
      if (parser.canParse(pdfText)) {
        console.log(`📄 PDF detected as: ${parser.getDisplayName()}`);
        return parser;
      }
    }
    return null;
  }

  /**
   * Parse PDF and return transactions
   * @param {Buffer} pdfBuffer - Raw PDF buffer
   * @returns {Promise<Object>} - Parsing result
   */
  static async parsePdf(pdfBuffer) {
    try {
      // First extract text to detect bank
      const pdfText = await this.extractText(pdfBuffer);
      console.log('📄 PDF: Extracted', pdfText.length, 'characters');
      console.log('📄 PDF: Preview:', pdfText.substring(0, 300));

      // Detect appropriate parser
      const Parser = this.detectParser(pdfText);
      
      if (!Parser) {
        // List supported banks
        const supportedBanks = this.pdfParsers.map(p => p.getDisplayName()).join(', ');
        return {
          success: false,
          error: `Format PDF non reconnu. Banques supportées: ${supportedBanks}`
        };
      }

      // Use detected parser
      return await Parser.parsePdf(pdfBuffer);
    } catch (error) {
      console.error('PDF parsing factory error:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'analyse du PDF'
      };
    }
  }

  /**
   * Get list of supported banks
   * @returns {Array} - List of supported bank names
   */
  static getSupportedBanks() {
    return this.pdfParsers.map(p => ({
      id: p.getBankName(),
      name: p.getDisplayName()
    }));
  }
}

module.exports = PdfParserFactory;

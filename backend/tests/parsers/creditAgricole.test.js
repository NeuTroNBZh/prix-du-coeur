const CreditAgricoleParser = require('../../src/utils/parsers/CreditAgricoleParser');
const ParserFactory = require('../../src/utils/parsers/ParserFactory');
const fs = require('fs');
const path = require('path');

describe('Crédit Agricole Parser', () => {
  let sampleCSV;

  beforeAll(() => {
    const filePath = path.join(__dirname, '../fixtures/ca-sample.csv');
    sampleCSV = fs.readFileSync(filePath, 'utf-8');
  });

  describe('Format Detection', () => {
    test('should detect CA format', () => {
      expect(CreditAgricoleParser.canParse(sampleCSV)).toBe(true);
    });

    test('should return correct bank name', () => {
      expect(CreditAgricoleParser.getBankName()).toBe('credit_agricole');
    });

    test('ParserFactory should detect CA', () => {
      expect(ParserFactory.detectBankName(sampleCSV)).toBe('credit_agricole');
    });
  });

  describe('Account Extraction', () => {
    test('should extract account from CSV', () => {
      const accounts = CreditAgricoleParser.extractAccounts(sampleCSV);
      
      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts[0]).toHaveProperty('type');
      expect(accounts[0]).toHaveProperty('label');
      expect(accounts[0]).toHaveProperty('number');
      expect(accounts[0]).toHaveProperty('maskedNumber');
    });

    test('should extract Compte de Dépôt', () => {
      const accounts = CreditAgricoleParser.extractAccounts(sampleCSV);
      const checking = accounts.find(a => a.type === 'checking');
      
      expect(checking).toBeDefined();
      expect(checking.number).toBe('46330633875');
      expect(checking.maskedNumber).toBe('***3875');
    });
  });

  describe('Transaction Parsing', () => {
    test('should parse transactions correctly', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
      
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions[0]).toHaveProperty('date');
      expect(transactions[0]).toHaveProperty('label');
      expect(transactions[0]).toHaveProperty('amount');
      expect(transactions[0]).toHaveProperty('category');
    });

    test('should parse debit as negative amount', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
      const debit = transactions.find(t => t.label.includes('APPLE.COM'));
      
      expect(debit).toBeDefined();
      expect(debit.amount).toBe(-5.99);
    });

    test('should parse credit as positive amount', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
      const credit = transactions.find(t => t.label.includes('Revolut'));
      
      expect(credit).toBeDefined();
      expect(credit.amount).toBe(550.00);
    });

    test('should convert date format correctly', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
      
      expect(transactions[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should categorize transactions', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
      
      const carte = transactions.find(t => t.label.includes('APPLE.COM'));
      expect(carte.category).toBe('Dépense');

      const prelevement = transactions.find(t => t.label.includes('Free Telecom'));
      expect(prelevement.category).toBe('Abonnement');

      const virement = transactions.find(t => t.label.includes('VIREMENT EN VOTRE FAVEUR'));
      expect(virement.category).toBe('Transfert Entrant');
    });

    test('should handle multiline labels', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
      const multiline = transactions.find(t => t.label.includes('Revolut'));
      
      expect(multiline).toBeDefined();
      expect(multiline.label).toContain('Envoye depuis Revolut');
    });

    test('should filter by account number', async () => {
      const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV, '46330633875');
      
      expect(transactions.length).toBeGreaterThan(0);
      transactions.forEach(tx => {
        expect(tx.accountNumber).toBe('46330633875');
      });
    });
  });
});

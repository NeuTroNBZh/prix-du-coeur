const RevolutParser = require('../../src/utils/parsers/RevolutParser');
const ParserFactory = require('../../src/utils/parsers/ParserFactory');

describe('Revolut Parser', () => {
  const sampleCSV = `Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
Paiement par carte,Valeur actuelle,2025-12-29 14:49:59,2026-01-01 03:34:22,Steam,-10.00,0.00,EUR,TERMINÉ,43.28
Paiement par carte,Valeur actuelle,2025-12-31 21:16:21,2026-01-01 10:59:46,Uber Eats,-23.84,0.00,EUR,TERMINÉ,19.44
Ajout de fonds,Valeur actuelle,2026-01-01 18:49:45,2026-01-01 18:49:45,Paiement envoyé par M. CERCLE CHEMINEL LOUIS,50.00,0.00,EUR,TERMINÉ,69.44
Changes,Valeur actuelle,2026-01-01 18:50:11,2026-01-01 18:50:11,Transfer to Revolut Digital Assets Europe Ltd,-0.38,0.00,EUR,TERMINÉ,69.06
Paiement par carte,Valeur actuelle,2025-12-30 19:19:11,2026-01-02 03:10:14,BlaBlaCar,-18.19,0.00,EUR,TERMINÉ,50.87
Remboursement sur carte,Valeur actuelle,2026-01-02 01:00:00,2026-01-02 10:22:22,Uber Eats,13.78,0.00,EUR,TERMINÉ,64.65
Virement,Valeur actuelle,2026-01-10 12:53:27,2026-01-10 12:53:27,Virement à : INES MARCELLE SOPHIE BADIER,-13.90,0.00,EUR,TERMINÉ,142.62`;

  describe('Format Detection', () => {
    test('should detect Revolut format', () => {
      expect(RevolutParser.canParse(sampleCSV)).toBe(true);
    });

    test('should return correct bank name', () => {
      expect(RevolutParser.getBankName()).toBe('revolut');
    });

    test('ParserFactory should detect Revolut', () => {
      expect(ParserFactory.detectBankName(sampleCSV)).toBe('revolut');
    });

    test('should not detect non-Revolut format', () => {
      const nonRevolutCSV = 'Date;Libellé;Débit euros;Crédit euros;\n01/01/2024;Test;10.00;';
      expect(RevolutParser.canParse(nonRevolutCSV)).toBe(false);
    });
  });

  describe('Account Extraction', () => {
    test('should extract account from Produit column', () => {
      const accounts = RevolutParser.extractAccounts(sampleCSV);
      
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toEqual({
        type: 'Compte Revolut',
        label: 'Valeur actuelle',
        number: 'Valeur actuelle'
      });
    });

    test('should handle multiple product types', () => {
      const multiAccountCSV = `Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
Paiement par carte,Valeur actuelle,2026-01-01 10:00:00,2026-01-01 10:00:01,Test1,-10.00,0.00,EUR,TERMINÉ,100.00
Paiement par carte,Carte de crédit,2026-01-01 11:00:00,2026-01-01 11:00:01,Test2,-20.00,0.00,EUR,TERMINÉ,80.00`;
      
      const accounts = RevolutParser.extractAccounts(multiAccountCSV);
      expect(accounts).toHaveLength(2);
      expect(accounts.map(a => a.label)).toContain('Valeur actuelle');
      expect(accounts.map(a => a.label)).toContain('Carte de crédit');
    });
  });

  describe('Transaction Parsing', () => {
    test('should parse all valid transactions', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      
      // Should exclude "Changes" transactions
      expect(transactions).toHaveLength(6);
    });

    test('should parse card payment correctly', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      const steamTx = transactions.find(t => t.label.includes('Steam'));
      
      expect(steamTx).toBeDefined();
      expect(steamTx.date).toBe('2026-01-01');
      expect(steamTx.amount).toBe(-10);
      expect(steamTx.label).toBe('Achat: Steam');
      expect(steamTx.accountNumber).toBe('Valeur actuelle');
      expect(steamTx.currency).toBe('EUR');
    });

    test('should parse fund addition correctly', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      const fundTx = transactions.find(t => t.label.includes('CERCLE CHEMINEL'));
      
      expect(fundTx).toBeDefined();
      expect(fundTx.amount).toBe(50);
      expect(fundTx.label).toContain('Virement reçu:');
    });

    test('should parse transfer correctly', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      const transferTx = transactions.find(t => t.label.includes('INES MARCELLE'));
      
      expect(transferTx).toBeDefined();
      expect(transferTx.amount).toBe(-13.90);
      expect(transferTx.label).toContain('Virement:');
    });

    test('should parse refund correctly', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      const refundTx = transactions.find(t => t.type === 'Remboursement sur carte');
      
      expect(refundTx).toBeDefined();
      expect(refundTx.amount).toBe(13.78);
      expect(refundTx.label).toContain('Remboursement:');
    });

    test('should exclude Changes transactions', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      const changeTx = transactions.find(t => t.label.includes('Digital Assets'));
      
      expect(changeTx).toBeUndefined();
    });

    test('should filter by account when specified', async () => {
      const multiAccountCSV = `Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
Paiement par carte,Valeur actuelle,2026-01-01 10:00:00,2026-01-01 10:00:01,Test1,-10.00,0.00,EUR,TERMINÉ,100.00
Paiement par carte,Carte de crédit,2026-01-01 11:00:00,2026-01-01 11:00:01,Test2,-20.00,0.00,EUR,TERMINÉ,80.00`;
      
      const transactions = await RevolutParser.parseTransactions(multiAccountCSV, 'Valeur actuelle');
      
      expect(transactions).toHaveLength(1);
      expect(transactions[0].label).toContain('Test1');
    });

    test('should handle date format correctly', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      
      // Check that all dates are in YYYY-MM-DD format (PostgreSQL compatible)
      transactions.forEach(tx => {
        expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    test('should calculate totals correctly', async () => {
      const transactions = await RevolutParser.parseTransactions(sampleCSV);
      
      const totalCredit = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalDebit = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Credits: +50.00 (funds) + +13.78 (refund) = 63.78
      expect(totalCredit).toBeCloseTo(63.78, 2);
      // Debits: -10.00 (Steam) -23.84 (Uber) -18.19 (BlaBlaCar) -13.90 (virement) = -65.93
      expect(totalDebit).toBeCloseTo(-65.93, 2);
    });

    test('should skip non-TERMINÉ transactions', async () => {
      const pendingCSV = `Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
Paiement par carte,Valeur actuelle,2026-01-01 10:00:00,2026-01-01 10:00:01,Test,-10.00,0.00,EUR,EN ATTENTE,100.00`;
      
      const transactions = await RevolutParser.parseTransactions(pendingCSV);
      expect(transactions).toHaveLength(0);
    });
  });

  describe('CSV Line Parsing', () => {
    test('should handle quoted fields with commas', () => {
      const line = 'Paiement par carte,Valeur actuelle,2026-01-01 10:00:00,2026-01-01 10:00:01,"Test, with comma",-10.00,0.00,EUR,TERMINÉ,100.00';
      const cols = RevolutParser.parseCSVLine(line);
      
      expect(cols[4]).toBe('Test, with comma');
    });

    test('should handle simple fields', () => {
      const line = 'Type,Produit,2026-01-01,2026-01-01,Description,10.00,0.00,EUR,TERMINÉ,100.00';
      const cols = RevolutParser.parseCSVLine(line);
      
      expect(cols).toHaveLength(10);
      expect(cols[0]).toBe('Type');
      expect(cols[5]).toBe('10.00');
    });
  });
});

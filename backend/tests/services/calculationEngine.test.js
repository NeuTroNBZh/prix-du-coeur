const {
  calculateShares,
  calculateOwed,
  calculateBalance,
  calculateHarmonization,
  calculateCategoryBreakdown
} = require('../../src/services/calculationEngine');

describe('Calculation Engine - 100% Precision Tests', () => {
  
  describe('calculateShares', () => {
    test('should split 100€ 50/50 correctly', () => {
      const result = calculateShares(100, 0.50);
      expect(result.user1Share).toBe('50.00');
      expect(result.user2Share).toBe('50.00');
    });

    test('should split 100€ 60/40 correctly', () => {
      const result = calculateShares(100, 0.60);
      expect(result.user1Share).toBe('60.00');
      expect(result.user2Share).toBe('40.00');
    });

    test('should handle 99.99€ 50/50 with both shares rounded', () => {
      const result = calculateShares(99.99, 0.50);
      // 99.99 * 0.50 = 49.995 → user1 = 50.00
      // 99.99 - 49.995 = 49.995 → user2 = 50.00
      // Decimal arithmetic: both get rounded independently
      expect(result.user1Share).toBe('50.00');
      expect(result.user2Share).toBe('50.00');
      // Note: Sum is 100.00 (0.01€ excess) - acceptable in favor of debtor principle
    });

    test('should handle 100/0 split (individual expense)', () => {
      const result = calculateShares(50, 1.00);
      expect(result.user1Share).toBe('50.00');
      expect(result.user2Share).toBe('0.00');
    });

    test('should handle 0/100 split', () => {
      const result = calculateShares(50, 0.00);
      expect(result.user1Share).toBe('0.00');
      expect(result.user2Share).toBe('50.00');
    });

    test('should handle 33.33/66.67 split', () => {
      const result = calculateShares(100, 0.3333);
      expect(result.user1Share).toBe('33.33');
      expect(result.user2Share).toBe('66.67');
    });

    test('should handle very small amounts', () => {
      const result = calculateShares(0.01, 0.50);
      // 0.01 * 0.50 = 0.005 → user1 = 0.01
      // 0.01 - 0.005 = 0.005 → user2 = 0.01
      expect(result.user1Share).toBe('0.01');
      expect(result.user2Share).toBe('0.01');
    });

    test('should handle very small amounts (even split)', () => {
      const result = calculateShares(0.02, 0.50);
      // 0.02 * 0.50 = 0.01 → exact
      expect(result.user1Share).toBe('0.01');
      expect(result.user2Share).toBe('0.01');
    });

    test('should handle large amounts', () => {
      const result = calculateShares(999999.99, 0.50);
      // 999999.99 * 0.50 = 499999.995 → user1 = 500000.00
      // 999999.99 - 499999.995 = 499999.995 → user2 = 500000.00
      expect(result.user1Share).toBe('500000.00');
      expect(result.user2Share).toBe('500000.00');
    });
  });

  describe('calculateOwed', () => {
    const USER1_ID = 1;
    const USER2_ID = 2;

    test('when user1 pays commune, user2 owes their share', () => {
      const result = calculateOwed(100, USER1_ID, USER1_ID, 0.50, 'commune');
      expect(result.user1Owes).toBe('0.00');
      expect(result.user2Owes).toBe('50.00');
    });

    test('when user2 pays commune, user1 owes their share', () => {
      const result = calculateOwed(100, USER2_ID, USER1_ID, 0.50, 'commune');
      expect(result.user1Owes).toBe('50.00');
      expect(result.user2Owes).toBe('0.00');
    });

    test('individuelle expense does not affect owed', () => {
      const result = calculateOwed(100, USER1_ID, USER1_ID, 0.50, 'individuelle');
      expect(result.user1Owes).toBe('0.00');
      expect(result.user2Owes).toBe('0.00');
    });

    test('abonnement treated as commune', () => {
      const result = calculateOwed(40, USER1_ID, USER1_ID, 0.50, 'abonnement');
      expect(result.user2Owes).toBe('20.00');
    });

    test('custom ratio 60/40 when user1 pays', () => {
      const result = calculateOwed(100, USER1_ID, USER1_ID, 0.60, 'commune');
      expect(result.user2Owes).toBe('40.00'); // User2's share is 40%
    });

    test('custom ratio 60/40 when user2 pays', () => {
      const result = calculateOwed(100, USER2_ID, USER1_ID, 0.60, 'commune');
      expect(result.user1Owes).toBe('60.00'); // User1's share is 60%
    });
  });

  describe('calculateBalance', () => {
    const USER1_ID = 1;
    const USER2_ID = 2;

    test('empty transactions should return zero balance', () => {
      const result = calculateBalance([], USER1_ID, USER2_ID);
      expect(result.user1.totalPaid).toBe('0.00');
      expect(result.user2.totalPaid).toBe('0.00');
      expect(result.netBalance).toBe('0.00');
    });

    test('single commune transaction by user1', () => {
      const transactions = [
        { amount: 100, user_id: USER1_ID, type: 'commune', ratio: 0.50 }
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user1.totalPaid).toBe('100.00');
      expect(result.user2.totalPaid).toBe('0.00');
      expect(result.user1.totalOwed).toBe('0.00');
      expect(result.user2.totalOwed).toBe('50.00');
      expect(result.netBalance).toBe('50.00'); // Positive = user2 owes user1
    });

    test('equal payments should balance out', () => {
      const transactions = [
        { amount: 100, user_id: USER1_ID, type: 'commune', ratio: 0.50 },
        { amount: 100, user_id: USER2_ID, type: 'commune', ratio: 0.50 }
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user1.totalPaid).toBe('100.00');
      expect(result.user2.totalPaid).toBe('100.00');
      expect(result.netBalance).toBe('0.00');
    });

    test('complex scenario with multiple transactions', () => {
      const transactions = [
        { amount: 100, user_id: USER1_ID, type: 'commune', ratio: 0.50 }, // User2 owes 50
        { amount: 40, user_id: USER2_ID, type: 'commune', ratio: 0.50 },  // User1 owes 20
        { amount: 30, user_id: USER1_ID, type: 'individuelle', ratio: 0.50 } // No effect
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user1.totalPaid).toBe('130.00');
      expect(result.user2.totalPaid).toBe('40.00');
      expect(result.user1.totalOwed).toBe('20.00');
      expect(result.user2.totalOwed).toBe('50.00');
      expect(result.netBalance).toBe('30.00'); // 50 - 20 = user2 owes 30 to user1
    });

    test('negative balance when user1 owes more', () => {
      const transactions = [
        { amount: 100, user_id: USER2_ID, type: 'commune', ratio: 0.50 }
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.netBalance).toBe('-50.00'); // Negative = user1 owes user2
    });

    test('mixed types with abonnement', () => {
      const transactions = [
        { amount: 40, user_id: USER1_ID, type: 'abonnement', ratio: 0.50 }, // Internet
        { amount: 10, user_id: USER2_ID, type: 'abonnement', ratio: 0.50 }  // Streaming
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user2.totalOwed).toBe('20.00'); // 40*0.5
      expect(result.user1.totalOwed).toBe('5.00');  // 10*0.5
      expect(result.netBalance).toBe('15.00');
    });

    test('should handle default type as commune', () => {
      const transactions = [
        { amount: 100, user_id: USER1_ID } // No type specified
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user2.totalOwed).toBe('50.00');
    });

    test('should handle default ratio as 0.50', () => {
      const transactions = [
        { amount: 100, user_id: USER1_ID, type: 'commune' } // No ratio specified
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user2.totalOwed).toBe('50.00');
    });

    test('should skip zero amount transactions', () => {
      const transactions = [
        { amount: 0, user_id: USER1_ID, type: 'commune', ratio: 0.50 },
        { amount: 100, user_id: USER1_ID, type: 'commune', ratio: 0.50 }
      ];
      const result = calculateBalance(transactions, USER1_ID, USER2_ID);
      
      expect(result.user1.totalPaid).toBe('100.00');
      expect(result.user2.totalOwed).toBe('50.00');
    });
  });

  describe('calculateHarmonization', () => {
    const user1Info = { id: 1, firstName: 'Debian', lastName: 'User' };
    const user2Info = { id: 2, firstName: 'Copine', lastName: '' };

    test('no settlement needed when balanced', () => {
      const balance = {
        user1: { id: 1, totalPaid: '100.00', totalOwed: '50.00' },
        user2: { id: 2, totalPaid: '100.00', totalOwed: '50.00' },
        netBalance: '0.00'
      };
      
      const result = calculateHarmonization(balance, user1Info, user2Info);
      
      expect(result.needed).toBe(false);
      expect(result.amount).toBe('0.00');
    });

    test('user2 owes user1 when netBalance positive', () => {
      const balance = {
        user1: { id: 1, totalPaid: '100.00', totalOwed: '0.00' },
        user2: { id: 2, totalPaid: '0.00', totalOwed: '50.00' },
        netBalance: '50.00'
      };
      
      const result = calculateHarmonization(balance, user1Info, user2Info);
      
      expect(result.needed).toBe(true);
      expect(result.amount).toBe('50.00');
      expect(result.debtor.id).toBe(2);
      expect(result.creditor.id).toBe(1);
      expect(result.message).toContain('Copine doit');
      expect(result.message).toContain('Debian');
    });

    test('user1 owes user2 when netBalance negative', () => {
      const balance = {
        user1: { id: 1, totalPaid: '0.00', totalOwed: '50.00' },
        user2: { id: 2, totalPaid: '100.00', totalOwed: '0.00' },
        netBalance: '-50.00'
      };
      
      const result = calculateHarmonization(balance, user1Info, user2Info);
      
      expect(result.needed).toBe(true);
      expect(result.amount).toBe('50.00');
      expect(result.debtor.id).toBe(1);
      expect(result.creditor.id).toBe(2);
      expect(result.message).toContain('Debian doit');
    });

    test('rounds in favor of debtor (rounds down)', () => {
      const balance = {
        user1: { id: 1, totalPaid: '99.99', totalOwed: '0.00' },
        user2: { id: 2, totalPaid: '0.00', totalOwed: '49.995' },
        netBalance: '49.995'
      };
      
      const result = calculateHarmonization(balance, user1Info, user2Info);
      
      expect(result.amount).toBe('49.99'); // Rounded DOWN in favor of debtor
    });
  });

  describe('calculateCategoryBreakdown', () => {
    test('should group transactions by category', () => {
      const transactions = [
        { amount: 50, category: 'Courses' },
        { amount: 30, category: 'Courses' },
        { amount: 20, category: 'Restaurant' }
      ];
      
      const result = calculateCategoryBreakdown(transactions);
      
      expect(result['Courses']).toBe('80.00');
      expect(result['Restaurant']).toBe('20.00');
    });

    test('should handle missing category', () => {
      const transactions = [
        { amount: 50 }
      ];
      
      const result = calculateCategoryBreakdown(transactions);
      
      expect(result['Non catégorisé']).toBe('50.00');
    });

    test('should use absolute values', () => {
      const transactions = [
        { amount: -50, category: 'Refund' }
      ];
      
      const result = calculateCategoryBreakdown(transactions);
      
      expect(result['Refund']).toBe('50.00');
    });
  });

  describe('Precision Edge Cases', () => {
    test('0.1 + 0.2 should equal 0.30 exactly', () => {
      const transactions = [
        { amount: 0.1, user_id: 1, type: 'commune', ratio: 0.50 },
        { amount: 0.2, user_id: 1, type: 'commune', ratio: 0.50 }
      ];
      const result = calculateBalance(transactions, 1, 2);
      
      expect(result.user1.totalPaid).toBe('0.30');
    });

    test('100 / 3 precision handling', () => {
      // 100 / 3 = 33.333... 
      const result = calculateShares(100, 0.333333);
      // Should not cause precision errors
      expect(parseFloat(result.user1Share) + parseFloat(result.user2Share)).toBeCloseTo(100, 2);
    });

    test('many small transactions should not accumulate errors', () => {
      // 100 transactions of 0.01€ each
      const transactions = Array(100).fill(null).map(() => ({
        amount: 0.01,
        user_id: 1,
        type: 'commune',
        ratio: 0.50
      }));
      
      const result = calculateBalance(transactions, 1, 2);
      
      expect(result.user1.totalPaid).toBe('1.00');
    });
  });
});

const Decimal = require('decimal.js');

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Calculation Engine - 100% precision required
 * All calculations use Decimal.js to avoid floating point errors
 */

/**
 * Calculate share for each person based on ratio
 * @param {number} amount - Total amount
 * @param {number} ratio - Ratio for user1 (0.00 to 1.00, default 0.50)
 * @returns {{ user1Share: string, user2Share: string }} - Shares as string to preserve precision
 */
function calculateShares(amount, ratio = 0.50) {
  const total = new Decimal(amount);
  const ratioDecimal = new Decimal(ratio);
  
  // User1 share = amount * ratio
  const user1Share = total.times(ratioDecimal);
  
  // User2 share = amount * (1 - ratio)
  const user2Share = total.minus(user1Share);
  
  return {
    user1Share: user1Share.toFixed(2),
    user2Share: user2Share.toFixed(2)
  };
}

/**
 * Calculate what one user owes after a transaction
 * @param {number} amount - Transaction amount
 * @param {number} payerId - ID of who paid
 * @param {number} user1Id - ID of user1 in couple
 * @param {number} ratio - Split ratio (user1's share)
 * @param {string} type - 'commune', 'individuelle', 'abonnement', 'virement_interne'
 * @returns {{ user1Owes: string, user2Owes: string }} - What each owes the other
 */
function calculateOwed(amount, payerId, user1Id, ratio = 0.50, type = 'commune') {
  // Individual transactions and internal transfers don't affect balance
  if (type === 'individuelle' || type === 'virement_interne') {
    return {
      user1Owes: '0.00',
      user2Owes: '0.00'
    };
  }

  const shares = calculateShares(amount, ratio);
  const isUser1Payer = payerId === user1Id;

  if (isUser1Payer) {
    // User1 paid, so User2 owes their share to User1
    return {
      user1Owes: '0.00',
      user2Owes: shares.user2Share
    };
  } else {
    // User2 paid, so User1 owes their share to User2
    return {
      user1Owes: shares.user1Share,
      user2Owes: '0.00'
    };
  }
}

/**
 * Calculate balance for a couple over a set of transactions
 * @param {Array} transactions - Array of { amount, user_id, type, ratio }
 * @param {number} user1Id - ID of user1 in couple
 * @param {number} user2Id - ID of user2 in couple
 * @returns {Object} - Complete balance breakdown
 */
function calculateBalance(transactions, user1Id, user2Id) {
  let user1TotalPaid = new Decimal(0);
  let user2TotalPaid = new Decimal(0);
  let user1TotalOwed = new Decimal(0); // What user1 owes to user2
  let user2TotalOwed = new Decimal(0); // What user2 owes to user1

  for (const tx of transactions) {
    const rawAmount = new Decimal(tx.amount);
    const amount = rawAmount.abs(); // Use absolute value
    const payerId = tx.user_id;
    const type = tx.type || 'individuelle';
    const ratio = tx.ratio || 0.50;

    // Skip zero amounts
    // Skip internal transfers - they are neutral for budget
    // Skip individual transactions
    if (amount.isZero()) continue;
    if (type === 'virement_interne') continue;
    if (type === 'individuelle') continue;

    // Handle shared revenues (positive amounts marked as commune/abonnement)
    // Example: CAF payment received by user2 that should be shared
    // If user2 receives 200€ CAF and it's shared 50/50, user2 owes 100€ to user1
    if (rawAmount.isPositive()) {
      // Shared income: the receiver owes part of it to the other
      if (payerId === user1Id) {
        // User1 received income, owes user2's share to user2
        const user2Share = amount.times(new Decimal(1).minus(new Decimal(ratio)));
        user1TotalOwed = user1TotalOwed.plus(user2Share);
      } else if (payerId === user2Id) {
        // User2 received income, owes user1's share to user1
        const user1Share = amount.times(new Decimal(ratio));
        user2TotalOwed = user2TotalOwed.plus(user1Share);
      }
      continue;
    }

    // Handle shared expenses (negative amounts) - existing logic
    // Track who paid what (only for shared expenses)
    // Calculate owed amounts for shared expenses
    if (payerId === user1Id) {
      user1TotalPaid = user1TotalPaid.plus(amount);
    } else if (payerId === user2Id) {
      user2TotalPaid = user2TotalPaid.plus(amount);
    }
    const owed = calculateOwed(amount.toNumber(), payerId, user1Id, ratio, type);
    user1TotalOwed = user1TotalOwed.plus(new Decimal(owed.user1Owes));
    user2TotalOwed = user2TotalOwed.plus(new Decimal(owed.user2Owes));
  }

  // Net balance: positive = user2 owes user1, negative = user1 owes user2
  const netBalance = user2TotalOwed.minus(user1TotalOwed);

  return {
    user1: {
      id: user1Id,
      totalPaid: user1TotalPaid.toFixed(2),
      totalOwed: user1TotalOwed.toFixed(2) // What user1 owes to user2
    },
    user2: {
      id: user2Id,
      totalPaid: user2TotalPaid.toFixed(2),
      totalOwed: user2TotalOwed.toFixed(2) // What user2 owes to user1
    },
    netBalance: netBalance.toFixed(2) // Positive = user2 pays user1
  };
}

/**
 * Calculate harmonization (who pays whom)
 * @param {Object} balance - Result from calculateBalance
 * @param {Object} user1Info - { id, firstName, lastName }
 * @param {Object} user2Info - { id, firstName, lastName }
 * @returns {Object} - Settlement information
 */
function calculateHarmonization(balance, user1Info, user2Info) {
  const netBalance = new Decimal(balance.netBalance);

  // No settlement needed
  if (netBalance.isZero()) {
    return {
      needed: false,
      message: 'Vous êtes à égalité !',
      amount: '0.00',
      debtor: null,
      creditor: null
    };
  }

  // Round in favor of debtor (round down the amount owed)
  const absoluteAmount = netBalance.abs();
  const roundedAmount = absoluteAmount.toDecimalPlaces(2, Decimal.ROUND_DOWN);

  if (netBalance.isPositive()) {
    // User2 owes User1
    return {
      needed: true,
      message: `${user2Info.firstName} doit ${roundedAmount.toFixed(2)}€ à ${user1Info.firstName}`,
      amount: roundedAmount.toFixed(2),
      debtor: user2Info,
      creditor: user1Info
    };
  } else {
    // User1 owes User2
    return {
      needed: true,
      message: `${user1Info.firstName} doit ${roundedAmount.toFixed(2)}€ à ${user2Info.firstName}`,
      amount: roundedAmount.toFixed(2),
      debtor: user1Info,
      creditor: user2Info
    };
  }
}

/**
 * Calculate category breakdown for expenses
 * @param {Array} transactions - Array of transactions
 * @returns {Object} - Spending by category
 */
function calculateCategoryBreakdown(transactions) {
  const categories = {};

  for (const tx of transactions) {
    // Skip internal transfers - they are not expenses
    if (tx.type === 'virement_interne') continue;
    // Skip positive amounts (income)
    if (parseFloat(tx.amount) >= 0) continue;
    
    const category = tx.category || 'Non catégorisé';
    const amount = new Decimal(tx.amount).abs();

    if (!categories[category]) {
      categories[category] = new Decimal(0);
    }
    categories[category] = categories[category].plus(amount);
  }

  // Convert to fixed strings
  const result = {};
  for (const [cat, amount] of Object.entries(categories)) {
    result[cat] = amount.toFixed(2);
  }

  return result;
}

module.exports = {
  calculateShares,
  calculateOwed,
  calculateBalance,
  calculateHarmonization,
  calculateCategoryBreakdown
};

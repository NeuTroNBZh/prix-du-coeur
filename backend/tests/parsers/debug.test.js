const CreditAgricoleParser = require('../../src/utils/parsers/CreditAgricoleParser');
const fs = require('fs');
const path = require('path');

describe('CA Parser Debug', () => {
  test('should debug parsing', async () => {
    const filePath = path.join(__dirname, '../fixtures/ca-sample.csv');
    const sampleCSV = fs.readFileSync(filePath, 'utf-8');
    
    console.log('=== CSV Content ===');
    console.log(sampleCSV.substring(0, 500));
    console.log('=== Lines ===');
    const lines = sampleCSV.split('\n');
    lines.slice(0, 15).forEach((line, i) => {
      console.log(`Line ${i}: "${line}"`);
    });
    
    const transactions = await CreditAgricoleParser.parseTransactions(sampleCSV);
    console.log('=== Parsed Transactions ===');
    console.log(JSON.stringify(transactions, null, 2));
    
    expect(true).toBe(true);
  });
});

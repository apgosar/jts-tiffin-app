const fs = require('fs');
const path = require('path');

describe('Firestore Query Static Analysis', () => {
  it('should not contain chained .where() queries mixing equality and inequality without explicit indices', () => {
    const serverJsPath = path.join(__dirname, '../../server.js');
    const serverCode = fs.readFileSync(serverJsPath, 'utf8');

    // Extract all db.collection()....get() blocks
    const queryRegex = /db\.collection\([\s\S]*?\.get\(\)/g;
    const queries = serverCode.match(queryRegex) || [];

    queries.forEach(query => {
      // Find all .where() clauses in this query
      const whereRegex = /\.where\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)/g;
      const wheres = [...query.matchAll(whereRegex)];

      if (wheres.length > 1) {
        let hasEquality = false;
        let hasInequality = false;

        wheres.forEach(w => {
          const operator = w[2];
          if (operator === '==') {
            hasEquality = true;
          } else if (['<', '<=', '!=', 'not-in', '>', '>='].includes(operator)) {
            hasInequality = true;
          }
        });

        if (hasEquality && hasInequality) {
          throw new Error(
            `Firestore Composite Index requirement detected!\n` +
            `Query: ${query.trim().split('\n').map(l => l.trim()).join(' ')}\n` +
            `Reason: Firestore requires a composite index when mixing equality (==) and inequality (!=, >, <, etc.) filters. ` +
            `To avoid production crashes, either create the composite index in Firebase Console, or filter the inequality in-memory.`
          );
        }
      }
    });
  });
});

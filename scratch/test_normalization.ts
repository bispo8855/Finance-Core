/**
 * Script de teste para validação da normalização de IDs em notação científica.
 */

function normalizeReference(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).trim();
  if (str.toUpperCase().includes('E+') || (typeof val === 'number' && val > 9999999999)) {
    const num = Number(val);
    if (!isNaN(num)) {
       return num.toLocaleString('fullwide', { useGrouping: false });
    }
  }
  return str;
}

const tests = [
  { input: 2.000021654321012e+15, expected: "2000021654321012" },
  { input: "2.00002E+15", expected: "2000020000000000" },
  { input: "ORDER_123", expected: "ORDER_123" },
  { input: 12345, expected: "12345" },
  { input: 10000000001, expected: "10000000001" }
];

console.log("=== Testando Normalização de IDs ===");
let success = 0;
for (const t of tests) {
  const result = normalizeReference(t.input);
  const match = result === t.expected;
  console.log(`${match ? '✅' : '❌'} Input: ${t.input} -> Result: ${result} (Expected: ${t.expected})`);
  if (match) success++;
}

console.log(`\nResultado: ${success}/${tests.length} testes passaram.`);
if (success !== tests.length) process.exit(1);

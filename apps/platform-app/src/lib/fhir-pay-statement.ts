/**
 * Integration fixture imports use a distinct **`FHIR-`** or **`CSV-`** statement
 * prefix (vs seed / production-style numbers like **`STMT-…`**).
 */
export function isFhirFixtureImportStatementNumber(statementNumber: string): boolean {
  const s = statementNumber.trim();
  return /^FHIR-/i.test(s) || /^CSV-/i.test(s);
}

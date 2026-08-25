/**
 * Canonicalizes Swiss Federal Court case numbers to ensure consistent formatting
 * for reliable identity verification. This function normalizes only legitimate
 * typographical variants while strictly preserving semantic identity.
 *
 * Supported input formats:
 * - Standard: "5A_604/2024", "5A 604/2024", "5A.604/2024", "5A-604/2024"
 * - Legacy: "5A.604/2024", "5A-604/2024"
 * - With leading zeros: "5A_00604/2024"
 *
 * Output format: "CHAMBER_SEQUENCE/YEAR" where:
 * - CHAMBER: uppercase letters (e.g., "5A")
 * - SEQUENCE: decimal number without leading zeros (e.g., "604")
 * - YEAR: 4-digit year (e.g., "2024")
 * - SEPARATOR: underscore "_" between chamber and sequence
 *
 * @param rawCaseNumber - The raw case number string to canonicalize
 * @returns Canonicalized case number string, or null if invalid format
 */
export function canonicalizeSwissCaseNumber(rawCaseNumber: string): string | null {
  if (!rawCaseNumber || typeof rawCaseNumber !== "string") {
    return null;
  }

  const trimmed = rawCaseNumber.trim();
  if (!trimmed) {
    return null;
  }

  // Pattern for standard federal case numbers: chamber + separator + sequence + slash + year
  // Chamber: 1-2 digits followed by 1 uppercase letter (e.g., "5A", "10B")
  // Separator: underscore, space, dot, or dash
  // Sequence: one or more digits
  // Year: 4 digits (19xx or 20xx)
  const standardPattern = /^([0-9]{1,2}[A-Z])[._\s-](\d+)\/((?:19|20)\d{2})$/i;
  const match = standardPattern.exec(trimmed);

  if (!match) {
    return null;
  }

  const chamber = match[1];
  const sequence = match[2];
  const year = match[3];

  // Validate chamber format (1-2 digits + 1 uppercase letter)
  if (!chamber || !/^[0-9]{1,2}[A-Z]$/i.test(chamber)) {
    return null;
  }

  // Validate sequence is a positive integer
  if (!sequence) {
    return null;
  }
  const sequenceNum = parseInt(sequence, 10);
  if (isNaN(sequenceNum) || sequenceNum <= 0) {
    return null;
  }

  // Validate year is reasonable (1900-2100)
  if (!year) {
    return null;
  }
  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return null;
  }

  // Construct canonical form: CHAMBER_SEQUENCE/YEAR
  // - Chamber: uppercase
  // - Sequence: no leading zeros
  // - Separator: underscore (consistent choice)
  // - Year: as-is (already validated)
  return `${chamber.toUpperCase()}_${sequenceNum}/${year}`;
}

/**
 * Checks if a string represents a valid Swiss Federal Court case number format.
 *
 * @param potentialCaseNumber - String to validate
 * @returns true if the string matches a valid case number pattern
 */
export function isValidSwissCaseNumberFormat(potentialCaseNumber: string): boolean {
  return canonicalizeSwissCaseNumber(potentialCaseNumber) !== null;
}

/**
 * Compares two case numbers for semantic equality after canonicalization.
 * This should be used instead of direct string comparisons for identity verification.
 *
 * @param caseNumberA - First case number to compare
 * @param caseNumberB - Second case number to compare
 * @returns true if the case numbers represent the same semantic identifier
 */
export function areSwissCaseNumbersEqual(caseNumberA: string, caseNumberB: string): boolean {
  const canonicalA = canonicalizeSwissCaseNumber(caseNumberA);
  const canonicalB = canonicalizeSwissCaseNumber(caseNumberB);

  // If either is invalid, they're not equal (unless both are null/invalid)
  if (canonicalA === null || canonicalB === null) {
    return canonicalA === canonicalB;
  }

  return canonicalA === canonicalB;
}

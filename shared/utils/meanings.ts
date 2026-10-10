const CYRILLIC = /[А-Яа-яЁё]/;

/**
 * Russian fork: meanings hold the Russian translations first and the original
 * English ones after them (so English answers are still accepted). Lists shown
 * to the learner keep only the Russian part when there is one.
 */
export function displayMeanings(meanings: string[]): string[] {
  const russian = meanings.filter(meaning => CYRILLIC.test(meaning));
  return russian.length > 0 ? russian : meanings;
}

export function removeVerbDuplicates(meanings: string[]): string[] {
  const set = new Set(meanings);
  return meanings.filter(m => {
    const match = m.match(/^to\s+(.+)/i);
    return !match || !set.has(match[1]);
  });
}

/**
 * Case/whitespace-insensitive baseline used for reverse (Japanese) answers
 * and as the starting point for meaning answers.
 */
export const normalizeAnswerValue = (value: string): string =>
  value
    .trim()
    .normalize('NFC')
    .toLowerCase()
    // Russian fork: "ё" and "е" are interchangeable when typing answers
    .replace(/ё/g, 'е');

/**
 * A lone English infinitive marker or article is optional. Compound prefixes
 * such as "to the" are preserved because removing both can change meaning
 * (for example, "to the point" is not equivalent to "point").
 */
const OPTIONAL_MEANING_PREFIX =
  /^(?:to(?!\s+(?:the|an|a)\s+)\s+|(?:the|an|a)\s+)/;

/**
 * Meanings in the data use the single ellipsis character ("well then…"),
 * but people type three dots (or more), so every ellipsis spelling is
 * folded to a canonical "..." before comparing.
 */
const ELLIPSIS_VARIANTS = /…|\.{2,}/g;

/**
 * Normalizes an English meaning answer so that optional articles/infinitives
 * and ellipsis spellings are treated as equivalent.
 */
export const normalizeMeaningAnswer = (value: string): string =>
  normalizeAnswerValue(value)
    .replace(ELLIPSIS_VARIANTS, '...')
    .replace(OPTIONAL_MEANING_PREFIX, '');

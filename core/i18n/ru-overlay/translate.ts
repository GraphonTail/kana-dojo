import dictionary from './ru-ui.json';
import { PATTERNS } from './patterns';

const exact = new Map<string, string>(
  Object.entries(dictionary as Record<string, string>),
);

const byLowerCase = new Map<string, string>();
for (const [en, ru] of exact) {
  const key = en.toLowerCase();
  if (!byLowerCase.has(key)) byLowerCase.set(key, ru);
}

/** Repeats the letter case of the original string on the translation. */
function matchCase(source: string, translation: string): string {
  const letters = source.replace(/[^A-Za-z]/g, '');
  if (!letters) return translation;
  if (letters === letters.toUpperCase() && letters.length > 1)
    return translation.toUpperCase();
  const first = source.match(/[A-Za-z]/)?.[0] ?? '';
  if (first === first.toLowerCase()) {
    return translation.charAt(0).toLowerCase() + translation.slice(1);
  }
  return translation.charAt(0).toUpperCase() + translation.slice(1);
}

// One Hepburn-style romaji word: syllables, a syllabic "n", doubled consonants
// (kitte, matcha) and "m" before b/p (shimbun).
const ROMAJI_WORD =
  /^(?:(?:ky|gy|sh|ch|ts|dz|ny|hy|by|py|my|ry|zy|dy|ty|[kgsztdnhbpmyrwfjv])?[aiueoāīūēō]|n|([kstpgzdbjfhc])(?=\1)|t(?=ch)|m(?=[bp]))+$/;

/**
 * Lower-case romaji (kana answers such as "no" or "go", kanji readings such as
 * "mon" or "kanji") must stay as written, even though "No", "Go" or "Mon" are
 * interface words with a translation.
 */
export function isRomaji(text: string): boolean {
  if (text !== text.toLowerCase()) return false;
  const words = text.split(/[\s\-.()'’~]+/).filter(Boolean);
  return words.length > 0 && words.every(word => ROMAJI_WORD.test(word));
}

/**
 * Returns the Russian version of an English interface string, or null when
 * there is none. The input must already be trimmed with collapsed whitespace.
 * With keepRomaji (the default) a lower-case romaji-looking string is only
 * translated on an exact dictionary match.
 */
export function translateText(
  text: string,
  { keepRomaji = true }: { keepRomaji?: boolean } = {},
): string | null {
  const direct = exact.get(text);
  if (direct !== undefined) return direct;
  if (keepRomaji && isRomaji(text)) return null;

  const loose = byLowerCase.get(text.toLowerCase());
  if (loose !== undefined) return matchCase(text, loose);

  for (const [pattern, replacement] of PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    return typeof replacement === 'string'
      ? text.replace(pattern, replacement)
      : replacement(match);
  }
  return null;
}

import type { IVocabObj, VocabLevel } from '@/entities/vocabulary';
import { useVocabCacheStore } from '@/features/Vocabulary/store/useVocabCacheStore';

type RawVocabEntry = {
  jmdict_seq: string;
  kana: string;
  kanji: string;
  waller_definition: string;
};

// Russian fork: /data-vocab-ru/<level>.json maps "jmdict_seq|kana" -> "значение; значение"
// (built from data/ru/vocab-<level>.tsv). Russian meanings go first, English stays after them.
type RuMeanings = Record<string, string>;
const ruRequests: Partial<Record<VocabLevel, Promise<RuMeanings>>> = {};
const loadRuMeanings = (level: VocabLevel): Promise<RuMeanings> =>
  (ruRequests[level] ??= fetch(`/data-vocab-ru/${level}.json`)
    .then(res => (res.ok ? (res.json() as Promise<RuMeanings>) : {}))
    .catch(() => ({})));

const toWordObj = (entry: RawVocabEntry, ru?: string): IVocabObj => {
  const definitionPieces = entry.waller_definition
    .split(/[;,]/)
    .map(piece => piece.trim())
    .filter(Boolean);
  const ruPieces = (ru ?? '')
    .split(';')
    .map(piece => piece.trim())
    .filter(Boolean);

  return {
    word: entry.kanji?.trim() || entry.kana,
    reading: `${entry.kana}`.trim(),
    meanings: [...ruPieces, ...definitionPieces],
  };
};

// Module-level cache - persists across component mounts
const vocabCache: Partial<Record<VocabLevel, IVocabObj[]>> = {};
const pendingRequests: Partial<Record<VocabLevel, Promise<IVocabObj[]>>> = {};

const getCachedLevel = (level: VocabLevel) => {
  const sessionCache = useVocabCacheStore.getState().cachedByLevel[level];
  if (sessionCache) return sessionCache;
  return vocabCache[level];
};

const setCachedLevel = (level: VocabLevel, items: IVocabObj[]) => {
  vocabCache[level] = items;
  useVocabCacheStore.getState().setCachedLevel(level, items);
};

export const vocabDataService = {
  /**
   * Get vocab data for a specific level. Returns cached data if available,
   * otherwise fetches and caches it.
   */
  async getVocabByLevel(level: VocabLevel): Promise<IVocabObj[]> {
    // Return cached data immediately if available
    const cached = getCachedLevel(level);
    if (cached) return cached;

    // If there's already a pending request for this level, wait for it
    if (pendingRequests[level]) {
      return pendingRequests[level];
    }

    // Create new request and store the promise to prevent duplicate fetches
    pendingRequests[level] = Promise.all([
      fetch(`/data-vocab/${level}.json`).then(
        res => res.json() as Promise<RawVocabEntry[]>,
      ),
      loadRuMeanings(level),
    ])
      .then(([data, ru]) => {
        const words = data.map(entry =>
          toWordObj(entry, ru[`${entry.jmdict_seq}|${entry.kana}`]),
        );
        setCachedLevel(level, words);
        delete pendingRequests[level];
        return words;
      })
      .catch(err => {
        delete pendingRequests[level];
        throw err;
      });

    return pendingRequests[level];
  },

  /**
   * Preload all vocab levels in parallel (useful for initial load)
   */
  async preloadAll(): Promise<void> {
    const levels: VocabLevel[] = ['n5', 'n4', 'n3', 'n2', 'n1'];
    await Promise.all(levels.map(level => this.getVocabByLevel(level)));
  },

  /**
   * Check if a level is already cached
   */
  isCached(level: VocabLevel): boolean {
    return !!getCachedLevel(level);
  },

  /**
   * Get all cached data (for components that need all levels)
   */
  getAllCached(): Partial<Record<VocabLevel, IVocabObj[]>> {
    return { ...useVocabCacheStore.getState().cachedByLevel, ...vocabCache };
  },

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    Object.keys(vocabCache).forEach(key => {
      delete vocabCache[key as VocabLevel];
    });
    useVocabCacheStore.getState().clearCache();
  },
};

export type { VocabLevel };

'use client';

/**
 * Russian interface for this fork.
 *
 * Most KanaDojo screens have their English text written directly in the
 * components, so instead of editing hundreds of files this component swaps
 * known English strings for Russian ones right in the page. It only touches
 * text that exactly matches an entry in data/ru/ui.tsv (or a pattern in
 * patterns.ts), so Japanese content and user input are never changed, and the
 * upstream code can be merged without conflicts.
 */
import { useEffect } from 'react';
import { translateText } from './translate';
import { plural } from './patterns';

const ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'CODE',
  'PRE',
]);
const SKIP_SELECTOR =
  '[translate="no"], .notranslate, [contenteditable="true"]';
const HAS_LATIN = /[A-Za-z]/;
const LEADING_PUNCTUATION = /^[.,;:!?)]/;
// Rescans after load: parts of a page can hydrate later than the rest.
const RESCAN_DELAYS_MS = [400, 1200, 3000, 6000];

// React marks every element it owns with an own property "__reactFiber$<id>".
// Server-rendered elements that are not hydrated yet don't have it; changing
// their text would make React's hydration fail, so they wait for a rescan.
let fiberKey: string | undefined;
function isOwnedByReact(element: Element): boolean {
  if (fiberKey) return fiberKey in element;
  const key = Object.keys(element).find(name =>
    name.startsWith('__reactFiber$'),
  );
  if (key) fiberKey = key;
  return Boolean(key);
}

// "+42 points" is rendered as separate text nodes ("+", "42", " points"),
// so the noun takes its Russian plural form from the number just before it.
const COUNTED_NOUNS: Record<string, readonly [string, string, string]> = {
  point: ['очко', 'очка', 'очков'],
  points: ['очко', 'очка', 'очков'],
  // "out of 6 attempts, you answered 2 correctly." in the session stats
  'attempts, you answered': [
    'попытки — верных ответов:',
    'попыток — верных ответов:',
    'попыток — верных ответов:',
  ],
};

function countBefore(node: Text): number | null {
  const previous = node.previousSibling;
  if (!previous || previous.nodeType !== Node.TEXT_NODE) return null;
  const match = previous.nodeValue?.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : null;
}

function translateCountedNoun(node: Text, text: string): string | null {
  const forms = COUNTED_NOUNS[text.toLowerCase()];
  if (!forms) return null;
  const n = countBefore(node);
  if (n === null) return null;
  return plural(n, ...forms);
}

// Words whose Russian depends on where they appear: "On" is the on'yomi label
// next to "Kun" on kanji cards, and a switch state everywhere else.
function translateByContext(node: Text, text: string): string | null {
  if (text !== 'On') return null;
  const around = node.parentElement?.parentElement?.textContent ?? '';
  return /Kun|Кун/.test(around) ? 'Он' : 'Вкл.';
}

// A word inside a sentence ("Please select some kanji first…") is interface
// text; a word alone in its element may be a romaji answer or reading.
function hasTextSiblings(node: Text): boolean {
  const siblings = node.parentNode?.childNodes ?? [];
  for (const sibling of siblings) {
    if (
      sibling !== node &&
      sibling.nodeType === Node.TEXT_NODE &&
      sibling.nodeValue?.trim()
    ) {
      return true;
    }
  }
  return false;
}

function translateTextNode(node: Text) {
  const raw = node.nodeValue;
  if (!raw || !HAS_LATIN.test(raw)) return;
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || !isOwnedByReact(parent))
    return;
  if (parent.closest(SKIP_SELECTOR)) return;

  const match = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return;
  const text = match[2].replace(/\s+/g, ' ');
  const translated =
    translateByContext(node, text) ??
    translateCountedNoun(node, text) ??
    translateText(text, { keepRomaji: !hasTextSiblings(node) });
  if (translated === null || translated === text) return;

  // "…, чтобы" after an interpolated value should not get a space before the comma
  const lead = LEADING_PUNCTUATION.test(translated) ? '' : match[1];
  const next = lead + translated + match[3];
  if (next !== raw) node.nodeValue = next;
}

function translateAttributes(element: Element) {
  if (!isOwnedByReact(element) || element.closest(SKIP_SELECTOR)) return;
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (!value || !HAS_LATIN.test(value)) continue;
    const translated = translateText(value.replace(/\s+/g, ' ').trim());
    if (translated !== null && translated !== value)
      element.setAttribute(name, translated);
  }
}

function translateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  // A textarea keeps the user's text, but its placeholder is interface text.
  translateAttributes(element);
  if (SKIP_TAGS.has(element.tagName)) return;

  element
    .querySelectorAll(ATTRIBUTES.map(name => `[${name}]`).join(','))
    .forEach(translateAttributes);

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    translateTextNode(node as Text);
  }
}

export default function RuOverlay() {
  useEffect(() => {
    const pending = new Set<Node>();
    let scheduled = false;

    const flush = () => {
      scheduled = false;
      const nodes = [...pending];
      pending.clear();
      for (const node of nodes) if (node.isConnected) translateTree(node);
    };

    const schedule = (node: Node) => {
      pending.add(node);
      if (!scheduled) {
        scheduled = true;
        queueMicrotask(flush);
      }
    };

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') schedule(mutation.target);
        else if (mutation.type === 'childList')
          mutation.addedNodes.forEach(schedule);
        else if (mutation.type === 'attributes') schedule(mutation.target);
      }
    });

    // Start after hydration so React sees the same markup it rendered on the server.
    const timers = [
      window.setTimeout(() => {
        translateTree(document.body);
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...ATTRIBUTES],
        });
      }, 0),
      ...RESCAN_DELAYS_MS.map(delay =>
        window.setTimeout(() => translateTree(document.body), delay),
      ),
    ];

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, []);

  return null;
}

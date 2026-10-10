#!/usr/bin/env node
// Builds the Russian data used by this fork from the editable TSV sources in data/ru/.
//
//   data/ru/ui.tsv            -> core/i18n/ru-overlay/ru-ui.json   (interface strings, en -> ru)
//   data/ru/vocab-<lvl>.tsv   -> public/data-vocab-ru/<lvl>.json   ("jmdict_seq|kana" -> "значение; значение")
//   data/ru/kanji-<lvl>.tsv   -> public/data-kanji-ru/<LVL>.json   (kanji -> "значение; значение")
//
// Run after editing any TSV:  npm run ru:build
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];

// Minimal TSV reader: first row is the header; fields may be wrapped in double quotes.
function readTsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(
      line
        .split('\t')
        .map(field =>
          field.startsWith('"') && field.endsWith('"') && field.length >= 2
            ? field.slice(1, -1).replace(/""/g, '"')
            : field,
        ),
    );
  }
  const [header, ...body] = rows;
  return body.map(cells =>
    Object.fromEntries(
      header.map((name, i) => [name, (cells[i] ?? '').trim()]),
    ),
  );
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const report = [];

// Interface strings
const uiRows = readTsv(join(root, 'data/ru/ui.tsv'));
const ui = {};
for (const { en, ru } of uiRows) if (en && ru) ui[en] = ru;
writeJson(join(root, 'core/i18n/ru-overlay/ru-ui.json'), ui);
report.push(`ui: ${Object.keys(ui).length} strings`);

// Vocabulary meanings
for (const level of LEVELS) {
  const src = join(root, `data/ru/vocab-${level}.tsv`);
  if (!existsSync(src)) continue;
  const out = {};
  for (const row of readTsv(src)) {
    if (row.jmdict_seq && row.ru) out[`${row.jmdict_seq}|${row.kana}`] = row.ru;
  }
  writeJson(join(root, `public/data-vocab-ru/${level}.json`), out);
  report.push(`vocab ${level}: ${Object.keys(out).length}`);
}

// Kanji meanings
for (const level of LEVELS) {
  const src = join(root, `data/ru/kanji-${level}.tsv`);
  if (!existsSync(src)) continue;
  const out = {};
  for (const row of readTsv(src))
    if (row.kanji && row.ru) out[row.kanji] = row.ru;
  writeJson(
    join(root, `public/data-kanji-ru/${level.toUpperCase()}.json`),
    out,
  );
  report.push(`kanji ${level}: ${Object.keys(out).length}`);
}

process.stdout.write(`${report.join('\n')}\n`);

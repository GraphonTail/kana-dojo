// Russian translations for interface strings that contain numbers or other
// runtime values. Exact strings live in data/ru/ui.tsv (built into ru-ui.json).

type Replacement = string | ((match: RegExpMatchArray) => string);

/** Picks the Russian plural form: 1 очко, 2 очка, 5 очков. */
export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const n10 = Math.abs(n) % 10;
  const n100 = Math.abs(n) % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

const points = (n: string) =>
  `${n} ${plural(Number(n), 'очко', 'очка', 'очков')}`;
const attempts = (n: string) =>
  `${n} ${plural(Number(n), 'попытки', 'попыток', 'попыток')}`;

export const PATTERNS: ReadonlyArray<readonly [RegExp, Replacement]> = [
  // Kana groups: "あ-group" -> "ряд あ"
  [/^(\S+)-group \(challenge\)$/, 'ряд $1 (сложное)'],
  [/^(\S+)-group$/, 'ряд $1'],

  // Units and levels in the kanji / vocabulary dojos
  [/^Unit (\d+)$/, 'Раздел $1'],
  [/^Level (\d+)$/, 'Уровень $1'],
  [/^Levels (\d+)\s*[-–]\s*(\d+)$/, 'Уровни $1–$2'],
  [/^Scroll for more \((\d+) rows? remaining\)$/, 'Прокрутите дальше (ещё $1)'],
  [/^(\d+) levels? selected$/, 'Выбрано уровней: $1'],

  // Achievements
  [/^\+(\d+) points?$/, m => `+${points(m[1])}`],
  [/^(\d+) points?$/, m => points(m[1])],
  [/^Progress: (\d+)%(.*)$/, 'Прогресс: $1%$2'],
  [/^(\d+)% complete(.*)$/, '$1% выполнено$2'],
  [/^([\d.]+)% accuracy(.*)$/, '$1% точности$2'],
  [/^(\d+)\/(\d+) correct answers(.*)$/, '$1/$2 верных ответов$3'],
  [/^(\d+)\/(\d+) Hiragana correct(.*)$/, '$1/$2 верно по хирагане$3'],
  [/^(\d+)\/(\d+) Katakana correct(.*)$/, '$1/$2 верно по катакане$3'],
  [/^(\d+)\/(\d+) streak(.*)$/, 'серия $1/$2$3'],

  // Game feedback and summaries
  [/^✗ Incorrect! It was "(.*)"$/, '✗ Неверно! Правильно: «$1»'],
  [/^(\d+) \/ (\d+) correct$/, '$1 / $2 верно'],
  [/^(\d+) in a row(!?)$/, '$1 подряд$2'],
  [
    /^out of (\d+) attempts, you answered (\d+) correctly\.$/,
    m => `из ${attempts(m[1])} верно: ${m[2]}.`,
  ],
  [
    /^you ended this run early at (\d+)%\.$/,
    'вы завершили забег досрочно на $1%.',
  ],
  [/^you got (\d+)% through the gauntlet$/, 'вы прошли $1% «Испытания»'],
  [/^(\d+) seconds challenge finished$/, 'испытание на $1 с завершено'],
  [/^([\d.]+) minutes? challenge finished$/, 'испытание на $1 мин завершено'],
  [/^(\d+) seconds$/, '$1 с'],
  [/^View (.+) on Kanji Heatmap$/, '$1 на Kanji Heatmap'],
  [/^(\d{4}-\d{2}-\d{2}) \(future\)$/, '$1 (ещё впереди)'],
  [/^Select (.+) theme$/, 'Выбрать тему $1'],
  [/^Open (https?:\/\/\S+)$/, 'Открыть $1'],
  [/^🎯 Goal reached: (.+) at (\d+)s$/, '🎯 Цель достигнута: $1 за $2 с'],

  // Messages with values (next-intl)
  [/^Score: (.+)$/, 'Счёт: $1'],
  [/^Streak: (.+)$/, 'Серия: $1'],
  [/^Time left: (\d+)s$/, 'Осталось: $1 с'],
  [/^Correct: (.+)$/, 'Верно: $1'],
  [/^Incorrect: (.+)$/, 'Неверно: $1'],
  [/^Accuracy: (.+)$/, 'Точность: $1'],
  [/^Time spent: (.+)$/, 'Затрачено: $1'],
  [/^Progress: (\d+)\/(\d+)$/, 'Прогресс: $1/$2'],
  [/^Earned on (.+)$/, 'Получено $1'],
  [/^Back to (.+)$/, 'Назад: $1'],
  [
    /^© (\d{4}) KanaDojo\. All rights reserved\.$/,
    '© $1 KanaDojo. Все права защищены.',
  ],

  // Pronunciation buttons (screen-reader labels)
  [
    /^Play pronunciation for (\S+) on'yomi (.+)$/,
    'Произнести онъёми $2 для $1',
  ],
  [
    /^Play pronunciation for (\S+) kun'yomi (.+)$/,
    'Произнести кунъёми $2 для $1',
  ],
  [/^Play pronunciation for (.+)$/, 'Произнести $1'],
];

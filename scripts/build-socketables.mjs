// Собирает data/socketables.json: руны, ядра душ и идолы с poe2db (CC BY-NC-SA 3.0).
// Запуск: node scripts/build-socketables.mjs
import { writeFileSync } from 'node:fs';

const PAGES = [
  ['rune', 'Rune'],
  ['core', 'Soul_Core'],
  ['idol', 'Idol'],
];

function pageLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&[a-z#0-9]+;/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function fetchPage(locale, page) {
  const response = await fetch(`https://poe2db.tw/${locale}/${page}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!response.ok) throw new Error(`${page}: HTTP ${response.status}`);
  return pageLines(await response.text());
}

/** Блоки предметов: имя стоит перед строкой размера стопки. */
function blocks(lines, stackLabel, bondedLabel) {
  const starts = lines.flatMap((line, index) => (line === stackLabel ? [index - 1] : []));
  return starts.map((start, position) => {
    const end = starts[position + 1] ?? lines.length;
    const body = lines.slice(start + 1, end);
    const bonded = body.indexOf(bondedLabel);
    return { name: lines[start], body: bonded >= 0 ? body.slice(0, bonded) : body };
  });
}

function effects(body) {
  const text = body
    .join(' ')
    .replace(/\s+([%:,.])/g, '$1')
    .replace(/([+-])\s+(?=\d)/g, '$1')
    .replace(/\d+\s*\/\s*\d+/, '')
    .replace(/Предел:\s*\d+/, '')
    .replace(/Требуется:\s*Уровень\s*\d+(,\s*\d+\s*[А-Яа-я.]+)*/, '');

  const found = [];
  const label = /(?:^|\s)([А-ЯЁ][а-яё]*(?:\s(?:или\s)?[а-яё]+){0,3}):\s/g;
  const marks = [...text.matchAll(label)];
  marks.forEach((mark, index) => {
    const start = (mark.index ?? 0) + mark[0].length;
    const end = marks[index + 1]?.index ?? text.length;
    const effect = text.slice(start, end).trim();
    // «Максимум», «Размер стопки» и «Требуется» — служебные строки, а не слоты.
    if (effect && !/^(Максимум|Размер стопки|Требуется)$/.test(mark[1])) {
      found.push({ slot: mark[1], text: effect });
    }
  });
  return found;
}

function priceId(name) {
  return name.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const items = [];
for (const [kind, page] of PAGES) {
  const ru = blocks(await fetchPage('ru', page), 'Размер стопки:', 'Связаны');
  const en = blocks(await fetchPage('us', page), 'Stack Size:', 'Bonded');
  if (ru.length !== en.length) throw new Error(`${page}: ${ru.length} ru, ${en.length} en`);
  ru.forEach((item, index) => {
    const list = effects(item.body);
    if (list.length > 0) {
      items.push({ id: priceId(en[index]?.name ?? ''), kind, name: item.name, effects: list });
    }
  });
}

const output = new URL('../data/socketables.json', import.meta.url);
writeFileSync(
  output,
  `${JSON.stringify({ source: 'https://poe2db.tw/ru/', license: 'PoE2DB content: CC BY-NC-SA 3.0', updatedAt: new Date().toISOString().slice(0, 10), items }, null, 1)}\n`,
);
console.log(`${items.length} items`);

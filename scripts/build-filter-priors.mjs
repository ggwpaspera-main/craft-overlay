// Собирает структурный снимок NeverSink-фильтра в data/filter-priors.json.
// Источник: data/filter/neversink-0.10.4-3strict.txt (MIT, NeverSink).
import { readFileSync, writeFileSync } from 'node:fs';

const sourceUrl = new URL('../data/filter/neversink-0.10.4-3strict.txt', import.meta.url);
const basesUrl = new URL('../data/bases.json', import.meta.url);
const outputUrl = new URL('../data/filter-priors.json', import.meta.url);
const compactUrl = new URL('../data/filter-base-tiers.json', import.meta.url);

const lines = readFileSync(sourceUrl, 'utf8').split(/\r?\n/);
const basesData = JSON.parse(readFileSync(basesUrl, 'utf8'));

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

const baseByEnglish = new Map();
for (const itemClass of basesData.classes ?? []) {
  for (const base of itemClass.bases ?? []) {
    const entry = {
      en: String(base.slug ?? '').replace(/_/g, ' '),
      ru: base.name ?? '',
      slug: base.slug ?? '',
      class: itemClass.name ?? '',
      category: itemClass.category ?? '',
      subtype: itemClass.subtype ?? '',
    };
    for (const key of [base.slug, entry.en]) {
      const normalized = normalize(key);
      if (normalized) baseByEnglish.set(normalized, entry);
    }
  }
}

function quoted(line) {
  return [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function parseConditions(body) {
  const conditions = {};
  const addBase = (values) => {
    if (!values.length) return;
    conditions.baseTypes = [...new Set([...(conditions.baseTypes ?? []), ...values])];
  };
  const addClass = (values) => {
    if (!values.length) return;
    conditions.classes = [...new Set([...(conditions.classes ?? []), ...values])];
  };
  for (const rawLine of body) {
    const line = rawLine.trim();
    if (/^BaseType\b/.test(line)) addBase(quoted(line));
    else if (/^Class\b/.test(line)) addClass(quoted(line));
    else if (/^Rarity\b/.test(line)) {
      conditions.rarities = line
        .replace(/^Rarity\s*/, '')
        .split(/\s+/)
        .filter((value) => /^(Normal|Magic|Rare|Unique)$/.test(value));
    } else if (/^ItemLevel\b/.test(line)) {
      const match = line.match(/^ItemLevel\s*(>=|<=|=)\s*(\d+)/);
      if (match) conditions.itemLevel = { op: match[1], value: Number(match[2]) };
    } else if (/^Quality\b/.test(line)) {
      const match = line.match(/^Quality\s*(>=|<=|=)\s*(\d+)/);
      if (match) conditions.quality = { op: match[1], value: Number(match[2]) };
    } else if (/^Sockets\b/.test(line)) {
      const match = line.match(/^Sockets\s*(>=|<=|=)\s*(\d+)/);
      if (match) conditions.sockets = { op: match[1], value: Number(match[2]) };
    } else if (/^AreaLevel\b/.test(line)) {
      const match = line.match(/^AreaLevel\s*(>=|<=|=)\s*(\d+)/);
      if (match) conditions.areaLevel = { op: match[1], value: Number(match[2]) };
    } else if (/^UnidentifiedItemTier\b/.test(line)) {
      const match = line.match(/^UnidentifiedItemTier\s*(>=|<=|=)\s*(\d+)/);
      if (match) conditions.unidentifiedItemTier = { op: match[1], value: Number(match[2]) };
    } else if (/^Identified\b/.test(line)) conditions.identified = line.endsWith('True');
    else if (/^Corrupted\b/.test(line)) conditions.corrupted = line.endsWith('True');
    else if (/^Mirrored\b/.test(line)) conditions.mirrored = line.endsWith('True');
    else if (/^HasExplicitMod\b/.test(line)) {
      const match = line.match(/^HasExplicitMod\s*(>=|<=|==|=)?\s*(\d+)\s*(.*)$/);
      if (match) {
        const names = quoted(match[3]);
        if (names.length) {
          conditions.hasExplicitMods = [
            ...(conditions.hasExplicitMods ?? []),
            { op: match[1] ?? '>=', count: Number(match[2]), names },
          ];
        }
      }
    }
  }
  return conditions;
}

function parseBlocks() {
  const blocks = [];
  let section = 'TOP (before [[0100]])';
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const trimmed = raw.trim();
    const header = trimmed.match(/^#\s*\[{1,2}(\d{4})\]\]?/);
    if (header) {
      section = trimmed.replace(/^#\s*/, '');
      continue;
    }
    const start = trimmed.match(/^#?\s*(Show|Hide)\b/);
    if (!start) continue;

    const commented = trimmed.startsWith('#');
    const body = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const current = lines[cursor];
      if (commented) {
        if (!current.trim().startsWith('#')) break;
        const content = current.replace(/^\s*#\s?/, '').trim();
        if (!content) break;
        body.push(content);
        cursor += 1;
      } else {
        if (!current.trim()) break;
        body.push(current.trim());
        cursor += 1;
      }
    }

    const tags = [...trimmed.matchAll(/\$[a-z]+->([^\s]+)/g)].map((match) => match[1]);
    blocks.push({
      show: start[1] === 'Show',
      commented,
      section,
      line: index + 1,
      tags,
      conditions: parseConditions(body),
    });
    index = cursor - 1;
  }
  return blocks;
}

function addUnique(list, entry) {
  const key = normalize(entry.en);
  if (!list.some((candidate) => normalize(candidate.en) === key)) list.push(entry);
}

function baseEntry(nameEn, source, extra = {}) {
  const mapped = baseByEnglish.get(normalize(nameEn));
  return {
    en: nameEn,
    ru: mapped?.ru ?? null,
    slug: mapped?.slug ?? null,
    class: mapped?.class ?? null,
    category: mapped?.category ?? null,
    source,
    ...extra,
  };
}

const blocks = parseBlocks();
const baseTiers = { t1: [], t2: [], t3: [], exceptional: [], economy: [] };

for (const block of blocks) {
  const baseTypes = block.conditions.baseTypes ?? [];
  if (!baseTypes.length) continue;

  const tagText = block.tags.join(' ');
  const tagTier = (tagText.match(/t([123])(?=[^0-9]|$)/) ?? [])[1];
  const isBaseTierSection = /\[\[(1103|1500)\]\]/.test(block.section);
  const source = `${block.commented ? 'commented' : 'active'}:${block.line}`;

  if (tagTier && isBaseTierSection) {
    for (const name of baseTypes) addUnique(baseTiers[`t${tagTier}`], baseEntry(name, source));
  }

  if (block.conditions.quality?.value >= 24 || block.conditions.sockets?.value >= 2) {
    for (const name of baseTypes) {
      addUnique(baseTiers.exceptional, baseEntry(name, source, { gate: block.conditions }));
    }
  }

  if (/economy|ecocraft/.test(tagText)) {
    for (const name of baseTypes) addUnique(baseTiers.economy, baseEntry(name, source));
  }

  // Активный T1-список обычных баз на ilvl 82 (верхний override-блок).
  if (
    !block.commented &&
    block.conditions.rarities?.includes('Normal') &&
    block.conditions.itemLevel?.value >= 82 &&
    !block.conditions.quality &&
    !block.conditions.sockets &&
    baseTypes.length >= 5
  ) {
    for (const name of baseTypes) addUnique(baseTiers.t1, baseEntry(name, source));
  }
}

const showRules = [];
const hideRules = [];
for (const block of blocks) {
  if (block.commented) continue;
  const conditions = block.conditions;
  if (!conditions.baseTypes && !conditions.classes && !conditions.hasExplicitMods) continue;
  const rule = {
    line: block.line,
    section: block.section,
    conditions,
    tags: block.tags,
  };
  (block.show ? showRules : hideRules).push(rule);
}

const metaLine = (prefix) => {
  const found = lines.find((line) => line.replace(/^#\s*/, '').trim().startsWith(prefix));
  return found ? found.replace(/^#\s*/, '').trim() : null;
};

const output = {
  meta: {
    source: 'NeverSink-Filter-for-PoE2',
    version: metaLine('VERSION:'),
    type: metaLine('TYPE:'),
    style: metaLine('STYLE:'),
    license: 'MIT',
    sourceUrl: 'https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2',
    generatedAt: new Date().toISOString(),
    lineCount: lines.length,
    activeRules: showRules.length + hideRules.length,
  },
  baseTiers,
  showRules,
  hideRules,
};

writeFileSync(outputUrl, `${JSON.stringify(output, null, 1)}\n`, 'utf8');

const compactBases = [];
const compactSeen = new Set();
for (const tier of ['t1', 'exceptional', 't2', 't3', 'economy']) {
  for (const entry of baseTiers[tier]) {
    const key = normalize(entry.en);
    if (!key || compactSeen.has(key)) continue;
    compactSeen.add(key);
    compactBases.push({
      tier,
      en: entry.en,
      ru: entry.ru,
      slug: entry.slug,
      class: entry.class,
      category: entry.category,
    });
  }
}
writeFileSync(
  compactUrl,
  `${JSON.stringify({ meta: output.meta, bases: compactBases }, null, 1)}\n`,
  'utf8',
);
console.log(
  `filter priors: ${Object.values(baseTiers).reduce((sum, list) => sum + list.length, 0)} баз, ` +
    `${showRules.length} Show, ${hideRules.length} Hide`,
);

import type { ModifierGroup, ModValue, ModifierState, StatLine } from './types';
import type { LocaleDictionary } from './locale/types';
import { escapeRegExp } from './properties';

const EM_DASH = '\u2014';

export function isAdvancedHeader(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

export function isRuneLine(line: string, dict: LocaleDictionary): boolean {
  return new RegExp(`\\(${escapeRegExp(dict.markers.rune)}\\)\\s*$`).test(line.trim());
}

export function stripRuneMarker(line: string, dict: LocaleDictionary): string {
  return line
    .trim()
    .replace(new RegExp(`\\s*\\(${escapeRegExp(dict.markers.rune)}\\)\\s*$`), '')
    .trim();
}

/**
 * Разбирает advanced-заголовок:
 *   { Префикс "Папский" (Уровень: 1) — Здоровье, Энергетический щит }
 *   { Очернённое Префикс "Искрящийся" (Уровень: 1) — Энергетический щит }
 *   { Собственное свойство — Характеристика }
 *   { Уникальное свойство — Физический, Атака }
 *   { Улучшение }
 */
export function parseAdvancedHeader(
  raw: string,
  dict: LocaleDictionary,
): ModifierGroup | null {
  const trimmed = raw.trim();
  if (!isAdvancedHeader(trimmed)) return null;

  let inner = trimmed.slice(1, -1).trim();
  const dashIndex = inner.indexOf(EM_DASH);
  let head = dashIndex >= 0 ? inner.slice(0, dashIndex).trim() : inner;
  const tagsRaw = dashIndex >= 0 ? inner.slice(dashIndex + 1).trim() : '';
  const tags = tagsRaw
    ? tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  let affixName: string | undefined;
  head = head
    .replace(/"([^"]*)"/g, (_full, name: string) => {
      if (affixName === undefined) affixName = name;
      return '';
    })
    .trim();

  let tier: number | undefined;
  const tierRe = new RegExp(`\\(${escapeRegExp(dict.labels.tier)}:\\s*(\\d+)\\)`);
  head = head
    .replace(tierRe, (_full, value: string) => {
      tier = Number(value);
      return '';
    })
    .trim();

  const kindKeys = Object.keys(dict.modifierKinds).sort((a, b) => b.length - a.length);
  let kindKey: string | undefined;
  let kindIndex = -1;
  for (const key of kindKeys) {
    const index = head.indexOf(key);
    if (index >= 0) {
      kindKey = key;
      kindIndex = index;
      break;
    }
  }
  if (!kindKey) return null;

  const statePrefix = head.slice(0, kindIndex).trim();
  const stateWords = statePrefix ? statePrefix.split(/\s+/).filter(Boolean) : [];
  const states: ModifierState[] = [];
  for (const word of stateWords) {
    const state = dict.modifierStates[word];
    if (state) {
      states.push(state);
    } else {
      states.push('unknown');
    }
  }

  const meta = dict.modifierKinds[kindKey];
  if (!meta) return null;

  return {
    source: meta.source,
    kind: meta.kind,
    headerRaw: trimmed,
    ...(affixName !== undefined ? { affixName } : {}),
    ...(tier !== undefined ? { tier } : {}),
    tags,
    states,
    lines: [],
  };
}

/**
 * Разбирает строку стата:
 *   42(39-42)% увеличение энергетического щита
 *   +45(42-49) к максимуму здоровья
 *   Регенерация 14.3(13.1-18) здоровья в секунду
 *   35% повышение скорости передвижения
 *   -4 входящего физического урона при получении удара от атак
 *   Область содержит участки заряженной земли — Неизменяемое значение
 */
export function parseStatLine(raw: string, dict: LocaleDictionary): StatLine {
  let text = raw.trim();
  let fixedValue = false;

  const fixedMarker = new RegExp(
    `\\s*[${EM_DASH}\\u2013-]\\s*${escapeRegExp(dict.markers.fixedValue)}\\s*$`,
  );
  if (fixedMarker.test(text)) {
    fixedValue = true;
    text = text.replace(fixedMarker, '').trim();
  }

  const roundMarker = new RegExp(
    `\\s*\\(${escapeRegExp(dict.markers.rune)}\\)\\s*$`,
  );
  if (roundMarker.test(text)) {
    text = text.replace(roundMarker, '').trim();
  }

  const augmentedMarker = new RegExp(
    `\\s*\\(${escapeRegExp(dict.markers.augmented)}\\)\\s*$`,
    'i',
  );
  if (augmentedMarker.test(text)) {
    text = text.replace(augmentedMarker, '').trim();
  }

  const values: ModValue[] = [];

  // Диапазон без ролла: "(-4—-3)%" (в шаблонах poe2db), где ролл не указан.
  const bareRange = /(?<![\d.,])\(([+-]?\d+(?:[.,]\d+)?)[\u2013\u2014-]([+-]?\d+(?:[.,]\d+)?)\)/g;
  text = text.replace(bareRange, (full, min: string, max: string) => {
    values.push({
      raw: full,
      rolled: null,
      min: parseNumber(min),
      max: parseNumber(max),
    });
    return '';
  });

  // Ролл и необязательный диапазон: "42(39-42)", "14.3(13.1-18)", "-4", "35".
  const rolled = /([+-]?\d+(?:[.,]\d+)?)(?:\(([+-]?\d+(?:[.,]\d+)?)[\u2013\u2014-]([+-]?\d+(?:[.,]\d+)?)\))?/g;
  text = text.replace(rolled, (full, value: string, min?: string, max?: string) => {
    values.push({
      raw: full,
      rolled: parseNumber(value),
      ...(min !== undefined ? { min: parseNumber(min) } : {}),
      ...(max !== undefined ? { max: parseNumber(max) } : {}),
    });
    return full;
  });

  // Уже собранные диапазоны убираем из человекочитаемого текста, ролл оставляем.
  text = text
    .replace(/\([+-]?\d+(?:[.,]\d+)?[\u2013\u2014-][+-]?\d+(?:[.,]\d+)?\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    raw,
    text,
    values,
    ...(fixedValue ? { fixedValue: true } : {}),
  };
}

function parseNumber(value: string): number {
  return Number.parseFloat(value.replace(',', '.'));
}

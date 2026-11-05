import type {
  ItemCategory,
  ItemFlags,
  Locale,
  ModifierGroup,
  ParsedItem,
  ParseResult,
} from './types';
import type { LocaleDictionary } from './locale/types';
import { ru } from './locale/ru';
import { splitSections } from './sections';
import { parseHeader } from './header';
import {
  isPropertyLine,
  isRequirementsLine,
  parseItemLevel,
  parsePropertyLine,
  parseRequirementsLine,
  parseSockets,
} from './properties';
import {
  isAdvancedHeader,
  isRuneLine,
  parseAdvancedHeader,
  parseStatLine,
  stripRuneMarker,
} from './modifiers';
import { parseFlagLine } from './flags';

export const PARSER_VERSION = '0.2.0';

/**
 * Разбирает текст предмета PoE2.
 *
 * Возвращает ParseResult: даже при частичном разборе item заполняется,
 * а всё непонятное попадает в unknownLines/warnings. Исключений на «странном»
 * тексте быть не должно.
 */
export function parseItemText(raw: string, locale: Locale = 'ru'): ParseResult {
  const dict = getDictionary(locale);
  const sections = splitSections(raw);

  if (sections.length === 0) {
    return fail('Пустой текст предмета');
  }

  const headerSection = sections[0];
  if (!headerSection) {
    return fail('Не найдена секция заголовка');
  }

  const header = parseHeader(headerSection, dict);
  if (!header || !header.itemClass) {
    return fail('Не удалось найти "Класс предмета"');
  }

  const item: ParsedItem = {
    raw,
    locale,
    parserVersion: PARSER_VERSION,
    itemClass: header.itemClass,
    category: header.category as ItemCategory,
    ...(header.subtype ? { subtype: header.subtype } : {}),
    rarity: header.rarity,
    ...(header.name ? { name: header.name } : {}),
    ...(header.baseType ? { baseType: header.baseType } : {}),
    ...(header.waystoneTier !== undefined ? { waystoneTier: header.waystoneTier } : {}),
    properties: [],
    requirements: [],
    sockets: [],
    grantedSkills: [],
    modifiers: [],
    runes: [],
    flags: {},
    unknownLines: [],
    warnings: [...header.warnings],
  };

  if (locale === 'en') {
    item.warnings.push('Английская локаль пока не поддержана — используется словарь ru');
  }

  const flags: ItemFlags = {};
  const lastIndex = sections.length - 1;

  for (let i = 1; i < sections.length; i += 1) {
    const lines = sections[i];
    if (!lines || lines.length === 0) continue;

    const first = (lines[0] ?? '').trim();
    const isLast = i === lastIndex;

    if (isRequirementsLine(first, dict)) {
      const parsed = parseRequirementsLine(first, dict);
      item.requirements.push(...parsed.requirements);
      item.warnings.push(...parsed.warnings);
      continue;
    }

    if (first.startsWith(`${dict.labels.itemLevel}:`)) {
      const itemLevel = parseItemLevel(first, dict);
      if (itemLevel !== null) {
        item.itemLevel = itemLevel;
      } else {
        item.warnings.push(`Не удалось разобрать уровень предмета: "${first}"`);
      }
      continue;
    }

    if (first.startsWith(`${dict.labels.sockets}:`)) {
      const sockets = parseSockets(first, dict);
      if (sockets) item.sockets = sockets;
      continue;
    }

    const grantedPrefix = `${dict.labels.grantedSkill}:`;
    if (first.startsWith(grantedPrefix)) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith(grantedPrefix)) {
          item.grantedSkills.push(trimmed.slice(grantedPrefix.length).trim());
        } else {
          item.unknownLines.push(trimmed);
        }
      }
      continue;
    }

    if (lines.some((line) => isAdvancedHeader(line))) {
      parseModifiersSection(lines, item, dict);
      continue;
    }

    if (lines.every((line) => isPropertyLine(line))) {
      for (const line of lines) {
        const parsed = parsePropertyLine(line, dict);
        if (!parsed) continue;
        if (parsed.quality !== undefined) {
          item.quality = parsed.quality;
          if (parsed.qualityType) item.qualityType = parsed.qualityType;
        }
        if (parsed.property) item.properties.push(parsed.property);
        if (parsed.warning) item.warnings.push(parsed.warning);
      }
      continue;
    }

    if (lines.every((line) => parseFlagLine(line, dict) !== null)) {
      for (const line of lines) {
        const flag = parseFlagLine(line, dict);
        if (flag) flags[flag] = true;
      }
      continue;
    }

    if (lines.every((line) => isRuneLine(line, dict))) {
      for (const line of lines) {
        item.runes.push(parseStatLine(stripRuneMarker(line, dict), dict));
      }
      continue;
    }

    if (isProseSection(lines, dict)) {
      const prose = lines.map((line) => line.trim()).filter(Boolean);
      if (item.category === 'waystone' || item.category === 'tablet' || item.category === 'jewel') {
        item.description = [...(item.description ?? []), ...prose];
      } else {
        item.flavourText = [...(item.flavourText ?? []), ...prose];
      }
      continue;
    }

    if (isLast && item.rarity === 'unique') {
      item.flavourText = lines.map((line) => line.trim()).filter(Boolean);
      continue;
    }

    if (isLast && item.category === 'waystone') {
      item.description = lines.map((line) => line.trim()).filter(Boolean);
      continue;
    }

    item.unknownLines.push(...lines.map((line) => line.trim()).filter(Boolean));
  }

  item.flags = flags;

  return {
    ok: true,
    item,
    warnings: item.warnings,
    unknownLines: item.unknownLines,
  };
}

function parseModifiersSection(
  lines: string[],
  item: ParsedItem,
  dict: LocaleDictionary,
): void {
  let current: ModifierGroup | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isAdvancedHeader(trimmed)) {
      const group = parseAdvancedHeader(trimmed, dict);
      if (group) {
        if (group.states.includes('unknown')) {
          item.warnings.push(`Неизвестное состояние мода: "${trimmed}"`);
        }
        item.modifiers.push(group);
        current = group;
      } else {
        item.unknownLines.push(trimmed);
        item.warnings.push(`Не удалось разобрать заголовок мода: "${trimmed}"`);
        current = null;
      }
      continue;
    }

    if (current) {
      current.lines.push(parseStatLine(trimmed, dict));
      continue;
    }

    if (isRuneLine(trimmed, dict)) {
      item.runes.push(parseStatLine(stripRuneMarker(trimmed, dict), dict));
      continue;
    }

    item.unknownLines.push(trimmed);
  }
}

function getDictionary(locale: Locale): LocaleDictionary {
  switch (locale) {
    case 'ru':
      return ru;
    default:
      return ru;
  }
}

/**
 * Секция «прозы»: лор уникальных предметов, описание джевелов/плиток/waystone.
 * В advanced-copy такие строки не содержат чисел, двоеточий и не являются
 * заголовками модов/флагами. В basic-copy моды тоже могут быть без чисел,
 * поэтому эвристика используется только как запасной вариант.
 */
function isProseSection(lines: string[], dict: LocaleDictionary): boolean {
  const trimmed = lines.map((line) => line.trim()).filter(Boolean);
  if (trimmed.length === 0) return false;

  return trimmed.every((line) => {
    if (/\d/.test(line)) return false;
    if (line.includes(':')) return false;
    if (line.startsWith('{')) return false;
    if (isRuneLine(line, dict)) return false;
    if (parseFlagLine(line, dict) !== null) return false;
    return true;
  });
}

function fail(reason: string): ParseResult {
  return {
    ok: false,
    item: null,
    warnings: [reason],
    unknownLines: [],
  };
}

import type { ItemCategory, Rarity } from './types';
import type { LocaleDictionary } from './locale/types';

export interface HeaderInfo {
  itemClass: string;
  category: ItemCategory;
  subtype?: string;
  rarity: Rarity;
  name?: string;
  baseType?: string;
  waystoneTier?: number;
  warnings: string[];
}

/**
 * Разбирает первую секцию: "Класс предмета", "Редкость" и 1–2 строки имени/базы.
 *
 * TODO: magic/normal/currency/gem могут иметь другую структуру — пока
 * обрабатываем 1–2 строки эвристикой и фиксируем предупреждение при большем
 * количестве строк.
 */
export function parseHeader(
  section: string[],
  dict: LocaleDictionary,
): HeaderInfo | null {
  const warnings: string[] = [];
  let itemClass = '';
  let rarityRaw = '';
  const nameLines: string[] = [];

  for (const line of section) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const classPrefix = `${dict.labels.itemClass}:`;
    const rarityPrefix = `${dict.labels.rarity}:`;

    if (trimmed.startsWith(classPrefix)) {
      itemClass = trimmed.slice(classPrefix.length).trim();
    } else if (trimmed.startsWith(rarityPrefix)) {
      rarityRaw = trimmed.slice(rarityPrefix.length).trim();
    } else {
      nameLines.push(trimmed);
    }
  }

  if (!itemClass) {
    warnings.push('Не найден "Класс предмета"');
  }
  if (!rarityRaw) {
    warnings.push('Не найдена "Редкость"');
  }

  const rarity = dict.rarities[rarityRaw] ?? 'unknown';
  if (rarityRaw && rarity === 'unknown') {
    warnings.push(`Неизвестная редкость: "${rarityRaw}"`);
  }

  const classMeta = dict.itemClasses[itemClass];
  if (itemClass && !classMeta) {
    warnings.push(`Неизвестный класс предмета: "${itemClass}"`);
  }

  let name: string | undefined;
  let baseType: string | undefined;
  let waystoneTier: number | undefined;

  if (nameLines.length >= 2) {
    name = nameLines[0];
    baseType = nameLines[1];
    if (nameLines.length > 2) {
      warnings.push(`В заголовке ${nameLines.length} строк имени/базы — лишние пропущены`);
    }
  } else if (nameLines.length === 1) {
    name = nameLines[0];
  }

  if (baseType) {
    const tierMatch = baseType.match(/\(Ур\.\s*(\d+)\)/);
    if (tierMatch?.[1]) {
      waystoneTier = Number(tierMatch[1]);
      baseType = baseType.replace(/\s*\(Ур\.\s*\d+\)\s*$/, '').trim();
    }
  }

  if (!itemClass && !rarityRaw && nameLines.length === 0) {
    return null;
  }

  return {
    itemClass,
    category: classMeta?.category ?? 'unknown',
    subtype: classMeta?.subtype,
    rarity,
    name,
    baseType,
    waystoneTier,
    warnings,
  };
}

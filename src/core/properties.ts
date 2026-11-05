import type { ItemProperty, Requirement } from './types';
import type { LocaleDictionary } from './locale/types';

export interface PropertyParseResult {
  property?: ItemProperty;
  quality?: number;
  qualityType?: string;
  warning?: string;
}

const PROPERTY_LINE = /^([^:]+):\s*(.+)$/;

export function isPropertyLine(line: string): boolean {
  return PROPERTY_LINE.test(line.trim());
}

/** Разбирает строку свойства: "Энергетический щит: 512 (augmented)". */
export function parsePropertyLine(
  line: string,
  dict: LocaleDictionary,
): PropertyParseResult | null {
  const match = line.trim().match(PROPERTY_LINE);
  if (!match) return null;

  const label = (match[1] ?? '').trim();
  let value = (match[2] ?? '').trim();
  let augmented = false;

  const augmentedMarker = new RegExp(
    `\\s*\\(${escapeRegExp(dict.markers.augmented)}\\)\\s*$`,
    'i',
  );
  if (augmentedMarker.test(value)) {
    value = value.replace(augmentedMarker, '').trim();
    augmented = true;
  }

  if (label === dict.labels.quality || label.startsWith(`${dict.labels.quality} (`)) {
    const quality = parseNumericValue(value);
    if (quality === null) {
      return { warning: `Не удалось разобрать качество: "${value}"` };
    }
    const typeMatch = label.match(/\(([^)]+)\)/);
    return {
      quality,
      ...(typeMatch?.[1] ? { qualityType: typeMatch[1].trim() } : {}),
    };
  }

  const key = dict.properties[label];
  return {
    property: {
      key: key ?? 'unknown',
      label,
      values: [value],
      ...(augmented ? { augmented: true } : {}),
    },
    ...(key ? {} : { warning: `Неизвестное свойство: "${label}"` }),
  };
}

export function isRequirementsLine(line: string, dict: LocaleDictionary): boolean {
  return line.trim().startsWith(`${dict.labels.requirements}:`);
}

/** Разбирает "Требуется: Уровень 75, 107 Инт". */
export function parseRequirementsLine(
  line: string,
  dict: LocaleDictionary,
): { requirements: Requirement[]; warnings: string[] } {
  const warnings: string[] = [];
  const requirements: Requirement[] = [];
  const prefix = `${dict.labels.requirements}:`;
  const rest = line.trim().slice(prefix.length).trim();

  for (const rawToken of rest.split(',')) {
    const token = rawToken.trim();
    if (!token) continue;

    const markerPattern = `\\((?:${escapeRegExp(dict.markers.augmented)}|${escapeRegExp(dict.markers.unmet)})\\)`;
    const valueFirst = new RegExp(`^(\\d+)(?:\\s+${markerPattern})?\\s+(.+)$`).exec(token);
    const labelFirst = new RegExp(`^(.+?)\\s+(\\d+)(?:\\s+${markerPattern})?$`).exec(token);

    let key: Requirement['key'] = 'unknown';
    let value = 0;
    let unmet = false;
    let augmented = false;

    if (valueFirst) {
      value = Number(valueFirst[1]);
      key = dict.requirements[(valueFirst[2] ?? '').trim()] ?? 'unknown';
    } else if (labelFirst) {
      key = dict.requirements[(labelFirst[1] ?? '').trim()] ?? 'unknown';
      value = Number(labelFirst[2]);
    } else {
      warnings.push(`Не удалось разобрать требование: "${token}"`);
      continue;
    }

    unmet = new RegExp(`\\(${escapeRegExp(dict.markers.unmet)}\\)`).test(token);
    augmented = new RegExp(`\\(${escapeRegExp(dict.markers.augmented)}\\)`).test(token);
    if (key === 'unknown') {
      warnings.push(`Неизвестное требование: "${token}"`);
    }

    requirements.push({
      key,
      value,
      ...(unmet ? { unmet: true } : {}),
      ...(augmented ? { augmented: true } : {}),
    });
  }

  return { requirements, warnings };
}

/** "Уровень предмета: 80" → 80. */
export function parseItemLevel(line: string, dict: LocaleDictionary): number | null {
  const prefix = `${dict.labels.itemLevel}:`;
  if (!line.trim().startsWith(prefix)) return null;
  const value = line.trim().slice(prefix.length).trim();
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/** "Гнезда: S S" → ["S", "S"]. */
export function parseSockets(line: string, dict: LocaleDictionary): string[] | null {
  const prefix = `${dict.labels.sockets}:`;
  if (!line.trim().startsWith(prefix)) return null;
  return line
    .trim()
    .slice(prefix.length)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseNumericValue(value: string): number | null {
  const normalized = value
    .replace(/[^0-9.,+-]/g, '')
    .replace(',', '.');
  const result = Number.parseFloat(normalized);
  return Number.isFinite(result) ? result : null;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

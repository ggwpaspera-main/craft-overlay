import raw from '../../../data/filter-base-tiers.json';

/**
 * Базы, которые NeverSink-фильтр (0.10.4, 3-STRICT) подсвечивает как ценные.
 * Это prior, а не окончательная оценка: он не знает про роллы, открытые слоты
 * и крафт-действия.
 */

export type FilterBaseTier = 't1' | 't2' | 't3' | 'exceptional' | 'economy';

export interface FilterBaseEntry {
  en: string;
  ru: string | null;
  slug: string | null;
  class: string | null;
  category: string | null;
  source?: string;
}

interface CompactBaseEntry extends FilterBaseEntry {
  tier: FilterBaseTier;
}

export interface FilterBaseInfo {
  tier: FilterBaseTier;
  tierLabel: string;
  entry: FilterBaseEntry;
}

interface FilterPriorsFile {
  meta: {
    version: string | null;
    type: string | null;
    style: string | null;
    generatedAt: string;
  };
  bases: CompactBaseEntry[];
}

const data = raw as unknown as FilterPriorsFile;

export const filterMeta = data.meta;

const TIER_LABEL: Record<FilterBaseTier, string> = {
  t1: 'T1 (топовая база)',
  t2: 'T2 (сильная база)',
  t3: 'T3 (средняя база)',
  exceptional: 'исключительная база',
  economy: 'экономическая база',
};

// Порядок в файле уже задан генератором: T1 → exceptional → T2 → T3 → economy.

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

const index = new Map<string, FilterBaseInfo>();

for (const entry of data.bases) {
  const keys = [entry.ru, entry.en, entry.slug]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(normalize);
  for (const key of keys) {
    if (!key || index.has(key)) continue;
    index.set(key, { tier: entry.tier, tierLabel: TIER_LABEL[entry.tier], entry });
  }
}

export function filterBaseInfo(baseType: string | undefined): FilterBaseInfo | null {
  if (!baseType) return null;
  return index.get(normalize(baseType)) ?? null;
}

export function filterTierLabel(tier: FilterBaseTier): string {
  return TIER_LABEL[tier];
}

import type { ParsedItem } from '../types';
import { statTemplate, statValues } from './modpool';

/** Формат data/socketables.json. */
export interface SocketablesData {
  items: Socketable[];
}

export interface Socketable {
  id: string;
  kind: 'rune' | 'core' | 'idol';
  name: string;
  effects: Array<{ slot: string; text: string }>;
}

export interface SocketGoal {
  text: string;
  status: 'have' | 'need' | 'special';
  /** Что вставить, если вставка опознана. */
  use?: { id: string; name: string; count: number };
}

/** Завершающий шаг без случайности: вставка, гнездо, качество. */
export interface FinishUse {
  id: string;
  label: string;
  count: number;
}

const SLOT_SUBTYPES: Record<string, (item: ParsedItem) => boolean> = {
  'всё снаряжение': () => true,
  оружие: (item) => item.category === 'weapon',
  'боевое оружие': (item) => item.category === 'weapon' && !isCaster(item),
  'чародейское оружие': isCaster,
  жезл: (item) => item.subtype === 'wand',
  жезлы: (item) => item.subtype === 'wand',
  посох: (item) => item.subtype === 'staff',
  посохи: (item) => item.subtype === 'staff',
  доспехи: (item) => item.category === 'armour' || item.category === 'offhand',
  'нательные доспехи': (item) => item.subtype === 'bodyArmour',
  шлемы: (item) => item.subtype === 'helmet',
  перчатки: (item) => item.subtype === 'gloves',
  обувь: (item) => item.subtype === 'boots',
  скипетры: (item) => item.subtype === 'sceptre',
  луки: (item) => item.subtype === 'bow',
  щиты: (item) => item.subtype === 'shield',
  баклеры: (item) => item.subtype === 'buckler',
  'щиты и баклеры': (item) => item.subtype === 'shield' || item.subtype === 'buckler',
  фокусы: (item) => item.subtype === 'focus',
  талисманы: (item) => item.subtype === 'talisman',
  копья: (item) => item.subtype === 'spear',
  'копьё': (item) => item.subtype === 'spear',
  самострелы: (item) => item.subtype === 'crossbow',
  'двуручные булавы': (item) => item.subtype === 'twoHandMace',
  'одноручные булавы': (item) => item.subtype === 'oneHandMace',
  'одноручная булава': (item) => item.subtype === 'oneHandMace',
  'боевые посохи': (item) => item.subtype === 'quarterstaff',
  'боевой посох': (item) => item.subtype === 'quarterstaff',
};

function isCaster(item: ParsedItem): boolean {
  return item.subtype === 'wand' || item.subtype === 'staff';
}

function fits(slot: string, item: ParsedItem): boolean {
  return slot
    .toLowerCase()
    .split(' или ')
    .some((part) => SLOT_SUBTYPES[part.trim()]?.(item) ?? false);
}

interface Option {
  socketable: Socketable;
  count: number;
}

/** Строка может быть суммой одинаковых рун: +22% — это две руны по +11%. */
function optionsFor(
  line: { text: string },
  item: ParsedItem,
  data: SocketablesData,
  maxCount: number,
): Option[] {
  const template = statTemplate(line.text);
  const value = statValues(line.text)[0] ?? 0;

  return data.items.flatMap((socketable) =>
    socketable.effects
      .filter((effect) => fits(effect.slot, item))
      .flatMap((effect) => effect.text.split(/,\s+(?=[+\d\p{Lu}])/u))
      .filter((effect) => statTemplate(effect) === template)
      .flatMap((effect) => {
        const single = statValues(effect)[0] ?? 0;
        const count = single > 0 ? Math.max(1, Math.ceil(value / single - 1e-9)) : 1;
        return count <= maxCount ? [{ socketable, count }] : [];
      }),
  );
}

export function readSocketGoals(
  target: ParsedItem,
  item: ParsedItem,
  data: SocketablesData,
  tolerance: number,
  prices: Record<string, number>,
): SocketGoal[] {
  const sockets = Math.max(1, target.sockets.length);

  return target.runes.map((line) => {
    const template = statTemplate(line.text);
    const wanted = (statValues(line.text)[0] ?? 0) * (1 - tolerance);
    const present = item.runes.some(
      (own) => statTemplate(own.text) === template && (statValues(own.text)[0] ?? 0) >= wanted,
    );
    if (present) return { text: line.text, status: 'have' as const };

    const cost = (option: Option): number =>
      (prices[option.socketable.id] ?? Number.POSITIVE_INFINITY) * option.count;
    const [best] = optionsFor(line, target, data, sockets).sort((a, b) => cost(a) - cost(b));
    if (!best) return { text: line.text, status: 'special' as const };
    return {
      text: line.text,
      status: 'need' as const,
      use: { id: best.socketable.id, name: best.socketable.name, count: best.count },
    };
  });
}

const CATALYST_BY_QUALITY: Array<[RegExp, string]> = [
  [/чародейск/i, 'sibilant-catalyst'],
  [/здоров/i, 'flesh-catalyst'],
  [/ман/i, 'neural-catalyst'],
  [/защит|брон|уклон|щит/i, 'carapace-catalyst'],
  [/физическ/i, 'uul-netols-catalyst'],
  [/огн/i, 'xophs-catalyst'],
  [/холод/i, 'tuls-catalyst'],
  [/молни/i, 'eshs-catalyst'],
  [/хаос/i, 'chayulas-catalyst'],
  [/атак/i, 'reaver-catalyst'],
  [/скорост/i, 'skittering-catalyst'],
  [/характеристик/i, 'adaptive-catalyst'],
  [/приспешник/i, 'necrotic-catalyst'],
];

const CATALYST_NAMES: Record<string, string> = {
  'sibilant-catalyst': 'Свистящий катализатор',
  'flesh-catalyst': 'Плотский катализатор',
  'neural-catalyst': 'Невральный катализатор',
  'carapace-catalyst': 'Панцирный катализатор',
  'uul-netols-catalyst': 'Катализатор Уул-Нетол',
  'xophs-catalyst': 'Катализатор Ксофа',
  'tuls-catalyst': 'Катализатор Тул',
  'eshs-catalyst': 'Катализатор Иш',
  'chayulas-catalyst': 'Катализатор Чаюлы',
  'reaver-catalyst': 'Разбойничий катализатор',
  'skittering-catalyst': 'Шуршащий катализатор',
  'adaptive-catalyst': 'Адаптивный катализатор',
  'necrotic-catalyst': 'Некротический катализатор',
};

/**
 * Качество катализаторами у образца, которого нет у предмета.
 * shortcut: один катализатор считается за 1% качества, максимум 20 штук; уточнить по игре.
 */
function catalystUse(target: ParsedItem, item: ParsedItem): FinishUse | null {
  const type = target.qualityType;
  if (!type || !target.quality || item.qualityType === type) return null;
  if (target.category !== 'jewellery' && target.category !== 'jewel') return null;

  const id = CATALYST_BY_QUALITY.find(([pattern]) => pattern.test(type))?.[1];
  if (!id) return null;
  const refined = target.category === 'jewel';
  return {
    id: refined ? `refined-${id}` : id,
    label: `${refined ? 'Очищенный: ' : ''}${CATALYST_NAMES[id] ?? id}`,
    count: Math.min(20, target.quality),
  };
}

/** Детерминированные шаги после крафта модов. */
export function finishUses(target: ParsedItem, item: ParsedItem, goals: SocketGoal[]): FinishUse[] {
  const uses: FinishUse[] = [];

  const filled = goals.reduce((sum, goal) => sum + (goal.use?.count ?? 0), 0);
  const haveFilled = goals.filter((goal) => goal.status === 'have').length;
  const socketsNeeded = Math.max(target.sockets.length, filled + haveFilled);
  const missing = socketsNeeded - item.sockets.length;
  if (missing > 0) uses.push({ id: 'artificers', label: 'Сфера астромантии', count: missing });

  for (const goal of goals) {
    if (goal.use) uses.push({ id: goal.use.id, label: goal.use.name, count: goal.use.count });
  }

  const catalyst = catalystUse(target, item);
  if (catalyst) uses.push(catalyst);
  return uses;
}

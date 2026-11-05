/**
 * Модель данных парсера предметов PoE2.
 *
 * Канонические ключи — всегда английские; исходные локализованные строки
 * сохраняются рядом (label, headerRaw, tags), чтобы ничего не терять.
 *
 * Формат и примеры: docs/FORMAT-RU.md.
 */

export type Locale = 'ru' | 'en';

export type ItemCategory =
  | 'weapon'
  | 'armour'
  | 'offhand'
  | 'jewellery'
  | 'flask'
  | 'charm'
  | 'jewel'
  | 'gem'
  | 'currency'
  | 'rune'
  | 'waystone'
  | 'tablet'
  | 'trap'
  | 'relic'
  | 'quest'
  | 'unknown';

export type Rarity =
  | 'normal'
  | 'magic'
  | 'rare'
  | 'unique'
  | 'gem'
  | 'currency'
  | 'unknown';

/** Откуда взялся мод: явный, имплисит, уникальный, энчант, коррапт или руна. */
export type ModifierSource =
  | 'explicit'
  | 'implicit'
  | 'unique'
  | 'enchantment'
  | 'corrupted'
  | 'rune'
  | 'unknown';

/** Тип аффикса. У имплиситов/уникальных/рун — 'none'. */
export type AffixKind = 'prefix' | 'suffix' | 'none';

export type ModifierState =
  | 'fractured'
  | 'desecrated'
  | 'crafted'
  | 'sanctified'
  | 'unmodifiable'
  | 'unknown';

/** Одно числовое значение в строке стата: ролл и, если есть, диапазон. */
export interface ModValue {
  /** Как в тексте: "42(39-42)%" */
  raw: string;
  /** Ролл: 42. null, если ролл не указан (только диапазон). */
  rolled: number | null;
  min?: number;
  max?: number;
}

/** Одна строка стата внутри аффикса. */
export interface StatLine {
  /** Исходная строка. */
  raw: string;
  /** Строка без диапазонов и маркеров: "42% увеличение энергетического щита". */
  text: string;
  values: ModValue[];
  /** true, если был маркер "— Неизменяемое значение" (фиксированное значение). */
  fixedValue?: boolean;
}

/**
 * Группа модов. Один advanced-заголовок может давать несколько строк
 * (hybrid-аффиксы), поэтому строки лежат в lines[].
 */
export interface ModifierGroup {
  source: ModifierSource;
  kind: AffixKind;
  /** Исходный заголовок целиком. */
  headerRaw: string;
  affixName?: string;
  tier?: number;
  /** Локализованные теги, как в тексте. */
  tags: string[];
  /** Дополнительная пометка после второго тире: "40% увеличение". */
  annotation?: string;
  states: ModifierState[];
  lines: StatLine[];
}

export interface ItemProperty {
  /** Канонический ключ: energyShield, waystoneRevives, ... */
  key: string;
  /** Локализованная метка, как в тексте. */
  label: string;
  /** Значения как строки: ["512"], ["+22%"]. */
  values: string[];
  /** Был ли маркер "(augmented)". */
  augmented?: boolean;
}

export interface Requirement {
  key: 'level' | 'str' | 'dex' | 'int' | 'unknown';
  value: number;
  /** Маркер невыполненного требования, если встретился. */
  unmet?: boolean;
  /** Маркер "(augmented)" — значение изменено модами/качеством. */
  augmented?: boolean;
}

export interface ItemFlags {
  corrupted?: boolean;
  doubleCorrupted?: boolean;
  fractured?: boolean;
  desecrated?: boolean;
  sanctified?: boolean;
  mirrored?: boolean;
  split?: boolean;
  unmodifiable?: boolean;
  unidentified?: boolean;
}

export interface ParsedItem {
  /** Исходный текст целиком — для отладки и повторного разбора. */
  raw: string;
  locale: Locale;
  parserVersion: string;

  itemClass: string;
  category: ItemCategory;
  /** Подтип внутри категории: helmet, boots, amulet, ... */
  subtype?: string;
  rarity: Rarity;

  /** Имя редкого/уникального предмета. */
  name?: string;
  /** База: "Тиара Камасы", "Путевой камень". */
  baseType?: string;

  itemLevel?: number;
  quality?: number;
  /** Тип качества: "чародейские свойства" и т.п. */
  qualityType?: string;
  /** Тир путевого камня из базы "(Ур. 15)". */
  waystoneTier?: number;
  stackSize?: number;

  properties: ItemProperty[];
  requirements: Requirement[];
  /** Токены из "Гнезда: S S". */
  sockets: string[];

  /** Строки "Дарует умение: ...". */
  grantedSkills: string[];

  modifiers: ModifierGroup[];
  /** Руны: строки с "(rune)". */
  runes: StatLine[];

  /** Лор уникального предмета. */
  flavourText?: string[];
  /** Описание путевого камня/предмета. */
  description?: string[];

  flags: ItemFlags;

  /** Строки, которые не удалось классифицировать. */
  unknownLines: string[];
  warnings: string[];
}

export interface ParseResult {
  ok: boolean;
  item: ParsedItem | null;
  warnings: string[];
  unknownLines: string[];
}

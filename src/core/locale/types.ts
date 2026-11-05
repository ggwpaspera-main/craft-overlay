import type {
  AffixKind,
  ItemCategory,
  ItemFlags,
  ModifierSource,
  ModifierState,
  Rarity,
} from '../types';

/** Все локализуемые строки и паттерны одного языка. */
export interface LocaleDictionary {
  locale: 'ru' | 'en';
  labels: {
    itemClass: string;
    rarity: string;
    requirements: string;
    sockets: string;
    itemLevel: string;
    quality: string;
    stackSize: string;
    tier: string;
    /** "Дарует умение" — строка выданного умения. */
    grantedSkill: string;
  };
  rarities: Record<string, Rarity>;
  itemClasses: Record<string, { category: ItemCategory; subtype?: string }>;
  modifierKinds: Record<string, { source: ModifierSource; kind: AffixKind }>;
  modifierStates: Record<string, ModifierState>;
  properties: Record<string, string>;
  requirements: Record<string, 'level' | 'str' | 'dex' | 'int'>;
  flags: Record<string, keyof ItemFlags>;
  markers: {
    augmented: string;
    rune: string;
    fixedValue: string;
    unmet: string;
  };
}

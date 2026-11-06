import type { ModifierGroup, ParsedItem, StatLine } from '../types';
import { resolveFilterBase } from '../filter/priors';

/**
 * Крафт-советник (пробный режим).
 *
 * Это НЕ оценка цены и не «ИИ-мнение»: правила по модам, семействам модов,
 * тирам и открытым слотам. Оценка не привязана к конкретному билду —
 * используются универсальные целевые семейства для слота/типа предмета.
 */

export type AdviceVerdict = 'good' | 'neutral' | 'bad' | 'unknown';

export type AdviceMode =
  | 'equipment'
  | 'flask'
  | 'jewel'
  | 'charm'
  | 'waystone'
  | 'tablet'
  | 'relic';

export type ModFamily =
  | 'skillLevels'
  | 'spellDamage'
  | 'physicalDamage'
  | 'addedDamage'
  | 'defencePercent'
  | 'defenceFlat'
  | 'life'
  | 'mana'
  | 'spirit'
  | 'resistance'
  | 'chaosResistance'
  | 'attributes'
  | 'movementSpeed'
  | 'attackSpeed'
  | 'castSpeed'
  | 'critChance'
  | 'critMulti'
  | 'esRecharge'
  | 'thorns'
  | 'stunThreshold'
  | 'ailmentDuration'
  | 'attributeRequirements'
  | 'lifeRegen'
  | 'flaskCharge'
  | 'flaskDuration'
  | 'flaskEffect'
  | 'charmEffect'
  | 'charmDuration'
  | 'quantity'
  | 'rarity'
  | 'packSize'
  | 'monsterEffectiveness'
  | 'waystoneDrop'
  | 'damage'
  | 'unknown';

export interface AdviceMod {
  kind: 'prefix' | 'suffix' | 'unknown';
  text: string;
  tier?: number;
  verdict: AdviceVerdict;
  reason: string;
  families: ModFamily[];
  esChannel?: EsChannel;
}

export type EsChannel = 'flat' | 'percent' | 'hybrid' | 'hybridLife' | 'spirit';

export interface AdviceCounts {
  prefixes: number;
  suffixes: number;
  openPrefixes: number;
  openSuffixes: number;
  good: number;
  neutral: number;
  bad: number;
}

export type ShortVerdictTone = 'good' | 'bad' | 'warn' | 'info';

export interface ShortVerdict {
  tone: ShortVerdictTone;
  title: string;
  reason: string;
  action: string;
}

export type ResistanceElement = 'fire' | 'cold' | 'lightning' | 'chaos';

export interface EssenceAdvice {
  element: ResistanceElement;
  name: string;
  effect: string;
  shortAction: string;
}

export interface AbyssAdvice {
  title: string;
  recipe: string[];
  action: string;
}

export type EsBodyVerdict =
  | 'junk'
  | 'playable'
  | 'keep'
  | 'white'
  | 'magic'
  | 'incomplete'
  | 'finishable'
  | 'base-good'
  | 'base-acceptable'
  | 'base-bad'
  | 'unknown';

export interface EsBodyAdvice {
  es: number;
  quality: number | null;
  sockets: number;
  runes: number;
  baseTier: string | null;
  baseTierLabel: string | null;
  planLabel: string;
  targetEs: number;
  projectedEs: number;
  qualityOnlyEs: number;
  runesOnlyEs: number;
  qualityGain: number;
  runeGain: number;
  isFinished: boolean;
  verdict: EsBodyVerdict;
  checks: string[];
}

export interface CraftAdvice {
  supported: boolean;
  profile: string;
  summary: string;
  steps: string[];
  targetPrefixes: string[];
  targetSuffixes: string[];
  mods: AdviceMod[];
  counts: AdviceCounts;
  warnings: string[];
  esBody?: EsBodyAdvice;
  shortVerdict?: ShortVerdict;
  essenceAdvice?: EssenceAdvice;
  abyssAdvice?: AbyssAdvice;
}

interface AdviceProfile {
  id: string;
  label: string;
  targetPrefixes: string[];
  targetSuffixes: string[];
  targetPrefixFamilies: ModFamily[];
  targetSuffixFamilies: ModFamily[];
  mode: AdviceMode;
}

interface FamilyRule {
  family: ModFamily;
  pattern: RegExp;
}

const FAMILY_RULES: FamilyRule[] = [
  // Статы приспешников и союзников не усиливают самого персонажа.
  { family: 'unknown', pattern: /^(приспешники|союзники|компаньоны)/i },
  { family: 'skillLevels', pattern: /к уровню (всех )?камней умений|к уровню .*камней умений/i },
  { family: 'spellDamage', pattern: /урона? от чар/i },
  // Шипы и «добавляет» раньше physicalDamage: оба текста содержат «физического урона».
  { family: 'thorns', pattern: /шипами/i },
  { family: 'addedDamage', pattern: /дополнительного урона|добавляет .*урона/i },
  { family: 'physicalDamage', pattern: /физического урона/i },
  {
    family: 'defencePercent',
    pattern: /(увеличение|повышение) (максимума )?(брони|уклонения|энергетического щита)/i,
  },
  {
    family: 'defenceFlat',
    pattern: /к (броне|уклонению|максимуму энергетического щита)/i,
  },
  {
    family: 'life',
    pattern: /к максимуму здоровья|увеличение максимума здоровья(?! компаньонов| подношений)/i,
  },
  { family: 'mana', pattern: /к максимуму маны|увеличение максимума маны/i },
  { family: 'spirit', pattern: /к духу|увеличение духа/i },
  { family: 'chaosResistance', pattern: /к (максимальному )?сопротивлению хаосу/i },
  {
    family: 'resistance',
    pattern:
      /к (максимальному )?сопротивлению (огню|холоду|молнии|всем стихиям)|к сопротивлениям|к максимуму сопротивлений/i,
  },
  { family: 'attributes', pattern: /ко? (силе|ловкости|интеллекту|всем характеристикам)/i },
  { family: 'movementSpeed', pattern: /скорости передвижения/i },
  { family: 'attackSpeed', pattern: /скорости атаки/i },
  { family: 'castSpeed', pattern: /скорости сотворения чар/i },
  { family: 'critChance', pattern: /шанса критического удара|шансу критического удара/i },
  {
    family: 'critMulti',
    pattern: /бонусу критического урона|бонуса к критическому урону(?! приспешников)/i,
  },
  { family: 'esRecharge', pattern: /(скорости|начала) перезарядки энергетического щита/i },
  { family: 'stunThreshold', pattern: /оглушени/i },
  { family: 'ailmentDuration', pattern: /длительности (кровотечения|отравления)/i },
  { family: 'attributeRequirements', pattern: /снижение требований к характеристикам/i },
  { family: 'lifeRegen', pattern: /регенерация .*здоровья/i },
  { family: 'flaskCharge', pattern: /зарядов|восполнения зарядов/i },
  // Длительность оберега раньше flaskDuration и charmEffect: иначе её текст перехватят они.
  { family: 'charmDuration', pattern: /длительности эффекта оберега/i },
  { family: 'flaskDuration', pattern: /длительности эффекта/i },
  { family: 'flaskEffect', pattern: /эффекта флакона|эффективности флакона/i },
  { family: 'charmEffect', pattern: /эффекта оберега|эффективности оберега/i },
  { family: 'quantity', pattern: /количества находимых предметов/i },
  { family: 'rarity', pattern: /редкости найденных предметов/i },
  { family: 'packSize', pattern: /размер групп монстров/i },
  { family: 'monsterEffectiveness', pattern: /эффективность монстров/i },
  { family: 'waystoneDrop', pattern: /выпадения путевого камня/i },
  { family: 'damage', pattern: /увеличение урона/i },
];

const BAD_FAMILIES = new Set<ModFamily>([
  'thorns',
  'stunThreshold',
  'ailmentDuration',
  'attributeRequirements',
  'lifeRegen',
]);

function familyOf(text: string): ModFamily {
  for (const rule of FAMILY_RULES) {
    if (rule.pattern.test(text)) return rule.family;
  }
  return 'unknown';
}

/** Гибридный мод может давать два целевых семейства сразу. */
function familiesOfGroup(group: ModifierGroup): ModFamily[] {
  return [...new Set(group.lines.map((line) => familyOf(line.text)).filter((family) => family !== 'unknown'))];
}

/** Три отдельных ES-канала + гибрид с жизнью и дух. */
function esChannelOf(families: ModFamily[]): EsChannel | undefined {
  const hasFlat = families.includes('defenceFlat');
  const hasPercent = families.includes('defencePercent');
  const hasLife = families.includes('life');
  if (hasLife) return hasFlat || hasPercent ? 'hybridLife' : undefined;
  if (hasFlat && hasPercent) return 'hybrid';
  if (hasFlat) return 'flat';
  if (hasPercent) return 'percent';
  if (families.includes('spirit')) return 'spirit';
  return undefined;
}

function esTierVerdict(channel: EsChannel, tier: number | undefined): AdviceVerdict {
  if (tier === undefined) return 'neutral';
  if (channel === 'hybridLife') return tier <= 2 ? 'neutral' : 'bad';
  if (channel === 'spirit') {
    if (tier <= 2) return 'good';
    if (tier === 3) return 'neutral';
    return 'bad';
  }
  if (tier <= 3) return 'good';
  return 'bad';
}

const ES_CHANNEL_LABEL: Record<EsChannel, string> = {
  flat: 'flat ES',
  percent: '%ES',
  hybrid: 'гибрид flat+%ES',
  hybridLife: 'гибрид ES+жизнь',
  spirit: 'дух',
};

interface EsPrefixPlan {
  label: string;
  targets: EsChannel[];
  threshold: number;
}

function esPrefixPlan(channels: EsChannel[]): EsPrefixPlan {
  if (channels.includes('spirit')) {
    return { label: 'дух + flat ES + %ES', targets: ['flat', 'percent'], threshold: 650 };
  }
  if (channels.includes('hybridLife')) {
    return {
      label: 'гибрид ES+жизнь + flat ES + %ES',
      targets: ['flat', 'percent'],
      threshold: 800,
    };
  }
  return {
    label: 'flat ES + %ES + гибрид flat+%ES',
    targets: ['flat', 'percent', 'hybrid'],
    threshold: 800,
  };
}

const TIER_GOOD_MAX = 3;
const TIER_NEUTRAL_MAX = 3;

const FAMILY_LABEL: Partial<Record<ModFamily, string>> = {
  defencePercent: '% защиты/ЭЩ',
  defenceFlat: 'флэт защиты/ЭЩ',
  life: 'жизнь',
  mana: 'мана',
  spirit: 'дух',
  resistance: 'резисты',
  chaosResistance: 'хаос-рез',
  attributes: 'атрибуты',
  movementSpeed: 'скорость передвижения',
  attackSpeed: 'скорость атаки',
  castSpeed: 'скорость каста',
  critChance: 'шанс крита',
  critMulti: 'крит-множитель',
  esRecharge: 'перезарядка ЭЩ',
  skillLevels: '+скиллы',
  spellDamage: 'урон от чар',
  physicalDamage: 'физ. урон',
  addedDamage: 'добавленный урон',
  flaskEffect: 'эффект флякона',
  flaskDuration: 'длительность флякона',
  flaskCharge: 'заряды флякона',
  charmEffect: 'эффект оберега',
  charmDuration: 'длительность оберега',
  quantity: 'количество',
  rarity: 'редкость',
  packSize: 'размер групп',
  monsterEffectiveness: 'эффективность монстров',
  waystoneDrop: 'дроп waystone',
  damage: 'урон',
};

function familyLabel(family: ModFamily): string {
  return FAMILY_LABEL[family] ?? family;
}

function tierVerdict(tier: number | undefined): AdviceVerdict {
  if (tier === undefined) return 'neutral';
  if (tier <= TIER_GOOD_MAX) return 'good';
  if (tier <= TIER_NEUTRAL_MAX) return 'neutral';
  return 'bad';
}

function unsupported(summary: string, warnings: string[] = []): CraftAdvice {
  return {
    supported: false,
    profile: 'Советник',
    summary,
    steps: [],
    targetPrefixes: [],
    targetSuffixes: [],
    mods: [],
    counts: {
      prefixes: 0,
      suffixes: 0,
      openPrefixes: 0,
      openSuffixes: 0,
      good: 0,
      neutral: 0,
      bad: 0,
    },
    warnings,
  };
}

function numericProperty(item: ParsedItem, key: string): number {
  const property = item.properties.find((entry) => entry.key === key);
  if (!property) return 0;
  const raw = property.values.join(' ').replace(',', '.');
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function groupText(group: ModifierGroup): string {
  return group.lines.map((line) => line.text).filter(Boolean).join(' / ') || group.headerRaw;
}

function defenceLabel(item: ParsedItem): string {
  const parts: string[] = [];
  if (numericProperty(item, 'energyShield') > 0) parts.push('ЭЩ');
  if (numericProperty(item, 'armour') > 0) parts.push('броня');
  if (numericProperty(item, 'evasion') > 0) parts.push('уклонение');
  return parts.length > 0 ? parts.join(' + ') : 'защита';
}

function equipmentProfile(
  item: ParsedItem,
  label: string,
  targetPrefixes: string[],
  targetSuffixes: string[],
  targetPrefixFamilies: ModFamily[],
  targetSuffixFamilies: ModFamily[],
): AdviceProfile {
  return {
    id: label,
    label,
    targetPrefixes,
    targetSuffixes,
    targetPrefixFamilies,
    targetSuffixFamilies,
    mode: 'equipment',
  };
}

function armourProfile(item: ParsedItem): AdviceProfile {
  const defence = defenceLabel(item);
  const slotLabel: Record<string, string> = {
    bodyArmour: 'Нательный доспех',
    helmet: 'Шлем',
    gloves: 'Перчатки',
    boots: 'Обувь',
    shield: 'Щит',
    buckler: 'Баклер',
  };
  const slot = slotLabel[item.subtype ?? ''] ?? item.itemClass;
  const hasEs = numericProperty(item, 'energyShield') > 0;
  const prefixLabels = hasEs
    ? [`% повышение ${defence}`, `+N к ${defence}`, '+N к духу']
    : [
        `% повышение ${defence}`,
        `+N к ${defence}`,
        '+N к максимуму здоровья',
        '+N к духу',
      ];
  const prefixFamilies: ModFamily[] = hasEs
    ? ['defencePercent', 'defenceFlat', 'spirit']
    : ['defencePercent', 'defenceFlat', 'life', 'spirit'];
  const suffixLabels = [
    '+N% к сопротивлению огню / холоду / молнии',
    '+N% к сопротивлению хаосу',
    '+N к силе / ловкости / интеллекту',
  ];
  const suffixFamilies: ModFamily[] = ['resistance', 'chaosResistance', 'attributes'];

  if (item.subtype === 'boots') {
    suffixLabels.push('30–35% повышение скорости передвижения');
    suffixFamilies.push('movementSpeed');
  }
  if (item.subtype === 'gloves') {
    suffixLabels.push('скорость атаки / скорость сотворения чар');
    suffixFamilies.push('attackSpeed', 'castSpeed');
  }
  if (numericProperty(item, 'energyShield') > 0) {
    suffixLabels.push('повышение скорости перезарядки ЭЩ');
    suffixFamilies.push('esRecharge');
  }

  return equipmentProfile(
    item,
    `${slot} · ${defence}`,
    prefixLabels,
    suffixLabels,
    prefixFamilies,
    suffixFamilies,
  );
}

function weaponProfile(item: ParsedItem): AdviceProfile {
  const caster = item.subtype === 'wand' || item.subtype === 'staff' || item.subtype === 'sceptre';
  if (caster) {
    return equipmentProfile(
      item,
      `${item.itemClass} · кастер`,
      [
        '% увеличение урона от чар',
        '+N к максимуму маны',
        '+N к духу',
        'добавляет урон от чар / элемента',
      ],
      [
        'скорость сотворения чар',
        'шанс критического удара',
        'бонус критического урона',
        '+N к уровню всех камней умений',
      ],
      ['spellDamage', 'mana', 'spirit', 'addedDamage'],
      ['castSpeed', 'critChance', 'critMulti', 'skillLevels'],
    );
  }
  return equipmentProfile(
    item,
    `${item.itemClass} · атака`,
    [
      '% увеличение физического урона',
      'добавляет физический / элементарный урон',
      '+N к максимуму здоровья',
    ],
    [
      'скорость атаки',
      'шанс критического удара',
      'бонус критического урона',
      '+N к уровню всех камней умений',
    ],
    ['physicalDamage', 'addedDamage', 'life'],
    ['attackSpeed', 'critChance', 'critMulti', 'skillLevels'],
  );
}

function offhandProfile(item: ParsedItem): AdviceProfile {
  if (item.subtype === 'focus') {
    return equipmentProfile(
      item,
      'Фокус · ЭЩ',
      ['% повышение ЭЩ', '+N к ЭЩ', '+N к духу', '+N к максимуму маны'],
      [
        'скорость сотворения чар',
        'шанс критического удара',
        'бонус критического урона',
        '+N к уровню всех камней умений',
        '+N% к сопротивлению',
      ],
      ['defencePercent', 'defenceFlat', 'spirit', 'mana'],
      ['castSpeed', 'critChance', 'critMulti', 'skillLevels', 'resistance'],
    );
  }
  if (item.subtype === 'quiver') {
    return equipmentProfile(
      item,
      'Колчан · атака',
      ['% увеличение физического урона', 'добавляет физический / элементарный урон', '+N к максимуму здоровья'],
      ['скорость атаки', 'шанс критического удара', 'бонус критического урона', '+N% к сопротивлению'],
      ['physicalDamage', 'addedDamage', 'life'],
      ['attackSpeed', 'critChance', 'critMulti', 'resistance'],
    );
  }
  return armourProfile(item);
}

function jewelleryProfile(item: ParsedItem): AdviceProfile {
  return equipmentProfile(
    item,
    `${item.itemClass} · универсальные`,
    [
      '+N к максимуму здоровья',
      '+N к максимуму маны',
      '+N к духу',
      'добавляет физический / элементарный урон',
    ],
    [
      '+N% к сопротивлению огню / холоду / молнии',
      '+N% к сопротивлению хаосу',
      '+N к силе / ловкости / интеллекту',
      'скорость атаки / сотворения чар',
      'шанс критического удара',
      '+N к уровню всех камней умений',
    ],
    ['life', 'mana', 'spirit', 'addedDamage'],
    [
      'resistance',
      'chaosResistance',
      'attributes',
      'attackSpeed',
      'castSpeed',
      'critChance',
      'critMulti',
      'skillLevels',
    ],
  );
}

function flaskProfile(item: ParsedItem): AdviceProfile {
  return {
    id: 'flask',
    label: `${item.itemClass} · флакон`,
    targetPrefixes: ['эффект флакона', 'восстановление зарядов'],
    targetSuffixes: ['длительность эффекта', 'эффект флакона'],
    targetPrefixFamilies: ['flaskEffect', 'flaskCharge'],
    targetSuffixFamilies: ['flaskDuration', 'flaskEffect'],
    mode: 'flask',
  };
}

function charmProfile(item: ParsedItem): AdviceProfile {
  return {
    id: 'charm',
    label: `${item.itemClass} · оберег`,
    targetPrefixes: ['эффект оберега', 'заряды оберега'],
    targetSuffixes: ['длительность эффекта оберега', 'эффект оберега'],
    targetPrefixFamilies: ['charmEffect', 'flaskCharge'],
    targetSuffixFamilies: ['charmDuration', 'charmEffect'],
    mode: 'charm',
  };
}

function jewelProfile(item: ParsedItem): AdviceProfile {
  return {
    id: 'jewel',
    label: `${item.itemClass} · самоцвет`,
    targetPrefixes: ['+N к максимуму здоровья', '% увеличение урона', 'добавляет урон'],
    targetSuffixes: [
      '+N% к сопротивлению',
      '+N к атрибутам',
      'скорость атаки / сотворения чар',
      'шанс / бонус критического удара',
    ],
    targetPrefixFamilies: ['life', 'damage', 'physicalDamage', 'spellDamage', 'addedDamage'],
    targetSuffixFamilies: [
      'resistance',
      'attributes',
      'attackSpeed',
      'castSpeed',
      'critChance',
      'critMulti',
      'mana',
    ],
    mode: 'jewel',
  };
}

function waystoneProfile(item: ParsedItem): AdviceProfile {
  return {
    id: 'waystone',
    label: `${item.itemClass} · маппинг`,
    targetPrefixes: [
      'количество находимых предметов',
      'редкость найденных предметов',
      'размер групп монстров',
    ],
    targetSuffixes: [
      'эффективность монстров',
      'шанс выпадения путевого камня',
      'редкость найденных предметов',
    ],
    targetPrefixFamilies: ['quantity', 'rarity', 'packSize'],
    targetSuffixFamilies: ['monsterEffectiveness', 'waystoneDrop', 'rarity'],
    mode: item.category === 'tablet' ? 'tablet' : 'waystone',
  };
}

function relicProfile(item: ParsedItem): AdviceProfile {
  return equipmentProfile(
    item,
    `${item.itemClass} · реликвия`,
    ['+N к максимуму здоровья', '% повышение защиты', '+N к духу'],
    ['+N% к сопротивлению', '+N к атрибутам', 'увеличение урона'],
    ['life', 'defencePercent', 'defenceFlat', 'spirit'],
    ['resistance', 'attributes', 'damage'],
  );
}

function profileFor(item: ParsedItem): AdviceProfile | null {
  switch (item.category) {
    case 'armour':
      return armourProfile(item);
    case 'weapon':
      return weaponProfile(item);
    case 'offhand':
      return offhandProfile(item);
    case 'jewellery':
      return jewelleryProfile(item);
    case 'flask':
      return flaskProfile(item);
    case 'charm':
      return charmProfile(item);
    case 'jewel':
      return jewelProfile(item);
    case 'waystone':
    case 'tablet':
      return waystoneProfile(item);
    case 'relic':
      return relicProfile(item);
    case 'trap':
      return weaponProfile(item);
    default:
      return null;
  }
}

function classify(
  kind: 'prefix' | 'suffix',
  text: string,
  profile: AdviceProfile,
  families: ModFamily[],
  tier: number | undefined,
  esItem: boolean,
  esHasSpirit = false,
): { verdict: AdviceVerdict; reason: string } {
  const family = familyOf(text);
  const allFamilies = families.length > 0 ? families : family === 'unknown' ? [] : [family];
  if (allFamilies.length === 0) {
    return {
      verdict: 'neutral',
      reason: 'мод не распознан — проверь под свой билд',
    };
  }

  if (esItem) {
    if (allFamilies.includes('thorns')) {
      return { verdict: 'bad', reason: 'шипы — мусор для ЭЩ-тушки' };
    }
    const channel = esChannelOf(allFamilies);
    if (!channel && allFamilies.includes('life')) {
      return { verdict: 'bad', reason: 'чистая жизнь — мусор для ЭЩ-тушки' };
    }
    if (channel) {
      if (channel === 'hybrid' && esHasSpirit) {
        return {
          verdict: 'neutral',
          reason: 'при выборе духа гибрид flat+%ES не является целью',
        };
      }
      const verdict = esTierVerdict(channel, tier);
      const label = ES_CHANNEL_LABEL[channel];
      if (verdict === 'good') return { verdict, reason: `${label}, тир ${tier} — хороший` };
      if (verdict === 'neutral') return { verdict, reason: `${label}, тир ${tier} — средний` };
      return { verdict, reason: `${label}, тир ${tier} — плохой` };
    }
  }

  const targets =
    kind === 'prefix' ? profile.targetPrefixFamilies : profile.targetSuffixFamilies;
  const targetFamily = allFamilies.find((candidate) => targets.includes(candidate));
  if (targetFamily) {
    const verdict = tierVerdict(tier);
    if (verdict === 'good') {
      return { verdict, reason: `целевой мод, тир ${tier} — сильный` };
    }
    if (verdict === 'neutral') {
      return {
        verdict,
        reason: tier === undefined ? 'целевой мод, но тир не виден' : `целевой мод, тир ${tier} — средний`,
      };
    }
    return { verdict, reason: `целевой мод, но тир ${tier} — слабый` };
  }

  if (allFamilies.some((candidate) => BAD_FAMILIES.has(candidate))) {
    return { verdict: 'bad', reason: 'слабый мод для этого слота' };
  }
  return { verdict: 'neutral', reason: 'полезно, но не ключевой мод' };
}

function makeSummary(baseLabel: string, itemLevel: number | undefined, action: string): string {
  const level = itemLevel !== undefined ? `, ilvl ${itemLevel}` : '';
  return `${baseLabel}${level}. ${action}`;
}

/** ES-тушка: пороги и проверка качества/рун. Работает только для body armour. */
/** Сумма % increased ES из локальных модов предмета. */
function percentFromLine(line: StatLine): number {
  const fromValues = line.values.reduce((sum, value) => sum + (value.rolled ?? 0), 0);
  if (fromValues > 0) return fromValues;
  const match = line.text.match(/(\d+(?:[.,]\d+)?)%/);
  return match ? Number.parseFloat(match[1]!.replace(',', '.')) : 0;
}

function explicitEsPercent(item: ParsedItem): number {
  let total = 0;
  for (const group of item.modifiers) {
    if (group.source !== 'explicit') continue;
    if (group.kind !== 'prefix' && group.kind !== 'suffix') continue;
    for (const line of group.lines) {
      if (!/(?:увеличение|повышение).*энергетического щита/i.test(line.text)) continue;
      total += percentFromLine(line);
    }
  }
  return total;
}

/** Сумма % increased ES из рун (например, 2×18% = 36%). */
function runeEsPercent(item: ParsedItem): number {
  let total = 0;
  for (const line of item.runes) {
    if (!/(?:увеличение|повышение).*энергетического щита/i.test(line.text)) continue;
    total += percentFromLine(line);
  }
  return total;
}

function projectedEs(
  currentEs: number,
  currentQuality: number,
  targetQuality: number,
  currentRunes: number,
  targetRunes: number,
  esPercent: number,
): number {
  const baseMultiplier = 1 + esPercent / 100;
  const denominator = (baseMultiplier + currentRunes / 100) * (1 + currentQuality / 100);
  if (denominator <= 0) return currentEs;
  const numerator = (baseMultiplier + targetRunes / 100) * (1 + targetQuality / 100);
  return Math.round((currentEs * numerator) / denominator);
}

function buildEsBodyAdvice(item: ParsedItem): EsBodyAdvice | undefined {
  if (item.category !== 'armour' || item.subtype !== 'bodyArmour') return undefined;
  const es = numericProperty(item, 'energyShield');
  if (es <= 0) return undefined;

  const quality = item.quality ?? null;
  const sockets = item.sockets.length;
  const runes = item.runes.length;
  const currentQuality = quality ?? 0;
  const currentRunes = runeEsPercent(item);
  const esPercent = explicitEsPercent(item);
  const targetQuality = Math.max(20, currentQuality);
  const targetRunes = Math.max(36, currentRunes);
  const projected = projectedEs(
    es,
    currentQuality,
    targetQuality,
    currentRunes,
    targetRunes,
    esPercent,
  );
  const qualityOnly = projectedEs(
    es,
    currentQuality,
    targetQuality,
    currentRunes,
    currentRunes,
    esPercent,
  );
  const runesOnly = projectedEs(
    es,
    currentQuality,
    currentQuality,
    currentRunes,
    targetRunes,
    esPercent,
  );
  const qualityGain = qualityOnly - es;
  const runeGain = runesOnly - es;
  const isFinished = currentQuality >= 20 && currentRunes >= 36;
  const base = resolveFilterBase(item.baseType, item.name);
  const prefixChannels = item.modifiers
    .filter(
      (modifier) =>
        modifier.source === 'explicit' && modifier.kind === 'prefix',
    )
    .map((group) => esChannelOf(familiesOfGroup(group)))
    .filter((channel): channel is EsChannel => channel !== undefined);
  const prefixCount = item.modifiers.filter(
    (modifier) => modifier.source === 'explicit' && modifier.kind === 'prefix',
  ).length;
  const plan = esPrefixPlan(prefixChannels);
  const checks: string[] = [];
  let verdict: EsBodyVerdict = 'unknown';

  if (item.rarity === 'normal') {
    verdict = 'white';
    checks.push(`ES ${es} на белой базе — это ещё не итог, сначала 2 мода.`);
    if (base && item.itemLevel !== undefined) {
      if (base.tier === 't1') {
        if (item.itemLevel >= 82) {
          verdict = 'base-good';
          checks.push(`База ${base.entry.en} T1, ilvl ${item.itemLevel} — хорошо.`);
        } else if (item.itemLevel >= 79) {
          verdict = 'base-acceptable';
          checks.push(`База ${base.entry.en} T1, ilvl ${item.itemLevel} — приемлемо.`);
        } else {
          verdict = 'base-bad';
          checks.push(`База ${base.entry.en} T1, ilvl ${item.itemLevel} — плохо для крафта.`);
        }
      } else {
        checks.push(`База ${base.entry.en}, ${base.tierLabel}, ilvl ${item.itemLevel}.`);
      }
    }
  } else if (item.rarity === 'magic') {
    verdict = 'magic';
    checks.push(`ES ${es} — текущий ES magic-предмета; порог ${plan.threshold} к magic не применяем.`);
  } else if (prefixCount < 3) {
    verdict = 'incomplete';
    checks.push(
      `Префиксов: ${prefixCount}/3 — ES ${es} ещё не итог; порог ${plan.threshold} не применяем.`,
    );
    checks.push('Сначала надо добавить префикс: очернение или Exalt.');
  } else {
    const projectedOk = projected > plan.threshold;
    if (es > plan.threshold) {
      if (es <= plan.threshold + 100) {
        verdict = 'playable';
        checks.push(`ES ${es} — план «${plan.label}» пройден; пойдёт для докрафта.`);
      } else {
        verdict = 'keep';
        checks.push(`ES ${es} > ${plan.threshold + 100} — сильный результат, не рероллить.`);
      }
    } else if (!projectedOk) {
      verdict = 'junk';
      checks.push(
        `ES ${es}, прогноз после заточки и рун ${projected} ≤ ${plan.threshold} — неликвид, не вкладывать валюту.`,
      );
    } else if (!isFinished) {
      verdict = 'finishable';
      checks.push(
        `ES ${es} → прогноз ${projected} после 20% качества и 2 рун по 18% ES; порог ${plan.threshold} пройден.`,
      );
    } else {
      verdict = 'junk';
      checks.push(
        `ES ${es} ≤ ${plan.threshold} для плана «${plan.label}» — неликвид, не вкладывать валюту.`,
      );
    }
    checks.push(
      `Заточка 0→20%: ${qualityOnly} ES (${qualityGain >= 0 ? '+' : ''}${qualityGain}); 2 руны по 18% ES: ${runesOnly} ES (${runeGain >= 0 ? '+' : ''}${runeGain}); вместе: ${projected} ES.`,
    );
  }

  if (item.rarity === 'rare') {
    checks.push(`Префиксов: ${prefixCount}/3.`);
  }

  if (item.rarity === 'rare' && prefixChannels.includes('hybridLife')) {
    const flat = item.modifiers.find(
      (group) => group.kind === 'prefix' && esChannelOf(familiesOfGroup(group)) === 'flat',
    );
    const percent = item.modifiers.find(
      (group) => group.kind === 'prefix' && esChannelOf(familiesOfGroup(group)) === 'percent',
    );
    if (!flat || !percent || (flat.tier ?? 99) > 2 || (percent.tier ?? 99) > 2) {
      checks.push('С гибридом ES+жизнь для 800+ нужны отдельные flat ES и %ES не ниже T2.');
    }
  }

  if (quality === null) {
    checks.push('Качество не видно в тексте — проверь заточку в игре.');
  } else if (quality < 20) {
    checks.push(`Качество ${quality}% < 20% — теряешь ES/защиту, сначала заточи.`);
  } else {
    checks.push(`Качество ${quality}% — нормально.`);
  }

  if (sockets === 0) {
    checks.push('Нет сокетов под руны — проверь, можно ли добавить.');
  } else if (runes === 0) {
    checks.push(`Сокеты: ${sockets}, рун: 0 — есть пустые сокеты.`);
  } else {
    checks.push(`Сокеты: ${sockets}, руны вставлены.`);
  }

  if (base) {
    checks.push(`База: ${base.tierLabel} (${base.entry.en}).`);
  } else {
    checks.push('Базы нет в NeverSink T1–T3 — низкий приоритет.');
  }

  return {
    es,
    quality,
    sockets,
    runes,
    baseTier: base?.tier ?? null,
    baseTierLabel: base?.tierLabel ?? null,
    planLabel: plan.label,
    targetEs: plan.threshold,
    projectedEs: projected,
    qualityOnlyEs: qualityOnly,
    runesOnlyEs: runesOnly,
    qualityGain,
    runeGain,
    isFinished,
    verdict,
    checks,
  };
}

function modBrief(mod: AdviceMod): string {
  const kind = mod.kind === 'prefix' ? 'P' : mod.kind === 'suffix' ? 'S' : '?';
  const tier = mod.tier !== undefined ? ` T${mod.tier}` : '';
  return `${kind}${tier} ${mod.text}`;
}

const ESSENCE_BY_ELEMENT: Record<ResistanceElement, Omit<EssenceAdvice, 'element' | 'shortAction'>> = {
  fire: {
    name: 'Большая сущность изоляции',
    effect: '+31–35% к сопротивлению огню (T3)',
  },
  cold: {
    name: 'Большая сущность таяния',
    effect: '+31–35% к сопротивлению холоду (T3)',
  },
  lightning: {
    name: 'Большая сущность заземления',
    effect: '+31–35% к сопротивлению молнии (T3)',
  },
  chaos: {
    name: 'Большая сущность гибели',
    effect: '+16–19% к сопротивлению хаосу (T3)',
  },
};

const RESISTANCE_ORDER: ResistanceElement[] = ['fire', 'cold', 'lightning', 'chaos'];

function resistanceElementsInText(text: string): ResistanceElement[] {
  const lower = text.toLowerCase();
  const elements: ResistanceElement[] = [];
  if (lower.includes('огню')) elements.push('fire');
  if (lower.includes('холоду')) elements.push('cold');
  if (lower.includes('молнии')) elements.push('lightning');
  if (lower.includes('хаосу')) elements.push('chaos');
  return elements;
}

/** Для magic: Большая сущность нужного резиста вместо случайного Regal. */
function recommendEssence(item: ParsedItem, mods: AdviceMod[]): EssenceAdvice | null {
  if (item.rarity !== 'magic') return null;
  if (mods.length < 2) return null;
  if (mods.some((mod) => mod.verdict === 'bad')) return null;
  if (!mods.some((mod) => mod.verdict === 'good')) return null;

  const present = new Set<ResistanceElement>();
  for (const mod of mods) {
    if (mod.kind !== 'suffix') continue;
    for (const element of resistanceElementsInText(mod.text)) present.add(element);
  }

  const missing = RESISTANCE_ORDER.find((element) => !present.has(element));
  if (!missing) return null;
  const essence = ESSENCE_BY_ELEMENT[missing];
  return {
    element: missing,
    ...essence,
    shortAction: `${essence.name} — ${essence.effect}; либо Regal, если хочешь рискнуть ради ES-префикса.`,
  };
}

function buildShortVerdict(
  item: ParsedItem,
  mods: AdviceMod[],
  counts: AdviceCounts,
  esBody: EsBodyAdvice | undefined,
  abyssAdvice: AbyssAdvice | undefined,
  badLimit: number,
  desecratedAlready: boolean,
): ShortVerdict {
  if (item.category === 'waystone' || item.category === 'tablet') {
    return {
      tone: 'info',
      title: 'Оценка модов',
      reason: 'Путевой камень/плитка оцениваются по модам для маппинга.',
      action: 'Смотри подробности: количество, редкость, опасность.',
    };
  }

  const bad = mods.filter((mod) => mod.verdict === 'bad');
  const good = mods.filter((mod) => mod.verdict === 'good');
  const essence = recommendEssence(item, mods);

  if (item.rarity === 'normal') {
    if (esBody?.verdict === 'base-bad') {
      return {
        tone: 'bad',
        title: 'База плохая',
        reason: `T1-база, но ilvl ${item.itemLevel ?? '?'}; для крафта нужен 82+, 79–81 — приемлемо.`,
        action: 'Не крафтить этот экземпляр — искать базу получше.',
      };
    }
    if (esBody?.verdict === 'base-good' || esBody?.verdict === 'base-acceptable') {
      return {
        tone: esBody.verdict === 'base-good' ? 'good' : 'warn',
        title: esBody.verdict === 'base-good' ? 'База хорошая' : 'База приемлемая',
        reason: `T1-база, ilvl ${item.itemLevel ?? '?'}.`,
        action: 'Начинаем: Сфера превращения → Сфера усиления.',
      };
    }
    return {
      tone: 'info',
      title: 'База вне тиров',
      reason: 'Нет уверенного тира базы — оценка предварительная.',
      action: 'Можно попробовать, но без гарантии.',
    };
  }

  if (item.rarity === 'magic') {
    if (mods.length < 2 && counts.bad === 0) {
      const noMods = mods.length === 0;
      return {
        tone: 'info',
        title: noMods ? 'Модов нет' : 'Один мод',
        reason: noMods
          ? 'Волшебный предмет без явных аффиксов.'
          : 'На magic-предмете пока только один аффикс.',
        action: 'Сначала Сфера усиления (Augmentation) — добавить мод.',
      };
    }
    if (bad.length > 0) {
      return {
        tone: 'bad',
        title: 'Есть мусорный мод',
        reason: `${bad.map(modBrief).join('; ')} — мусор.`,
        action: 'Не продолжать крафт: выкинь / Alchemy / новый base.',
      };
    }
    if (counts.good >= 2) {
      return {
        tone: 'good',
        title: 'Предмет хороший',
        reason: `${good.map(modBrief).join('; ')} — оба мода целевые.`,
        action: essence ? `Продолжаем: ${essence.shortAction}` : 'Продолжаем: Сфера царей (Regal).',
      };
    }
    if (counts.good === 1) {
      return {
        tone: 'warn',
        title: 'Один хороший мод',
        reason: `${good.map(modBrief).join('; ')} — целевой, второй мод не дотягивает.`,
        action: essence
          ? `Можно ${essence.shortAction}`
          : 'Можно Regal, но без гарантии — оцени открытые слоты.',
      };
    }
    return {
      tone: 'bad',
      title: 'Моды слабые',
      reason: 'Ни один мод не попал в целевые.',
      action: 'Не продолжать: Alchemy / новый base.',
    };
  }

  if (counts.bad >= badLimit) {
    return {
      tone: 'bad',
      title: badLimit >= 2 ? 'Два и более плохих мода' : 'Есть плохой мод',
      reason: `${bad.map(modBrief).join('; ')}.`,
      action: 'Не продолжать крафт: выкинь / новый base.',
    };
  }
  if (esBody?.verdict === 'incomplete') {
    const prefixCount = mods.filter((mod) => mod.kind === 'prefix').length;
    return {
      tone: 'good',
      title: 'Продолжаем крафт',
      reason: `Префиксов ${prefixCount}/3, ES ${esBody.es} — текущий, мусора нет.`,
      action: abyssAdvice
        ? 'Очернить префикс: ребро + омены, затем докрафт Exalt-ами.'
        : desecratedAlready
          ? 'Очернение уже использовано — докрафт Exalt-ами в открытый префикс.'
          : 'Докрафт префиксов Exalt-ами.',
    };
  }
  if (esBody?.verdict === 'finishable') {
    return {
      tone: 'good',
      title: 'Предмет хороший, но не закончен',
      reason: `ES ${esBody.es} → прогноз ${esBody.projectedEs} после качества и рун; моды целевые.`,
      action: `Заточить до 20% и вставить 2 руны по 18% ES; прогноз ${esBody.projectedEs} ES — предмет хороший.`,
    };
  }
  if (esBody?.verdict === 'junk') {
    return {
      tone: 'bad',
      title: 'ES ниже порога',
      reason: `ES ${esBody.es} ≤ ${esBody.targetEs} для плана «${esBody.planLabel}».`,
      action: 'Не вкладывать валюту — выкинь/продай.',
    };
  }
  if (counts.good >= 2) {
    const openSlots = counts.openPrefixes + counts.openSuffixes;
    const unfinished =
      esBody !== undefined &&
      (esBody.quality === null || esBody.quality < 20 || esBody.runes === 0);
    return {
      tone: 'good',
      title: 'Предмет хороший',
      reason: `${good.map(modBrief).join('; ')} — целевые моды.`,
      action:
        openSlots > 0
          ? 'Продолжаем: докрафт открытых слотов / Exalt.'
          : unfinished
            ? 'Моды не трогать; осталось качество/руны.'
            : 'Предмет готов: моды, качество и руны не трогать.',
    };
  }
  if (counts.good === 1) {
    return {
      tone: 'warn',
      title: 'Один хороший мод',
      reason: `${good[0] ? modBrief(good[0]) : 'целевой мод'} — остальное слабое.`,
      action: 'Докрафт рискованный; для новичка — новый base.',
    };
  }
  return {
    tone: 'bad',
    title: 'Нет целевых модов',
    reason: 'Целевых модов нет.',
    action: 'Не тратить валюту — выкинь.',
  };
}

export function analyzeCraft(item: ParsedItem): CraftAdvice {
  if (item.rarity !== 'normal' && item.rarity !== 'magic' && item.rarity !== 'rare') {
    return unsupported(
      `Советник поддерживает белые, волшебные и редкие предметы (сейчас: ${item.rarity}).`,
    );
  }

  const profile = profileFor(item);
  if (!profile) {
    return unsupported(
      `Для типа «${item.itemClass}» пока нет профиля рекомендаций.`,
    );
  }

  const groups = item.modifiers.filter(
    (modifier) =>
      modifier.source === 'explicit' &&
      (modifier.kind === 'prefix' || modifier.kind === 'suffix'),
  );
  const esItem = item.category === 'armour' && numericProperty(item, 'energyShield') > 0;
  const esHasSpirit =
    esItem &&
    groups.some(
      (group) =>
        group.kind === 'prefix' && esChannelOf(familiesOfGroup(group)) === 'spirit',
    );

  const mods: AdviceMod[] = groups.map((group) => {
    const kind = group.kind === 'prefix' ? 'prefix' : 'suffix';
    const text = groupText(group);
    const families = familiesOfGroup(group);
    const result = classify(kind, text, profile, families, group.tier, esItem, esHasSpirit);
    const esChannel = esItem ? esChannelOf(families) : undefined;
    return {
      kind,
      text,
      ...(group.tier !== undefined ? { tier: group.tier } : {}),
      verdict: result.verdict,
      reason: result.reason,
      families,
      ...(esChannel ? { esChannel } : {}),
    };
  });

  const prefixes = groups.filter((group) => group.kind === 'prefix').length;
  const suffixes = groups.filter((group) => group.kind === 'suffix').length;
  const maxPrefixes = item.rarity === 'magic' ? 1 : 3;
  const maxSuffixes = item.rarity === 'magic' ? 1 : 3;
  const openPrefixes = Math.max(0, maxPrefixes - prefixes);
  const openSuffixes = Math.max(0, maxSuffixes - suffixes);

  const counts: AdviceCounts = {
    prefixes,
    suffixes,
    openPrefixes,
    openSuffixes,
    good: mods.filter((mod) => mod.verdict === 'good').length,
    neutral: mods.filter((mod) => mod.verdict === 'neutral').length,
    bad: mods.filter((mod) => mod.verdict === 'bad').length,
  };

  const totalMods = groups.length;
  const badLimit = totalMods >= 6 ? 2 : 1;
  const stopByBad = counts.bad >= badLimit;
  const desecratedAlready =
    item.flags.desecrated === true ||
    groups.some((group) => group.states.includes('desecrated'));
  const abyssAdvice: AbyssAdvice | undefined =
    esItem &&
    item.rarity === 'rare' &&
    prefixes < 3 &&
    counts.bad < badLimit &&
    !desecratedAlready
      ? {
          title: 'Очернить префикс',
          recipe: [
            'Активируй Предзнаменование некромантии левши.',
            'Активируй Предзнаменование отголосков Бездны.',
            'Примени Сохранившееся ребро или Древнее ребро.',
            'В Колодце душ выбери вариант с префиксом.',
          ],
          action: 'Очернение делается один раз; затем докрафт Exalt-ами.',
        }
      : undefined;

  const presentPrefixFamilies = new Set(
    mods.filter((mod) => mod.kind === 'prefix').flatMap((mod) => mod.families),
  );
  const presentSuffixFamilies = new Set(
    mods.filter((mod) => mod.kind === 'suffix').flatMap((mod) => mod.families),
  );
  const esPrefixChannels = mods
    .filter((mod) => mod.kind === 'prefix' && mod.esChannel)
    .map((mod) => mod.esChannel as EsChannel);
  const esPlan = esItem ? esPrefixPlan(esPrefixChannels) : null;
  const missingEsChannels = esPlan
    ? esPlan.targets.filter((channel) => !esPrefixChannels.includes(channel))
    : [];
  const missingPrefixes = profile.targetPrefixFamilies.filter(
    (family) => !presentPrefixFamilies.has(family),
  );
  const missingSuffixes = profile.targetSuffixFamilies.filter(
    (family) => !presentSuffixFamilies.has(family),
  );

  const warnings: string[] = [];
  if (groups.length > 0 && groups.every((group) => group.tier === undefined)) {
    warnings.push('В тексте нет тиров — для точной оценки нужен advanced-copy (Ctrl+Alt+C).');
  }
  if (prefixes > maxPrefixes || suffixes > maxSuffixes) {
    warnings.push('Модов больше, чем ожидается для этой редкости — проверь текст.');
  }

  const baseLabel = item.name ?? item.baseType ?? item.itemClass;
  const levelText = item.itemLevel !== undefined ? `, ilvl ${item.itemLevel}` : '';
  const esBody = buildEsBodyAdvice(item);
  const essenceAdvice = recommendEssence(item, mods) ?? undefined;

  let summary = '';
  let steps: string[] = [];

  if (profile.mode === 'waystone' || profile.mode === 'tablet') {
    summary = `${profile.label}${levelText}. Оценка по модам для маппинга.`;
    steps = [
      'Смотри на количество и редкость находимых предметов, размер групп монстров.',
      'Эффективность монстров повышает опасность — учитывай свой билд.',
      'Хороший набор не рероллить; крафт путевых камней валютой — отдельная тема.',
    ];
  } else if (item.rarity === 'normal') {
    summary = makeSummary(
      `Белый ${baseLabel}`,
      item.itemLevel,
      'Цель — получить 2 целевых мода и решить, делать ли редким.',
    );
    steps = [
      '1. Сфера превращения (Orb of Transmutation) — сделать волшебным, получить 1 мод.',
      '2. Сфера усиления (Orb of Augmentation) — добавить 2-й мод.',
      '3. Если оба мода из целевого списка → Сфера царей (Regal Orb). Если один или мусор → Сфера алхимии (Alchemy) / новый base.',
    ];
  } else if (item.rarity === 'magic') {
    if (counts.prefixes + counts.suffixes === 0) {
      summary = makeSummary(`Волшебный ${baseLabel}`, item.itemLevel, 'Модов нет.');
      steps = [
        'Сфера усиления (Orb of Augmentation) — добавить первый мод.',
        'Если мод окажется мусорным — не продолжать: Alchemy / новый base.',
        'Если мод целевой — оценить его тир и решить по второму моду.',
      ];
    } else if (counts.prefixes + counts.suffixes === 1) {
      if (counts.good > 0) {
        summary = makeSummary(`Один хороший мод. ${baseLabel}`, item.itemLevel, '');
        steps = [
          'Сфера усиления (Orb of Augmentation) — добавить второй мод.',
          'Если второй мод тоже целевой → Сфера царей (Regal Orb).',
          'Если второй мод мусорный → Сфера алхимии (Alchemy) / новый base.',
        ];
      } else {
        summary = makeSummary(`Один мод, но он не из целевых. ${baseLabel}`, item.itemLevel, '');
        steps = [
          'Не тратить Сферу усиления на эту базу.',
          'Сфера алхимии (Alchemy Orb) или новый base — иначе Regal закрепит слабый мод.',
        ];
      }
    } else if (counts.good >= 2) {
      summary = makeSummary(`Оба мода целевые. ${baseLabel}`, item.itemLevel, '');
      steps = [
        'Сфера царей (Regal Orb) — сделать предмет редким, сохранив оба мода.',
        'Дальше смотри совет для редкого предмета.',
      ];
    } else if (counts.good === 1) {
      summary = makeSummary(`Один целевой мод и один нецелевой. ${baseLabel}`, item.itemLevel, '');
      steps = [
        'Сфера царей (Regal) закрепит мусор — обычно не лучший вариант.',
        'Сфера алхимии (Alchemy Orb) или новый base.',
      ];
    } else {
      summary = makeSummary(`Целевых модов нет. ${baseLabel}`, item.itemLevel, '');
      steps = [
        'Не тратить Сферу царей на эту пару.',
        'Сфера алхимии (Alchemy Orb) для полного реролла или новый base.',
      ];
    }
  } else {
    const openSlots = openPrefixes + openSuffixes;
    if (counts.good === 0) {
      summary = makeSummary(`Редкий ${baseLabel}`, item.itemLevel, 'Целевых модов нет.');
      steps = [
        'Не тратить валюту на докрафт.',
        'Сфера хаоса рискованна — лучше новый base.',
      ];
    } else if (counts.good >= 2 && openSlots > 0) {
      summary = makeSummary(
        `${counts.good} целевых мода, открыто слотов: ${openSlots}. ${baseLabel}`,
        item.itemLevel,
        '',
      );
      steps = [
        `Сфера возвышения (Exalted Orb) в открытый ${openPrefixes > 0 ? 'префикс' : 'суффикс'} — попытка усилить предмет.`,
        'Если попадёт мусор — остановиться, не рероллить хорошие моды.',
      ];
    } else if (counts.good >= 2) {
      summary = makeSummary(`Сильный набор: ${counts.good} целевых мода. ${baseLabel}`, item.itemLevel, '');
      steps = [
        'Не рероллить: моды уже сильные.',
        'Дальше — только если уверен в конкретном апгрейде; без цен оценка не считается.',
      ];
    } else if (counts.good === 1 && counts.bad >= 2) {
      summary = makeSummary(`Один целевой мод и много мусора. ${baseLabel}`, item.itemLevel, '');
      steps = [
        'Сфера хаоса (Chaos Orb) рискованно: может убрать хороший мод.',
        'Для новичка — новый base выгоднее по нервам и результату.',
      ];
    } else if (counts.good === 1) {
      summary = makeSummary(`Один целевой мод. ${baseLabel}`, item.itemLevel, '');
      steps = [
        openSlots > 0
          ? 'Можно попробовать Сферу возвышения (Exalted Orb) в открытый слот, но рискованно.'
          : 'Свободных слотов нет — докрафт невозможен без Сферы отмены (Annul) / Сферы хаоса.',
        'Если не готов рисковать — оставь как есть / новый base.',
      ];
    } else {
      summary = makeSummary(`Целевых модов мало. ${baseLabel}`, item.itemLevel, '');
      steps = [
        'Не тратить дорогую валюту.',
        'Новый base; Сфера хаоса без понимания рисков не советую.',
      ];
    }
  }

  steps.push('Оценка без цен: ориентир — целевые моды, тиры и открытые слоты.');

  if (abyssAdvice) {
    steps.unshift(...abyssAdvice.recipe, abyssAdvice.action);
  } else if (item.rarity === 'rare' && prefixes < 3 && desecratedAlready) {
    steps.unshift('Очернение уже использовано — дальше только Exalt в открытый префикс.');
  }

  if (esBody?.verdict === 'finishable') {
    steps.unshift(
      'Заточить до 20% качества и вставить 2 железные руны по 18% ES; после этого пересчитать итоговый ES.',
    );
  }

  if (essenceAdvice) {
    steps.unshift(
      `Вариант с гарантией: ${essenceAdvice.name} — ${essenceAdvice.effect}.`,
      'Альтернатива: Regal — случайный мод, может дать ES-префикс, но без гарантии.',
    );
  }

  if (item.rarity === 'rare' && profile.mode !== 'waystone' && profile.mode !== 'tablet') {
    if (counts.bad >= badLimit) {
      summary =
        badLimit >= 2
          ? `Два и более слабых мода. ${summary}`
          : `Есть слабый мод. ${summary}`;
      steps = [
        badLimit >= 2
          ? 'Выкинуть: два и более плохих мода — докрафт не оправдан.'
          : 'Выкинуть: на предмете до 5 аффиксов один плохой мод уже повод не продолжать.',
        'Если база T1/T2 — искать новый экземпляр.',
      ];
    } else {
      const prefixNeed = esPlan
        ? missingEsChannels.map((channel) => ES_CHANNEL_LABEL[channel])
        : missingPrefixes.map(familyLabel);
      const suffixNeed = missingSuffixes.map(familyLabel);
      if (openPrefixes > 0 && prefixNeed.length > 0) {
        steps.unshift(
          `Нужен префикс: ${prefixNeed.join(', ')} — докрафтить в открытый префикс.`,
        );
      } else if (openPrefixes === 0 && prefixNeed.length > 0) {
        steps.unshift(`Не хватает префикса (${prefixNeed.join(', ')}), но все префиксы заняты.`);
      }
      if (openSuffixes > 0 && suffixNeed.length > 0) {
        steps.unshift(
          `Нужен суффикс: ${suffixNeed.join(', ')} — докрафтить в открытый суффикс.`,
        );
      } else if (openSuffixes === 0 && suffixNeed.length > 0) {
        steps.unshift(`Не хватает суффикса (${suffixNeed.join(', ')}), но все суффиксы заняты.`);
      }
    }
  }

  if (esBody && !stopByBad) {
    if (esBody.verdict === 'junk') {
      summary = `ES ${esBody.es}: неликвид для плана «${esBody.planLabel}». ${summary}`;
      steps = [
        `ES ${esBody.es} ≤ ${esBody.targetEs} для плана «${esBody.planLabel}» — не вкладывать валюту.`,
        'Выкинуть/продать; если база сильная — искать новый base.',
      ];
    } else if (esBody.verdict === 'incomplete') {
      summary = `ES ${esBody.es} (префиксов ${prefixes}/3, это не итог). ${summary}`;
    } else if (esBody.verdict === 'finishable') {
      summary = `ES ${esBody.es} → прогноз ${esBody.projectedEs} после качества 20% и 2 рун. ${summary}`;
    } else if (esBody.verdict === 'playable') {
      summary = `ES ${esBody.es}: пойдёт для плана «${esBody.planLabel}». ${summary}`;
      steps.unshift(
        `ES ${esBody.es} в диапазоне ${esBody.targetEs}–${esBody.targetEs + 99} — можно докрафтить.`,
      );
    } else if (esBody.verdict === 'keep') {
      summary = `ES ${esBody.es}: не трогать (план «${esBody.planLabel}»). ${summary}`;
      steps.unshift(
        `ES ≥ ${esBody.targetEs + 100} — сильный экземпляр; не рероллить, только аккуратный докрафт.`,
      );
    } else if (esBody.verdict === 'magic') {
      summary = `ES ${esBody.es} (текущий magic; порог ${esBody.targetEs} не применяется). ${summary}`;
    } else if (esBody.verdict === 'base-bad') {
      summary = `База T1, ilvl ${item.itemLevel ?? '?'} — плохо. ${summary}`;
      steps = [
        `База T1, но ilvl ${item.itemLevel ?? '?'} — для крафта лучше 82+; на 79–81 приемлемо.`,
        'Этот экземпляр не стоит развивать: дождись базы 82+ или возьми 79–81.',
      ];
    } else if (esBody.verdict === 'base-good') {
      summary = `База T1, ilvl ${item.itemLevel ?? '?'} — хорошо. ${summary}`;
    } else if (esBody.verdict === 'base-acceptable') {
      summary = `База T1, ilvl ${item.itemLevel ?? '?'} — приемлемо. ${summary}`;
    } else if (esBody.verdict === 'white') {
      summary = `Белая база, ES ${esBody.es}. ${summary}`;
    }
  }

  return {
    supported: true,
    profile: `${profile.label} (пробный режим)`,
    summary,
    steps,
    targetPrefixes: profile.targetPrefixes,
    targetSuffixes: profile.targetSuffixes,
    mods,
    counts,
    warnings,
    ...(esBody ? { esBody } : {}),
    ...(essenceAdvice ? { essenceAdvice } : {}),
    ...(abyssAdvice ? { abyssAdvice } : {}),
    shortVerdict: buildShortVerdict(
      item,
      mods,
      counts,
      esBody,
      abyssAdvice,
      badLimit,
      desecratedAlready,
    ),
  };
}

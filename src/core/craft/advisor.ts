import type { ModifierGroup, ParsedItem } from '../types';

/**
 * Пробный советник по крафту: пока только нательные доспехи на чистом ЭЩ.
 *
 * Это НЕ оценка цены и не «ИИ-мнение»: только правила по модам, тирам и
 * открытым слотам. Список целевых модов для нательного доспеха взят из
 * гайда-соседа («Лучшие статы для волшебного предмета») и уточнён под чистый
 * энергощит.
 */

export type AdviceVerdict = 'good' | 'neutral' | 'bad' | 'unknown';

export interface AdviceMod {
  kind: 'prefix' | 'suffix' | 'unknown';
  text: string;
  tier?: number;
  verdict: AdviceVerdict;
  reason: string;
}

export interface AdviceCounts {
  prefixes: number;
  suffixes: number;
  openPrefixes: number;
  openSuffixes: number;
  good: number;
  neutral: number;
  bad: number;
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
}

const PROFILE = 'Нательный доспех · Энергощит (пробный режим)';

const TARGET_PREFIXES = [
  '% повышение энергетического щита (высокий тир)',
  '+N к максимуму энергетического щита (флэт)',
  '+N к максимуму здоровья',
  '+N к духу',
];

const TARGET_SUFFIXES = [
  '+N% к сопротивлению огню / холоду / молнии',
  '+N% к сопротивлению хаосу',
  'повышение скорости перезарядки энергетического щита',
  '+N к интеллекту (если нужен атрибут)',
];

interface Rule {
  pattern: RegExp;
  verdict: AdviceVerdict;
  reason: string;
}

const PREFIX_RULES: Rule[] = [
  {
    pattern: /увеличение энергетического щита/i,
    verdict: 'good',
    reason: 'основной мод на ЭЩ',
  },
  {
    pattern: /к максимуму энергетического щита/i,
    verdict: 'good',
    reason: 'флэт ЭЩ — база выживаемости',
  },
  {
    pattern: /к максимуму здоровья/i,
    verdict: 'good',
    reason: 'жизнь полезна любому билду',
  },
  {
    pattern: /к духу/i,
    verdict: 'good',
    reason: 'дух — ценный ресурс',
  },
  {
    pattern: /к максимуму маны/i,
    verdict: 'neutral',
    reason: 'мана полезна, но не ключевой мод для ЭЩ-брони',
  },
  {
    pattern: /шипами|порог|оглуш|снижение требований|регенерац/i,
    verdict: 'bad',
    reason: 'слабее целевых модов для ЭЩ-брони',
  },
];

const SUFFIX_RULES: Rule[] = [
  {
    pattern: /к сопротивлению/i,
    verdict: 'good',
    reason: 'резисты нужны почти любому билду',
  },
  {
    pattern: /скорости перезарядки энергетического щита/i,
    verdict: 'neutral',
    reason: 'полезно для ЭЩ-билдов, но не ключевой мод',
  },
  {
    pattern: /к интеллекту/i,
    verdict: 'neutral',
    reason: 'атрибут, ценность зависит от билда',
  },
  {
    pattern: /оглушени|длительности (кровотечения|отравления)|снижение требований|регенерация .*здоровья/i,
    verdict: 'bad',
    reason: 'слабее целевых модов для ЭЩ-брони',
  },
];

function unsupported(summary: string, warnings: string[] = []): CraftAdvice {
  return {
    supported: false,
    profile: PROFILE,
    summary,
    steps: [],
    targetPrefixes: TARGET_PREFIXES,
    targetSuffixes: TARGET_SUFFIXES,
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

function classify(kind: 'prefix' | 'suffix', text: string): { verdict: AdviceVerdict; reason: string } {
  const rules = kind === 'prefix' ? PREFIX_RULES : SUFFIX_RULES;
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return { verdict: rule.verdict, reason: rule.reason };
    }
  }
  return {
    verdict: 'neutral',
    reason: 'не из целевого списка — проверь под свой билд',
  };
}

function makeSummary(baseLabel: string, itemLevel: number | undefined, action: string): string {
  const level = itemLevel !== undefined ? `, ilvl ${itemLevel}` : '';
  return `${baseLabel}${level}. ${action}`;
}

export function analyzeCraft(item: ParsedItem): CraftAdvice {
  const isBodyArmour =
    item.subtype === 'bodyArmour' || item.itemClass === 'Нательные доспехи';
  if (!isBodyArmour) {
    return unsupported('Пробный советник пока работает только для нательных доспехов.');
  }

  if (item.rarity !== 'normal' && item.rarity !== 'magic' && item.rarity !== 'rare') {
    return unsupported(
      `Пробный советник поддерживает только белые, волшебные и редкие доспехи (сейчас: ${item.rarity}).`,
    );
  }

  const energyShield = numericProperty(item, 'energyShield');
  const armour = numericProperty(item, 'armour');
  const evasion = numericProperty(item, 'evasion');

  if (energyShield <= 0) {
    return unsupported(
      'Не вижу энергетического щита в тексте предмета. Нужен advanced-copy (Alt+F / Ctrl+Alt+C).',
    );
  }
  if (armour > 0 || evasion > 0) {
    return unsupported(
      `Пробный советник пока только для чистого ЭЩ. У предмета есть ${[
        armour > 0 ? 'броня' : '',
        evasion > 0 ? 'уклонение' : '',
      ]
        .filter(Boolean)
        .join(' и ')}.`,
    );
  }

  const groups = item.modifiers.filter(
    (modifier) =>
      modifier.source === 'explicit' &&
      (modifier.kind === 'prefix' || modifier.kind === 'suffix'),
  );

  const mods: AdviceMod[] = groups.map((group) => {
    const kind = group.kind === 'prefix' ? 'prefix' : 'suffix';
    const text = groupText(group);
    const result = classify(kind, text);
    return {
      kind,
      text,
      ...(group.tier !== undefined ? { tier: group.tier } : {}),
      verdict: result.verdict,
      reason: result.reason,
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

  const warnings: string[] = [];
  if (groups.length > 0 && groups.every((group) => group.tier === undefined)) {
    warnings.push('В тексте нет тиров — для точной оценки нужен advanced-copy (Ctrl+Alt+C).');
  }
  if (prefixes > maxPrefixes || suffixes > maxSuffixes) {
    warnings.push('Модов больше, чем ожидается для этой редкости — проверь текст.');
  }

  const baseLabel = item.name ?? item.baseType ?? item.itemClass;
  const levelText = item.itemLevel !== undefined ? `, ilvl ${item.itemLevel}` : '';

  let summary = '';
  let steps: string[] = [];

  if (item.rarity === 'normal') {
    summary = `Белый ${baseLabel}${levelText}. Цель — получить 2 целевых мода и решить, делать ли редким.`;
    steps = [
      '1. Сфера превращения (Orb of Transmutation) — сделать волшебным, получить 1 мод.',
      '2. Сфера усиления (Orb of Augmentation) — добавить 2-й мод.',
      '3. Если оба мода из целевого списка → Сфера царей (Regal Orb). Если один или мусор → Сфера алхимии (Alchemy) / новый base.',
    ];
  } else if (item.rarity === 'magic') {
    if (counts.prefixes + counts.suffixes === 0) {
      summary = `Волшебный ${baseLabel}${levelText}, но явных модов не видно.`;
      steps = [
        'Проверь копирование: нужен advanced-copy (Alt+F / Ctrl+Alt+C).',
        'Если модов действительно нет — начни с Сферы превращения → Сферы усиления.',
      ];
    } else if (counts.prefixes + counts.suffixes === 1) {
      if (counts.good > 0) {
        summary = `Один хороший мод. ${baseLabel}${levelText}.`;
        steps = [
          'Сфера усиления (Orb of Augmentation) — добавить второй мод.',
          'Если второй мод тоже целевой → Сфера царей (Regal Orb).',
          'Если второй мод мусорный → Сфера алхимии (Alchemy) / новый base.',
        ];
      } else {
        summary = `Один мод, но он не из целевых. ${baseLabel}${levelText}.`;
        steps = [
          'Не тратить Сферу усиления на эту базу.',
          'Сфера алхимии (Alchemy Orb) или новый base — иначе Regal закрепит слабый мод.',
        ];
      }
    } else if (counts.good >= 2) {
      summary = `Оба мода целевые. ${baseLabel}${levelText}.`;
      steps = [
        'Сфера царей (Regal Orb) — сделать предмет редким, сохранив оба мода.',
        'Дальше смотри совет для редкого предмета.',
      ];
    } else if (counts.good === 1) {
      summary = `Один целевой мод и один нецелевой. ${baseLabel}${levelText}.`;
      steps = [
        'Сфера царей (Regal) закрепит мусор — обычно не лучший вариант.',
        'Сфера алхимии (Alchemy Orb) или новый base.',
      ];
    } else {
      summary = `Целевых модов нет. ${baseLabel}${levelText}.`;
      steps = [
        'Не тратить Сферу царей на эту пару.',
        'Сфера алхимии (Alchemy Orb) для полного реролла или новый base.',
      ];
    }
  } else {
    const openSlots = openPrefixes + openSuffixes;
    if (counts.good === 0) {
      summary = `Редкий ${baseLabel}${levelText}: целевых модов нет.`;
      steps = [
        'Не тратить валюту на докрафт.',
        'Chaos Orb / Alchemy рискованны — лучше новый base.',
      ];
    } else if (counts.good >= 2 && openSlots > 0) {
      summary = `${counts.good} целевых мода, открыто слотов: ${openSlots}. ${baseLabel}${levelText}.`;
      steps = [
        `Сфера возвышения (Exalted Orb) в открытый ${openPrefixes > 0 ? 'префикс' : 'суффикс'} — попытка усилить предмет.`,
        'Если попадёт мусор — остановиться, не рероллить хорошие моды.',
      ];
    } else if (counts.good >= 2) {
      summary = `Сильный набор: ${counts.good} целевых мода. ${baseLabel}${levelText}.`;
      steps = [
        'Не рероллить: моды уже сильные.',
        'Дальше — только если уверен в конкретном апгрейде; без цен оценка не считается.',
      ];
    } else if (counts.good === 1 && counts.bad >= 2) {
      summary = `Один целевой мод и много мусора. ${baseLabel}${levelText}.`;
      steps = [
        'Сфера хаоса (Chaos Orb) рискованно: может убрать хороший мод.',
        'Для новичка — новый base выгоднее по нервам и результату.',
      ];
    } else if (counts.good === 1) {
      summary = `Один целевой мод. ${baseLabel}${levelText}.`;
      steps = [
        openSlots > 0
          ? 'Можно попробовать Сферу возвышения (Exalted Orb) в открытый слот, но рискованно.'
          : 'Свободных слотов нет — докрафт невозможен без Сферы отмены (Annul) / Сферы хаоса.',
        'Если не готов рисковать — оставь как есть / новый base.',
      ];
    } else {
      summary = `Целевых модов мало. ${baseLabel}${levelText}.`;
      steps = [
        'Не тратить дорогую валюту.',
        'Сфера алхимии / новый base; Сфера хаоса без понимания рисков не советую.',
      ];
    }
  }

  steps.push('Оценка без цен: ориентир — целевые моды, тиры и открытые слоты.');

  return {
    supported: true,
    profile: PROFILE,
    summary,
    steps,
    targetPrefixes: TARGET_PREFIXES,
    targetSuffixes: TARGET_SUFFIXES,
    mods,
    counts,
    warnings,
  };
}

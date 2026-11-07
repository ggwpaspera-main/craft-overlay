import { describe, expect, it } from 'vitest';
import { analyzeCraft } from '../src/core/craft/advisor';
import { filterBaseInfo } from '../src/core/filter/priors';
import { parseItemText } from '../src/core/parser';
import type { ItemProperty, ModifierGroup, ParsedItem, StatLine } from '../src/core/types';

function line(text: string): StatLine {
  return { raw: text, text, values: [] };
}

function group(
  kind: 'prefix' | 'suffix',
  text: string,
  tier?: number,
): ModifierGroup {
  return {
    source: 'explicit',
    kind,
    headerRaw: `{ ${kind} }`,
    ...(tier !== undefined ? { tier } : {}),
    tags: [],
    states: [],
    lines: [line(text)],
  };
}

function multiGroup(
  kind: 'prefix' | 'suffix',
  texts: string[],
  tier?: number,
): ModifierGroup {
  return {
    source: 'explicit',
    kind,
    headerRaw: `{ ${kind} }`,
    ...(tier !== undefined ? { tier } : {}),
    tags: [],
    states: [],
    lines: texts.map(line),
  };
}

function esProperty(value = '171'): ItemProperty {
  return {
    key: 'energyShield',
    label: 'Энергетический щит',
    values: [value],
  };
}

function makeItem(overrides: Partial<ParsedItem> = {}): ParsedItem {
  return {
    raw: '',
    locale: 'ru',
    parserVersion: 'test',
    itemClass: 'Нательные доспехи',
    category: 'armour',
    subtype: 'bodyArmour',
    rarity: 'normal',
    name: 'Нечестивое облачение',
    itemLevel: 80,
    properties: [esProperty('850')],
    requirements: [],
    sockets: [],
    grantedSkills: [],
    modifiers: [],
    runes: [],
    flags: {},
    unknownLines: [],
    warnings: [],
    ...overrides,
  };
}

describe('analyzeCraft: нательный доспех на ЭЩ', () => {
  it('белый: советует Transmutation + Augmentation', () => {
    const advice = analyzeCraft(makeItem({ rarity: 'normal' }));
    expect(advice.supported).toBe(true);
    expect(advice.summary).toContain('Белый');
    expect(advice.steps.join(' ')).toContain('Transmutation');
    expect(advice.steps.join(' ')).toContain('Augmentation');
    expect(advice.targetPrefixes.length).toBeGreaterThan(0);
    expect(advice.targetSuffixes.length).toBeGreaterThan(0);
  });

  it('белый доспех из текста игры проходит парсер и советник', () => {
    const result = parseItemText(
      [
        'Класс предмета: Нательные доспехи',
        'Редкость: Обычный',
        'Нечестивое облачение',
        '--------',
        'Энергетический щит: 171',
        '--------',
        'Уровень предмета: 80',
      ].join('\n'),
      'ru',
    );
    expect(result.ok).toBe(true);
    expect(result.item).not.toBeNull();
    const advice = analyzeCraft(result.item as ParsedItem);
    expect(advice.supported).toBe(true);
    expect(advice.steps.join(' ')).toContain('Transmutation');
  });

  it('магический: два целевых мода → Regal', () => {
    const item = makeItem({
      rarity: 'magic',
      modifiers: [
        group('prefix', '100% увеличение энергетического щита', 2),
        group('suffix', '+40% к сопротивлению огню', 2),
      ],
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(true);
    expect(advice.counts.good).toBe(2);
    expect(advice.steps.join(' ')).toContain('Regal');
  });

  it('магический: один целевой + мусор → Alchemy/новый base', () => {
    const item = makeItem({
      rarity: 'magic',
      modifiers: [
        group('prefix', '100% увеличение энергетического щита', 2),
        group('suffix', '35% снижение требований к характеристикам'),
      ],
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(true);
    expect(advice.counts.good).toBe(1);
    expect(advice.counts.bad).toBe(1);
    expect(advice.steps.join(' ')).toContain('Alchemy');
  });

  it('редкий: 2 хороших + 1 мусор на 3 аффиксах → стоп', () => {
    const item = makeItem({
      rarity: 'rare',
      modifiers: [
        group('prefix', '100% увеличение энергетического щита', 2),
        group('prefix', '+180 к максимуму энергетического щита', 2),
        group('suffix', '35% снижение требований к характеристикам'),
      ],
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(true);
    expect(advice.counts.good).toBe(2);
    expect(advice.shortVerdict?.tone).toBe('bad');
    expect(advice.steps.join(' ')).toContain('Выкинуть');
    expect(advice.shortVerdict?.action).not.toContain('Alchemy');
  });

  it('редкий: три и более целевых мода без слотов → не рероллить', () => {
    const item = makeItem({
      rarity: 'rare',
      modifiers: [
        group('prefix', '100% увеличение энергетического щита', 1),
        group('prefix', '+180 к максимуму энергетического щита', 1),
        group('prefix', '+54 к духу', 1),
        group('suffix', '+40% к сопротивлению огню', 1),
        group('suffix', '+40% к сопротивлению холоду', 1),
        group('suffix', '+40% к сопротивлению молнии', 1),
      ],
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(true);
    expect(advice.counts.good).toBe(6);
    expect(advice.steps.join(' ')).toContain('Не рероллить');
  });

  it('гибридный доспех поддерживается', () => {
    const item = makeItem({
      properties: [
        esProperty('87'),
        { key: 'evasion', label: 'Уклонение', values: ['285'] },
      ],
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(true);
    expect(advice.profile).toContain('ЭЩ');
  });

  it('шлем и оружие получают свои профили', () => {
    const helmet = analyzeCraft(
      makeItem({ itemClass: 'Шлемы', subtype: 'helmet', name: 'Тиара', itemLevel: 80 }),
    );
    expect(helmet.supported).toBe(true);
    expect(helmet.targetSuffixes.length).toBeGreaterThan(0);

    const wand = analyzeCraft(
      makeItem({
        itemClass: 'Жезлы',
        category: 'weapon',
        subtype: 'wand',
        name: 'Дуэльный жезл',
        itemLevel: 80,
      }),
    );
    expect(wand.supported).toBe(true);
    expect(wand.profile).toContain('кастер');
  });

  it('камень умений без крафт-профиля', () => {
    const item = makeItem({
      itemClass: 'Камни умений',
      category: 'gem',
      subtype: 'skill',
      name: 'Огненный шар',
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(false);
  });
});

describe('analyzeCraft: распознавание семейств модов', () => {
  const amulet = { itemClass: 'Амулеты', category: 'jewellery', subtype: 'amulet' } as const;
  const jewel = { itemClass: 'Самоцветы', category: 'jewel', subtype: undefined } as const;
  const charm = { itemClass: 'Обереги', category: 'charm', subtype: 'charm' } as const;
  const wand = { itemClass: 'Жезлы', category: 'weapon', subtype: 'wand' } as const;

  it.each([
    ['бонус крит. урона', jewel, 'suffix', '16% увеличение бонуса к критическому урону', 'good', 2],
    ['все характеристики', amulet, 'suffix', '+10 ко всем характеристикам', 'good', 2],
    ['длительность оберега', charm, 'suffix', '30% увеличение длительности эффекта оберега', 'good', 2],
    ['добавленный физ. урон', amulet, 'prefix', 'Добавляет от 3 до 7 физического урона к атакам', 'good', 2],
    ['% здоровья', amulet, 'prefix', '20% увеличение максимума здоровья', 'good', 2],
    ['макс. сопротивление', amulet, 'suffix', '+1% к максимальному сопротивлению хаосу', 'good', 2],
    ['срабатывающие чары', wand, 'prefix', 'Срабатывающие чары наносят увеличенный на 18% урон от чар', 'good', 2],
    ['шипы, а не физ. урон', wand, 'prefix', 'От 1 до 5 физического урона шипами', 'bad', undefined],
    ['стат приспешников', wand, 'suffix', 'Приспешники имеют 10% повышение шанса критического удара', 'neutral', undefined],
    ['здоровье компаньонов', amulet, 'prefix', '20% увеличение максимума здоровья компаньонов', 'neutral', undefined],
    ['крит приспешников', wand, 'suffix', '20% увеличение бонуса к критическому урону приспешников', 'neutral', undefined],
  ] as const)('%s', (_name, slot, kind, text, verdict, tier) => {
    const item = makeItem({
      ...slot,
      rarity: 'magic',
      properties: [],
      modifiers: [group(kind, text, tier)],
    });
    expect(analyzeCraft(item).mods[0]?.verdict).toBe(verdict);
  });
});

describe('ES-тушка: пороги ES, качество и руны', () => {
  const base = {
    baseType: 'Нечестивое облачение',
    quality: 26,
    sockets: ['S', 'S'],
    runes: [line('+14% к сопротивлению огню')],
  };
  const threeEsPrefixes = [
    group('prefix', '+82 к максимуму энергетического щита', 2),
    group('prefix', '85% увеличение энергетического щита', 3),
    multiGroup(
      'prefix',
      ['30% увеличение энергетического щита', '+20 к максимуму энергетического щита'],
      1,
    ),
  ];

  it('ES < 800 — неликвид', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        quality: 20,
        sockets: ['S', 'S'],
        runes: [line('36% повышение брони, уклонения и энергетического щита')],
        rarity: 'rare',
        properties: [esProperty('750')],
        modifiers: threeEsPrefixes,
      }),
    );
    expect(advice.esBody?.verdict).toBe('junk');
    expect(advice.esBody?.baseTier).toBe('t1');
    expect(advice.summary).toContain('неликвид');
    expect(advice.steps[0]).toContain('800');
  });

  it('ES 800–899 — пойдёт', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [esProperty('850')],
        modifiers: threeEsPrefixes,
      }),
    );
    expect(advice.esBody?.verdict).toBe('playable');
    expect(advice.summary).toContain('пойдёт');
  });

  it('ES ≥ 900 — не трогать', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [esProperty('950')],
        modifiers: threeEsPrefixes,
      }),
    );
    expect(advice.esBody?.verdict).toBe('keep');
    expect(advice.summary).toContain('не трогать');
  });

  it('качество ниже 20% попадает в проверки', () => {
    const advice = analyzeCraft(
      makeItem({ ...base, quality: 15, rarity: 'rare', properties: [esProperty('850')] }),
    );
    expect(advice.esBody?.checks.join(' ')).toContain('15% < 20%');
  });

  it('прогноз ES: 672 → 932, заточка +134, 2 руны +105', () => {
    const result = parseItemText(
      [
        'Класс предмета: Нательные доспехи',
        'Редкость: Редкий',
        'Разумный покров',
        'Нечестивое облачение',
        '--------',
        'Энергетический щит: 672 (augmented)',
        '--------',
        'Требуется: Уровень 65, 111 (augmented) Инт',
        '--------',
        'Уровень предмета: 80',
        '--------',
        '{ Префикс "Неприступный" (Уровень: 2) — Энергетический щит }',
        '96(92-100)% увеличение энергетического щита',
        '{ Очернённое Префикс "Лучезарный" (Уровень: 1) — Энергетический щит }',
        '+95(91-96) к максимуму энергетического щита',
        '{ Префикс "Первосвященный" (Уровень: 2) — Энергетический щит }',
        '+25(21-25) к максимуму энергетического щита',
        '35(33-38)% увеличение энергетического щита',
        '{ Суффикс "магмы" (Уровень: 2) — Стихийный, Огонь, Сопротивление }',
        '+40(36-40)% к сопротивлению огню',
        '{ Суффикс "белого медведя" (Уровень: 3) — Стихийный, Холод, Сопротивление }',
        '+31(31-35)% к сопротивлению холоду',
        '{ Ремесленное Суффикс "вихря" (Уровень: 3) — Стихийный, Молния, Сопротивление }',
        '+32(31-35)% к сопротивлению молнии',
      ].join('\n'),
      'ru',
    );
    const advice = analyzeCraft(result.item as ParsedItem);
    expect(advice.esBody?.verdict).toBe('finishable');
    expect(advice.esBody?.projectedEs).toBe(932);
    expect(advice.esBody?.qualityOnlyEs).toBe(806);
    expect(advice.esBody?.runesOnlyEs).toBe(777);
    expect(advice.esBody?.qualityGain).toBe(134);
    expect(advice.esBody?.runeGain).toBe(105);
    expect(advice.shortVerdict?.action).toContain('932');
  });

  it('ES: 6 модов без качества/рун — сначала закончить, не junk', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        quality: undefined,
        sockets: [],
        runes: [],
        rarity: 'rare',
        properties: [esProperty('672')],
        modifiers: [
          ...threeEsPrefixes,
          group('suffix', '+40% к сопротивлению огню', 2),
          group('suffix', '+31% к сопротивлению холоду', 3),
          group('suffix', '+32% к сопротивлению молнии', 3),
        ],
      }),
    );
    expect(advice.counts.prefixes).toBe(3);
    expect(advice.counts.suffixes).toBe(3);
    expect(advice.esBody?.verdict).toBe('finishable');
    expect(advice.summary).not.toContain('неликвид');
    expect(advice.shortVerdict?.action).toContain('Заточить');
  });

  it('ES: 6 модов после качества и рун — готов, не Exalt', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        quality: 20,
        sockets: ['S', 'S'],
        runes: [line('36% повышение брони, уклонения и энергетического щита')],
        rarity: 'rare',
        properties: [esProperty('932')],
        modifiers: [
          ...threeEsPrefixes,
          group('suffix', '+40% к сопротивлению огню', 2),
          group('suffix', '+31% к сопротивлению холоду', 3),
          group('suffix', '+32% к сопротивлению молнии', 3),
        ],
      }),
    );
    expect(advice.counts.openPrefixes).toBe(0);
    expect(advice.counts.openSuffixes).toBe(0);
    expect(advice.esBody?.verdict).toBe('keep');
    expect(advice.shortVerdict?.action).toContain('готов');
    expect(advice.shortVerdict?.action).not.toContain('Exalt');
    expect(advice.shortVerdict?.action).not.toContain('осталось');
  });

  it('броня: дух снижает порог 2500 → 2000', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [{ key: 'armour', label: 'Броня', values: ['1800'] }],
        modifiers: [
          group('prefix', '100% повышение брони', 2),
          group('prefix', '+60 к духу', 2),
        ],
      }),
    );
    expect(advice.bodyDefence?.targetLabel).toContain('2000');
    expect(advice.bodyDefence?.verdict).toBe('finishable');
    expect(advice.shortVerdict?.tone).toBe('good');
  });

  it('броня: life T1 — хороший, на броня+уклонение life — мусор', () => {
    const armour = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [{ key: 'armour', label: 'Броня', values: ['1600'] }],
        modifiers: [
          group('prefix', '100% повышение брони', 2),
          group('prefix', '+30 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(armour.mods.find((mod) => mod.text.includes('здоровья'))?.verdict).toBe('good');

    const hybrid = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1200'] },
          { key: 'evasion', label: 'Уклонение', values: ['1100'] },
        ],
        modifiers: [
          group('prefix', '100% повышение брони и уклонения', 2),
          group('prefix', '+30 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(hybrid.mods.find((mod) => mod.text.includes('здоровья'))?.verdict).toBe('bad');
  });

  it('гибрид броня+уклонение: оба порога проверяются одновременно', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1400'] },
          { key: 'evasion', label: 'Уклонение', values: ['1300'] },
        ],
        modifiers: [
          group('prefix', '100% повышение брони и уклонения', 2),
          multiGroup('prefix', ['+150 к броне', '+142 к уклонению'], 2),
        ],
      }),
    );
    expect(advice.bodyDefence?.stats.map((stat) => stat.target)).toEqual([1500, 1400]);
    expect(advice.bodyDefence?.verdict).toBe('finishable');
  });

  it('броня+ЭЩ и уклонение+ЭЩ: оба порога', () => {
    const aes = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1400'] },
          { key: 'energyShield', label: 'Энергетический щит', values: ['400'] },
        ],
        modifiers: [group('prefix', '100% повышение брони и энергетического щита', 2)],
      }),
    );
    expect(aes.bodyDefence?.targetLabel).toBe('броня > 1500 · ЭЩ > 450');

    const ees = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'evasion', label: 'Уклонение', values: ['1300'] },
          { key: 'energyShield', label: 'Энергетический щит', values: ['400'] },
        ],
        modifiers: [group('prefix', '100% увеличение уклонения и энергетического щита', 2)],
      }),
    );
    expect(ees.bodyDefence?.targetLabel).toBe('уклонение > 1400 · ЭЩ > 450');
  });

  it('гибрид: дух снижает оба порога на 20%, скидка одна', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1400'] },
          { key: 'evasion', label: 'Уклонение', values: ['1300'] },
        ],
        modifiers: [
          group('prefix', '100% повышение брони и уклонения', 2),
          group('prefix', '+60 к духу', 2),
          group('prefix', '+30 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(advice.bodyDefence?.targetLabel).toBe('броня > 1200 · уклонение > 1120');
  });

  it('броня+ЭЩ: чистая жизнь — мусор, %защиты+жизнь — целевой гибрид', () => {
    const pureLife = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1400'] },
          { key: 'energyShield', label: 'Энергетический щит', values: ['400'] },
        ],
        modifiers: [
          group('prefix', '100% повышение брони и энергетического щита', 2),
          group('prefix', '+30 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(pureLife.mods.find((mod) => mod.text.includes('здоровья'))?.verdict).toBe('bad');

    const hybridLife = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1400'] },
          { key: 'energyShield', label: 'Энергетический щит', values: ['400'] },
        ],
        modifiers: [
          multiGroup(
            'prefix',
            ['35% повышение брони и энергетического щита', '+30 к максимуму здоровья'],
            2,
          ),
        ],
      }),
    );
    expect(hybridLife.mods[0]?.verdict).toBe('good');
  });

  it('deflection и armour-to-elemental — целевые суффиксы', () => {
    const evasion = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [{ key: 'evasion', label: 'Уклонение', values: ['1900'] }],
        modifiers: [group('suffix', 'Дарует отклонение урона в размере 25% от уклонения', 2)],
      }),
    );
    expect(evasion.mods[0]?.verdict).toBe('good');
    expect(evasion.goal?.categories.suffixes.some((item) => item.label.includes('Отклонение'))).toBe(true);

    const armour = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [{ key: 'armour', label: 'Броня', values: ['1600'] }],
        modifiers: [group('suffix', '45% брони также применяется к получаемому урону от стихий', 2)],
      }),
    );
    expect(armour.mods[0]?.verdict).toBe('good');
  });

  it('гибрид %защиты+жизнь — фиолетовый целевой, но не снижает порог', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [
          { key: 'armour', label: 'Броня', values: ['1200'] },
          { key: 'evasion', label: 'Уклонение', values: ['1100'] },
        ],
        modifiers: [
          multiGroup(
            'prefix',
            ['35% повышение брони и уклонения', '+30 к максимуму здоровья'],
            2,
          ),
        ],
      }),
    );
    expect(advice.mods[0]?.verdict).toBe('good');
    expect(advice.bodyDefence?.targetLabel).toContain('1500');
    expect(advice.goal?.categories.prefixes.some((item) => item.label.includes('+ жизнь'))).toBe(true);
  });

  it('ES: жизнь любого тира — мусор', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [group('prefix', '+200 к максимуму здоровья', 1)],
      }),
    );
    expect(advice.mods[0]?.verdict).toBe('bad');
  });

  it('редкий: 2 плохих мода — стоп-крафт', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [
          group('prefix', '+20 к максимуму здоровья', 1),
          group('prefix', 'От 1 до 5 физического урона шипами', 1),
        ],
      }),
    );
    expect(advice.counts.bad).toBe(2);
    expect(advice.shortVerdict?.tone).toBe('bad');
    expect(advice.shortVerdict?.action.toLowerCase()).toContain('выкинь');
  });

  it('ES: T4 ES — уже неликвид', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [group('prefix', '+70 к максимуму энергетического щита', 4)],
      }),
    );
    expect(advice.mods[0]?.verdict).toBe('bad');
  });

  it('ES: дух T1–T2 — хороший, T3 — средний', () => {
    const good = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [group('prefix', '+40 к духу', 2)],
      }),
    );
    expect(good.mods[0]?.verdict).toBe('good');

    const medium = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [group('prefix', '+40 к духу', 3)],
      }),
    );
    expect(medium.mods[0]?.verdict).toBe('neutral');
  });

  it('ES: гибрид %ES + жизнь T2 — средний', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [
          multiGroup(
            'prefix',
            ['10% увеличение энергетического щита', '+20 к максимуму здоровья'],
            2,
          ),
        ],
      }),
    );
    expect(advice.mods[0]?.verdict).toBe('neutral');
  });

  it('ES: flat + гибрид → не хватает чистого %ES', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [
          group('prefix', '+85 к максимуму энергетического щита', 2),
          multiGroup(
            'prefix',
            ['30% увеличение энергетического щита', '+20 к максимуму энергетического щита'],
            1,
          ),
        ],
      }),
    );
    expect(advice.steps.join(' ')).toContain('%ES');
  });

  it('ES: дух понижает целевой порог до 650', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [esProperty('700')],
        modifiers: [
          group('prefix', '+40 к духу', 2),
          group('prefix', '+85 к максимуму энергетического щита', 2),
          group('prefix', '90% увеличение энергетического щита', 2),
        ],
      }),
    );
    expect(advice.esBody?.planLabel).toContain('дух');
    expect(advice.esBody?.targetEs).toBe(650);
    expect(advice.esBody?.verdict).toBe('playable');
  });

  it('ES: шипы — мусор', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [group('prefix', 'От 1 до 5 физического урона шипами', 1)],
      }),
    );
    expect(advice.mods[0]?.verdict).toBe('bad');
  });

  it('белая ES-база не получает вердикт junk', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'normal',
        itemLevel: 82,
        quality: undefined,
        properties: [esProperty('171')],
      }),
    );
    expect(advice.esBody?.verdict).toBe('base-good');
    expect(advice.summary).toContain('База T1');
  });

  it('нормал: Vile Robe ilvl 82 — хорошо, ilvl 75 — плохо', () => {
    const good = analyzeCraft(
      makeItem({ ...base, rarity: 'normal', itemLevel: 82, quality: undefined, properties: [esProperty('171')] }),
    );
    expect(good.esBody?.verdict).toBe('base-good');
    const bad = analyzeCraft(
      makeItem({ ...base, rarity: 'normal', itemLevel: 75, quality: undefined, properties: [esProperty('171')] }),
    );
    expect(bad.esBody?.verdict).toBe('base-bad');
  });

  it('первый magic-пример: T2 флэт ES + T3 резист, база T1, Regal', () => {
    const result = parseItemText(
      [
        'Класс предмета: Нательные доспехи',
        'Редкость: Волшебный',
        'Ослепительное Нечестивое облачение вулкана',
        '--------',
        'Энергетический щит: 253 (augmented)',
        '--------',
        'Требуется: Уровень 65, 111 (augmented) Инт',
        '--------',
        'Гнезда: S ',
        '--------',
        'Уровень предмета: 82',
        '--------',
        '{ Префикс "Ослепительное" (Уровень: 2) — Энергетический щит }',
        '+82(81-90) к максимуму энергетического щита',
        '{ Суффикс "вулкана" (Уровень: 3) — Стихийный, Огонь, Сопротивление }',
        '+31(31-35)% к сопротивлению огню',
      ].join('\n'),
      'ru',
    );
    expect(result.item).not.toBeNull();
    const advice = analyzeCraft(result.item as ParsedItem);
    expect(advice.esBody?.baseTier).toBe('t1');
    expect(advice.esBody?.verdict).toBe('magic');
    expect(advice.mods.map((mod) => mod.verdict)).toEqual(['good', 'good']);
    expect(advice.summary).not.toContain('неликвид');
    expect(advice.steps.join(' ')).toContain('Regal');
    expect(advice.shortVerdict?.tone).toBe('good');
    expect(advice.shortVerdict?.action).toContain('Regal');
    expect(advice.essenceAdvice?.element).toBe('cold');
    expect(advice.goal?.baseLabel).toBe('Нечестивое облачение');
    expect(advice.goal?.baseImage).toBe('assets/vile_robe.webp');
    expect(advice.goal?.categories.prefixes).toHaveLength(5);
    expect(advice.goal?.categories.suffixes).toHaveLength(3);
    expect(advice.goal?.categories.prefixes.find((mod) => mod.label === 'флэт ЭЩ')?.matched).toBe(true);
    expect(advice.goal?.categories.suffixes.find((mod) => mod.label === 'Все сопротивления')?.matched).toBe(true);
    expect(advice.goal?.current.prefixes).toHaveLength(1);
    expect(advice.goal?.current.suffixes).toHaveLength(1);
  });

  it('goal: мусорный мод попадает в красный блок', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [
          group('prefix', '+82 к максимуму энергетического щита', 2),
          group('prefix', '+20 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(advice.goal?.trash).toHaveLength(1);
    expect(advice.goal?.trash[0]?.color).toBe('red');
    expect(advice.goal?.trash[0]?.trash).toBe(true);
  });

  it('второй magic-пример: T12 жизнь — плохой мод, Alchemy/новый base', () => {
    const result = parseItemText(
      [
        'Класс предмета: Нательные доспехи',
        'Редкость: Волшебный',
        'Здоровое Нечестивое облачение вулкана',
        '--------',
        'Энергетический щит: 171',
        '--------',
        'Требуется: Уровень 65, 111 (augmented) Инт',
        '--------',
        'Уровень предмета: 82',
        '--------',
        '{ Префикс "Здоровое" (Уровень: 12) — Здоровье }',
        '+20(20-29) к максимуму здоровья',
        '{ Суффикс "вулкана" (Уровень: 3) — Стихийный, Огонь, Сопротивление }',
        '+35(31-35)% к сопротивлению огню',
      ].join('\n'),
      'ru',
    );
    expect(result.item).not.toBeNull();
    const advice = analyzeCraft(result.item as ParsedItem);
    expect(advice.esBody?.baseTier).toBe('t1');
    expect(advice.esBody?.verdict).toBe('magic');
    expect(advice.mods.map((mod) => mod.verdict)).toEqual(['bad', 'good']);
    expect(advice.summary).not.toContain('неликвид');
    expect(advice.steps.join(' ')).toContain('Alchemy');
    expect(advice.shortVerdict?.tone).toBe('bad');
    expect(advice.shortVerdict?.action.toLowerCase()).toContain('выкинь');
    expect(advice.essenceAdvice).toBeUndefined();
  });

  it('редкий: 1 префикс и 2 суффикса — не junk, нужен очернённый префикс', () => {
    const result = parseItemText(
      [
        'Класс предмета: Нательные доспехи',
        'Редкость: Редкий',
        'Победное отражение',
        'Нечестивое облачение',
        '--------',
        'Энергетический щит: 253 (augmented)',
        '--------',
        'Требуется: Уровень 65, 111 (augmented) Инт',
        '--------',
        'Гнезда: S ',
        '--------',
        'Уровень предмета: 82',
        '--------',
        '{ Префикс "Ослепительное" (Уровень: 2) — Энергетический щит }',
        '+82(81-90) к максимуму энергетического щита',
        '{ Суффикс "вулкана" (Уровень: 3) — Стихийный, Огонь, Сопротивление }',
        '+31(31-35)% к сопротивлению огню',
        '{ Ремесленное Суффикс "белого медведя" (Уровень: 3) — Стихийный, Холод, Сопротивление }',
        '+31(31-35)% к сопротивлению холоду',
      ].join('\n'),
      'ru',
    );
    expect(result.item).not.toBeNull();
    const advice = analyzeCraft(result.item as ParsedItem);
    expect(advice.esBody?.verdict).toBe('incomplete');
    expect(advice.summary).not.toContain('неликвид');
    expect(advice.shortVerdict?.tone).toBe('good');
    expect(advice.shortVerdict?.action).toContain('Очернить');
    expect(advice.abyssAdvice?.recipe.join(' ')).toContain('ребро');
    expect(advice.steps.join(' ')).toContain('некромантии левши');
  });

  it('ES: 3 префикса и ES ниже порога — junk', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        properties: [esProperty('253')],
        modifiers: [
          group('prefix', '+82 к максимуму энергетического щита', 2),
          group('prefix', '+30% увеличение энергетического щита', 3),
          group('prefix', '+20% увеличение энергетического щита', 3),
        ],
      }),
    );
    expect(advice.esBody?.verdict).toBe('junk');
    expect(advice.shortVerdict?.tone).toBe('bad');
  });

  it('rare: 1 плохой мод до 5 аффиксов — стоп', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [
          group('prefix', '+82 к максимуму энергетического щита', 2),
          group('prefix', '+20 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(advice.shortVerdict?.tone).toBe('bad');
  });

  it('rare: 1 плохой мод на 6 аффиксах — не стоп по этому правилу', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [
          group('prefix', '+82 к максимуму энергетического щита', 2),
          group('prefix', '+30% увеличение энергетического щита', 3),
          group('prefix', '+40 к духу', 2),
          group('suffix', '+35% к сопротивлению огню', 3),
          group('suffix', '+35% к сопротивлению холоду', 3),
          group('suffix', '+20 к максимуму здоровья', 1),
        ],
      }),
    );
    expect(advice.shortVerdict?.tone).not.toBe('bad');
  });

  it('magic с одним аффиксом: сначала Augmentation, без сущности', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'magic',
        modifiers: [
          multiGroup(
            'prefix',
            ['+28 к максимуму энергетического щита', '41% увеличение энергетического щита'],
            1,
          ),
        ],
      }),
    );
    expect(advice.shortVerdict?.action).toContain('Сфера усиления');
    expect(advice.essenceAdvice).toBeUndefined();
    expect(advice.steps.join(' ')).toContain('Сфера усиления');
    expect(advice.steps.join(' ')).not.toContain('Большая сущность');
  });

  it('magic с 0 аффиксов: Augmentation, без Transmutation', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'magic',
        modifiers: [],
      }),
    );
    expect(advice.shortVerdict?.title).toBe('Модов нет');
    expect(advice.shortVerdict?.action).toContain('Сфера усиления');
    expect(advice.steps.join(' ')).toContain('Сфера усиления');
    expect(advice.steps.join(' ')).not.toContain('Сфера превращения');
  });

  it('magic без резиста: Большая сущность огня вместо Regal', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'magic',
        modifiers: [
          group('prefix', '+82 к максимуму энергетического щита', 2),
          group('suffix', '+30 к интеллекту', 2),
        ],
      }),
    );
    expect(advice.essenceAdvice?.element).toBe('fire');
    expect(advice.essenceAdvice?.name).toContain('изоляции');
    expect(advice.shortVerdict?.action).toContain('изоляции');
  });
});

describe('фильтр NeverSink: приоры баз', () => {
  it('Vile Robe распознаётся как T1', () => {
    expect(filterBaseInfo('Нечестивое облачение')?.tier).toBe('t1');
    expect(filterBaseInfo('Vile Robe')?.tier).toBe('t1');
  });

  it('неизвестная база не падает', () => {
    expect(filterBaseInfo('Нет такой базы')).toBeNull();
  });
});

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

  it('редкий: два целевых мода и открытый слот → Exalted', () => {
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
    expect(advice.steps.join(' ')).toContain('Exalted');
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

  it('ES < 800 — неликвид', () => {
    const advice = analyzeCraft(
      makeItem({ ...base, rarity: 'rare', properties: [esProperty('750')] }),
    );
    expect(advice.esBody?.verdict).toBe('junk');
    expect(advice.esBody?.baseTier).toBe('t1');
    expect(advice.summary).toContain('неликвид');
    expect(advice.steps[0]).toContain('800');
  });

  it('ES 800–899 — пойдёт', () => {
    const advice = analyzeCraft(
      makeItem({ ...base, rarity: 'rare', properties: [esProperty('850')] }),
    );
    expect(advice.esBody?.verdict).toBe('playable');
    expect(advice.summary).toContain('800–900');
  });

  it('ES ≥ 900 — не трогать', () => {
    const advice = analyzeCraft(
      makeItem({ ...base, rarity: 'rare', properties: [esProperty('950')] }),
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

  it('ES: дух T3 — хороший', () => {
    const advice = analyzeCraft(
      makeItem({
        ...base,
        rarity: 'rare',
        modifiers: [group('prefix', '+40 к духу', 3)],
      }),
    );
    expect(advice.mods[0]?.verdict).toBe('good');
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

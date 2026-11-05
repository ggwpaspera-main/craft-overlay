import { describe, expect, it } from 'vitest';
import { analyzeCraft } from '../src/core/craft/advisor';
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
    properties: [esProperty()],
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
        group('prefix', '+200 к максимуму здоровья', 1),
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

  it('гибридный доспех пока не поддерживается', () => {
    const item = makeItem({
      properties: [
        esProperty('87'),
        { key: 'evasion', label: 'Уклонение', values: ['285'] },
      ],
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(false);
    expect(advice.summary).toContain('чистого ЭЩ');
  });

  it('чужой слот пока не поддерживается', () => {
    const item = makeItem({
      itemClass: 'Шлемы',
      subtype: 'helmet',
    });
    const advice = analyzeCraft(item);
    expect(advice.supported).toBe(false);
  });
});

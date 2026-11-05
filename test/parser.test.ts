import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseItemText } from '../src/core/parser';
import type { ModifierGroup, ParsedItem } from '../src/core/types';

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../fixtures/ru/${name}`, import.meta.url)), 'utf8');

function parseFixture(name: string): ParsedItem {
  const result = parseItemText(fixture(name), 'ru');
  expect(result.ok).toBe(true);
  expect(result.item).not.toBeNull();
  return result.item as ParsedItem;
}

function groupNamed(item: ParsedItem, affixName: string): ModifierGroup {
  const group = item.modifiers.find((modifier) => modifier.affixName === affixName);
  expect(group, `не найдена группа "${affixName}"`).toBeDefined();
  return group as ModifierGroup;
}

describe('parseItemText: русский advanced-copy', () => {
  it('разбирает редкий шлем', () => {
    const item = parseFixture('rare-helmet-advanced.txt');

    expect(item.itemClass).toBe('Шлемы');
    expect(item.category).toBe('armour');
    expect(item.subtype).toBe('helmet');
    expect(item.rarity).toBe('rare');
    expect(item.name).toBe('Драконий спаситель');
    expect(item.baseType).toBe('Тиара Камасы');
    expect(item.itemLevel).toBe(80);
    expect(item.quality).toBe(26);

    expect(item.properties).toEqual([
      {
        key: 'energyShield',
        label: 'Энергетический щит',
        values: ['512'],
        augmented: true,
      },
    ]);
    expect(item.requirements).toEqual([
      { key: 'level', value: 75 },
      { key: 'int', value: 107 },
    ]);
    expect(item.sockets).toEqual(['S', 'S']);
    expect(item.flags.corrupted).toBe(true);

    const hybrid = groupNamed(item, 'Папский');
    expect(hybrid.tier).toBe(1);
    expect(hybrid.tags).toEqual(['Здоровье', 'Энергетический щит']);
    expect(hybrid.lines).toHaveLength(2);
    expect(hybrid.lines[0]?.values[0]).toEqual({
      raw: '42(39-42)',
      rolled: 42,
      min: 39,
      max: 42,
    });
    expect(hybrid.lines[0]?.text).toBe('42% увеличение энергетического щита');

    const desecrated = groupNamed(item, 'Искрящийся');
    expect(desecrated.states).toContain('desecrated');
    expect(desecrated.tier).toBe(1);

    expect(item.modifiers.filter((modifier) => modifier.source === 'enchantment')).toHaveLength(1);
    expect(item.runes).toHaveLength(2);
    expect(item.runes[0]?.text).toBe('+22% к сопротивлению огню');
    expect(item.runes[1]?.text).toBe('Касание Ворона');

    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает редкую обувь', () => {
    const item = parseFixture('rare-boots-advanced.txt');

    expect(item.itemClass).toBe('Обувь');
    expect(item.name).toBe('Гипнотическая прыть');
    expect(item.baseType).toBe('Сандалии гонца дюн');
    expect(item.itemLevel).toBe(83);
    expect(item.quality).toBe(20);
    expect(item.sockets).toEqual(['S']);
    expect(item.runes).toHaveLength(1);

    const movement = groupNamed(item, 'Моментальная');
    expect(movement.lines[0]?.text).toBe('35% повышение скорости передвижения');
    expect(movement.lines[0]?.values[0]).toEqual({ raw: '35', rolled: 35 });

    const regen = groupNamed(item, 'выздоровления');
    expect(regen.lines[0]?.values[0]).toEqual({
      raw: '14.3(13.1-18)',
      rolled: 14.3,
      min: 13.1,
      max: 18,
    });
    expect(regen.lines[0]?.text).toBe('Регенерация 14.3 здоровья в секунду');

    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает путевой камень', () => {
    const item = parseFixture('waystone-advanced.txt');

    expect(item.itemClass).toBe('Путевые камни');
    expect(item.category).toBe('waystone');
    expect(item.rarity).toBe('rare');
    expect(item.name).toBe('Осквернённая граница');
    expect(item.baseType).toBe('Путевой камень');
    expect(item.waystoneTier).toBe(15);
    expect(item.itemLevel).toBe(82);
    expect(item.properties.map((property) => property.key)).toEqual([
      'waystoneRevives',
      'monsterPackSize',
      'monsterEffectiveness',
      'waystoneDropChance',
    ]);

    const chargedGround = groupNamed(item, 'Шоковый');
    expect(chargedGround.lines[0]?.text).toBe('Область содержит участки заряженной земли');
    expect(chargedGround.lines[0]?.fixedValue).toBe(true);
    expect(chargedGround.lines[0]?.values).toEqual([]);

    const hybrid = groupNamed(item, 'непоколебимых');
    expect(hybrid.lines).toHaveLength(2);

    expect(item.description).toEqual([
      'Можно использовать в Машине картоходца, чтобы войти на карту. Путевые камни одноразовые.',
    ]);
    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает уникальный амулет', () => {
    const item = parseFixture('unique-amulet-advanced.txt');

    expect(item.itemClass).toBe('Амулеты');
    expect(item.rarity).toBe('unique');
    expect(item.name).toBe('Астраментис');
    expect(item.baseType).toBe('Звёздный амулет');
    expect(item.itemLevel).toBe(81);
    expect(item.requirements).toEqual([{ key: 'level', value: 24 }]);

    const implicit = item.modifiers.find((modifier) => modifier.source === 'implicit');
    expect(implicit).toBeDefined();
    expect(implicit?.tags).toEqual(['Характеристика']);
    expect(implicit?.lines[0]?.values[0]).toEqual({
      raw: '+6(5-7)',
      rolled: 6,
      min: 5,
      max: 7,
    });

    const uniqueModifiers = item.modifiers.filter((modifier) => modifier.source === 'unique');
    expect(uniqueModifiers).toHaveLength(2);
    expect(uniqueModifiers[1]?.lines[0]?.values[0]).toEqual({ raw: '-4', rolled: -4 });
    expect(uniqueModifiers[1]?.lines[0]?.text).toBe(
      '-4 входящего физического урона при получении удара от атак',
    );

    expect(item.flavourText).toHaveLength(4);
    expect(item.unknownLines).toEqual([]);
  });

  it('не падает на пустом, мусорном и обрезанном тексте', () => {
    expect(parseItemText('').ok).toBe(false);
    expect(parseItemText('просто текст\nбез предмета').ok).toBe(false);

    for (const name of [
      'rare-helmet-advanced.txt',
      'rare-boots-advanced.txt',
      'waystone-advanced.txt',
      'unique-amulet-advanced.txt',
    ]) {
      const raw = fixture(name);
      const truncated = raw.slice(0, Math.floor(raw.length / 2));
      expect(() => parseItemText(truncated, 'ru')).not.toThrow();
    }
  });
});

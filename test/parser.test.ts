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

  it('разбирает редкий амулет с качеством чародейских свойств', () => {
    const item = parseFixture('rare-amulet-quality-advanced.txt');

    expect(item.itemClass).toBe('Амулеты');
    expect(item.category).toBe('jewellery');
    expect(item.rarity).toBe('rare');
    expect(item.name).toBe('Громадный медальон');
    expect(item.baseType).toBe('Амулет отсутствия');
    expect(item.quality).toBe(40);
    expect(item.qualityType).toBe('чародейские свойства');
    expect(item.requirements).toEqual([{ key: 'level', value: 60 }]);
    expect(item.flags.sanctified).toBe(true);
    expect(item.flags.fractured).toBe(true);
    expect(item.grantedSkills).toHaveLength(1);
    expect(item.grantedSkills[0] ?? '').toContain('Сотворение чар при кувырке');
    expect(item.flavourText?.[0] ?? '').toContain('Мы постигаем вечное');

    const fractured = groupNamed(item, 'Графский');
    expect(fractured.states).toContain('fractured');

    const crafted = groupNamed(item, 'Сущностный');
    expect(crafted.states).toContain('crafted');

    const castSpeed = groupNamed(item, 'чародея');
    expect(castSpeed.tags).toEqual(['Чародейский', 'Камень']);
    expect(castSpeed.annotation).toBe('40% увеличение');

    const desecrated = groupNamed(item, 'Ксофа');
    expect(desecrated.states).toContain('desecrated');
    expect(desecrated.annotation).toBe('40% увеличение');

    const implicit = item.modifiers.find((modifier) => modifier.source === 'implicit');
    expect(implicit?.lines).toHaveLength(2);
    expect(implicit?.lines[0]?.values[0]).toEqual({ raw: '-1', rolled: -1 });

    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает уникальный жезл', () => {
    const item = parseFixture('unique-wand-advanced.txt');

    expect(item.itemClass).toBe('Жезлы');
    expect(item.category).toBe('weapon');
    expect(item.subtype).toBe('wand');
    expect(item.rarity).toBe('unique');
    expect(item.name).toBe('Клич искателя рун');
    expect(item.baseType).toBe('Рунномастерская руническая вилка');
    expect(item.itemLevel).toBe(86);
    expect(item.sockets).toEqual(['S', 'S', 'S', 'S', 'S']);
    expect(item.requirements).toEqual([
      { key: 'level', value: 65 },
      { key: 'int', value: 88, augmented: true },
    ]);
    expect(item.runes).toHaveLength(4);
    expect(item.grantedSkills[0] ?? '').toContain('Звёздный вердикт');
    expect(item.flags.doubleCorrupted).toBe(true);

    const corrupted = item.modifiers.filter((modifier) => modifier.source === 'corrupted');
    expect(corrupted).toHaveLength(2);
    expect(corrupted[0]?.tags).toEqual(['Мана']);

    const implicit = item.modifiers.find((modifier) => modifier.source === 'implicit');
    expect(implicit?.tags).toEqual(['Чародейский']);

    const unique = item.modifiers.filter((modifier) => modifier.source === 'unique');
    expect(unique).toHaveLength(2);
    expect(unique[0]?.lines[0]?.fixedValue).toBe(true);
    expect(unique[1]?.lines[0]?.text).toBe('200% усиление эффекта размещенных рун');
    expect(item.flavourText).toHaveLength(4);
    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает редкий самоцвет', () => {
    const item = parseFixture('rare-jewel-advanced.txt');

    expect(item.itemClass).toBe('Самоцветы');
    expect(item.category).toBe('jewel');
    expect(item.name).toBe('Гипнотический губитель');
    expect(item.baseType).toBe('Сапфир');
    expect(item.itemLevel).toBe(70);

    const crafted = item.modifiers.find(
      (modifier) => modifier.states.includes('crafted') && modifier.affixName === undefined,
    );
    expect(crafted).toBeDefined();
    expect(crafted?.lines[0]?.fixedValue).toBe(true);

    const suffix = groupNamed(item, 'истребления');
    expect(suffix.tags).toEqual(['Критический']);
    expect(suffix.annotation).toBe('50% увеличение');

    expect(item.description?.[0] ?? '').toContain('Поместите в доступное гнездо');
    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает обычный нательный доспех', () => {
    const item = parseFixture('normal-body-armour-advanced.txt');

    expect(item.itemClass).toBe('Нательные доспехи');
    expect(item.category).toBe('armour');
    expect(item.subtype).toBe('bodyArmour');
    expect(item.rarity).toBe('normal');
    expect(item.name).toBeUndefined();
    expect(item.baseType).toBe('Образцовый Дублёный плащ');
    expect(item.itemLevel).toBe(81);
    expect(item.sockets).toEqual(['S', 'S', 'S']);

    expect(item.properties).toEqual([
      { key: 'evasion', label: 'Уклонение', values: ['285'] },
      { key: 'energyShield', label: 'Энергетический щит', values: ['87'] },
    ]);
    expect(item.requirements).toEqual([
      { key: 'level', value: 65 },
      { key: 'dex', value: 62, augmented: true },
      { key: 'int', value: 62, augmented: true },
    ]);
    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает редкое кольцо', () => {
    const item = parseFixture('rare-ring-advanced.txt');

    expect(item.itemClass).toBe('Кольца');
    expect(item.category).toBe('jewellery');
    expect(item.subtype).toBe('ring');
    expect(item.name).toBe('Разумное око');
    expect(item.baseType).toBe('Золотое кольцо');
    expect(item.quality).toBe(40);
    expect(item.qualityType).toBe('чародейские свойства');
    expect(item.requirements).toEqual([{ key: 'level', value: 64 }]);

    const implicit = item.modifiers.find((modifier) => modifier.source === 'implicit');
    expect(implicit?.tags).toEqual(['Выпадение']);

    const occult = groupNamed(item, 'Оккультное');
    expect(occult.annotation).toBe('40% увеличение');
    expect(occult.tier).toBeUndefined();

    const flame = groupNamed(item, 'Огнедышащее');
    expect(flame.states).toContain('desecrated');
    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает волшебный пояс', () => {
    const item = parseFixture('magic-belt-advanced.txt');

    expect(item.itemClass).toBe('Пояса');
    expect(item.category).toBe('jewellery');
    expect(item.subtype).toBe('belt');
    expect(item.rarity).toBe('magic');
    expect(item.name).toBe('Мощный Матерчатый пояс борца');
    expect(item.baseType).toBeUndefined();
    expect(item.requirements).toEqual([{ key: 'level', value: 30 }]);

    const implicits = item.modifiers.filter((modifier) => modifier.source === 'implicit');
    expect(implicits).toHaveLength(2);
    expect(implicits[0]?.tags).toEqual(['Мана']);
    expect(implicits[1]?.tags).toEqual(['Оберег']);
    expect(item.unknownLines).toEqual([]);
  });

  it('разбирает редкую плитку', () => {
    const item = parseFixture('rare-tablet-advanced.txt');

    expect(item.itemClass).toBe('Плитки');
    expect(item.category).toBe('tablet');
    expect(item.name).toBe('Тревожный план');
    expect(item.baseType).toBe('Заражённая плитка');
    expect(item.itemLevel).toBe(79);

    const implicit = item.modifiers.find((modifier) => modifier.source === 'implicit');
    expect(implicit?.lines).toHaveLength(2);
    expect(item.description?.[0] ?? '').toContain('Машине картоходца');
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
      'rare-amulet-quality-advanced.txt',
      'unique-wand-advanced.txt',
      'rare-jewel-advanced.txt',
      'normal-body-armour-advanced.txt',
      'rare-ring-advanced.txt',
      'magic-belt-advanced.txt',
      'rare-tablet-advanced.txt',
    ]) {
      const raw = fixture(name);
      const truncated = raw.slice(0, Math.floor(raw.length / 2));
      expect(() => parseItemText(truncated, 'ru')).not.toThrow();
    }
  });
});

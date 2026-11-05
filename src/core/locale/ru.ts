import type { LocaleDictionary } from './types';

/**
 * Русский клиент PoE2, advanced item copy (Ctrl+Alt+C).
 *
 * Строки подтверждены одиннадцатью реальными образцами (fixtures/ru/*.txt).
 * Всё, что не подтверждено, помечено TODO и расширяется по мере появления
 * новых образцов.
 */
export const ru: LocaleDictionary = {
  locale: 'ru',

  labels: {
    itemClass: 'Класс предмета',
    rarity: 'Редкость',
    requirements: 'Требуется',
    sockets: 'Гнезда',
    itemLevel: 'Уровень предмета',
    quality: 'Качество',
    stackSize: 'Размер стопки',
    tier: 'Уровень',
    grantedSkill: 'Дарует умение',
  },

  rarities: {
    'Обычный': 'normal', // TODO подтвердить образцом
    'Волшебный': 'magic', // TODO подтвердить образцом
    'Редкий': 'rare',
    'Уникальный': 'unique',
    'Валюта': 'currency', // TODO подтвердить образцом
    'Камень': 'gem', // TODO подтвердить образцом
  },

  itemClasses: {
    'Шлемы': { category: 'armour', subtype: 'helmet' },
    'Нательные доспехи': { category: 'armour', subtype: 'bodyArmour' },
    'Перчатки': { category: 'armour', subtype: 'gloves' },
    'Обувь': { category: 'armour', subtype: 'boots' },
    'Сапоги': { category: 'armour', subtype: 'boots' },
    'Щиты': { category: 'offhand', subtype: 'shield' },
    'Баклеры': { category: 'offhand', subtype: 'buckler' },
    'Фокусы': { category: 'offhand', subtype: 'focus' },
    'Колчаны': { category: 'offhand', subtype: 'quiver' },
    'Когти': { category: 'weapon', subtype: 'claw' },
    'Кинжалы': { category: 'weapon', subtype: 'dagger' },
    'Одноручные мечи': { category: 'weapon', subtype: 'oneHandSword' },
    'Одноручные топоры': { category: 'weapon', subtype: 'oneHandAxe' },
    'Одноручные булавы': { category: 'weapon', subtype: 'oneHandMace' },
    'Двуручные мечи': { category: 'weapon', subtype: 'twoHandSword' },
    'Двуручные топоры': { category: 'weapon', subtype: 'twoHandAxe' },
    'Двуручные булавы': { category: 'weapon', subtype: 'twoHandMace' },
    'Луки': { category: 'weapon', subtype: 'bow' },
    'Самострелы': { category: 'weapon', subtype: 'crossbow' },
    'Посохи': { category: 'weapon', subtype: 'staff' },
    'Боевые посохи': { category: 'weapon', subtype: 'quarterstaff' },
    'Копья': { category: 'weapon', subtype: 'spear' },
    'Кистени': { category: 'weapon', subtype: 'flail' },
    'Жезлы': { category: 'weapon', subtype: 'wand' },
    'Скипетры': { category: 'weapon', subtype: 'sceptre' },
    'Ловушки': { category: 'trap', subtype: 'trap' },
    'Амулеты': { category: 'jewellery', subtype: 'amulet' },
    'Кольца': { category: 'jewellery', subtype: 'ring' },
    'Пояса': { category: 'jewellery', subtype: 'belt' },
    'Талисманы': { category: 'jewellery', subtype: 'talisman' },
    'Путевые камни': { category: 'waystone' },
    'Камни умений': { category: 'gem', subtype: 'skill' },
    'Камни поддержки': { category: 'gem', subtype: 'support' },
    'Флаконы жизни': { category: 'flask', subtype: 'life' },
    'Флаконы маны': { category: 'flask', subtype: 'mana' },
    'Обереги': { category: 'charm', subtype: 'charm' },
    'Плитки': { category: 'tablet' },
    'Самоцветы': { category: 'jewel' },
    'Реликвии': { category: 'relic' },
  },

  modifierKinds: {
    'Префикс': { source: 'explicit', kind: 'prefix' },
    'Суффикс': { source: 'explicit', kind: 'suffix' },
    'Собственное свойство': { source: 'implicit', kind: 'none' },
    'Уникальное свойство': { source: 'unique', kind: 'none' },
    'Улучшение': { source: 'enchantment', kind: 'none' },
    'Улучшение от осквернения': { source: 'corrupted', kind: 'none' },
  },

  modifierStates: {
    'Очернённое': 'desecrated',
    'Очернённый': 'desecrated',
    'Очернённая': 'desecrated',
    'Расколотое': 'fractured',
    'Ремесленное': 'crafted',
  },

  properties: {
    'Энергетический щит': 'energyShield',
    'Уклонение': 'evasion',
    'Броня': 'armour',
    'Доступно возрождений': 'waystoneRevives',
    'Размер групп монстров': 'monsterPackSize',
    'Эффективность монстров': 'monsterEffectiveness',
    'Шанс выпадения путевого камня': 'waystoneDropChance',
  },

  requirements: {
    'Уровень': 'level',
    'Сил': 'str',
    'Лов': 'dex',
    'Ловк': 'dex',
    'Инт': 'int',
  },

  flags: {
    'Осквернено': 'corrupted',
    'Дважды осквернено': 'doubleCorrupted',
    'Расколото': 'fractured', // TODO подтвердить образцом
    'Расколотый предмет': 'fractured',
    'Освящено': 'sanctified',
  },

  markers: {
    augmented: 'augmented',
    rune: 'rune',
    fixedValue: 'Неизменяемое значение',
    unmet: 'unmet',
  },
};

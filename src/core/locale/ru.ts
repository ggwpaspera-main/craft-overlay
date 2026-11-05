import type { LocaleDictionary } from './types';

/**
 * Русский клиент PoE2, advanced item copy (Ctrl+Alt+C).
 *
 * Строки подтверждены четырьмя реальными образцами (fixtures/ru/*.txt).
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
    'Обувь': { category: 'armour', subtype: 'boots' },
    'Амулеты': { category: 'jewellery', subtype: 'amulet' },
    'Кольца': { category: 'jewellery', subtype: 'ring' },
    'Пояса': { category: 'jewellery', subtype: 'belt' },
    'Путевые камни': { category: 'waystone' },
    'Камни умений': { category: 'gem', subtype: 'skill' },
    'Камни поддержки': { category: 'gem', subtype: 'support' },
    'Флаконы жизни': { category: 'flask', subtype: 'life' },
    'Флаконы маны': { category: 'flask', subtype: 'mana' },
    'Плитки': { category: 'tablet' },
  },

  modifierKinds: {
    'Префикс': { source: 'explicit', kind: 'prefix' },
    'Суффикс': { source: 'explicit', kind: 'suffix' },
    'Собственное свойство': { source: 'implicit', kind: 'none' },
    'Уникальное свойство': { source: 'unique', kind: 'none' },
    'Улучшение': { source: 'enchantment', kind: 'none' },
  },

  modifierStates: {
    'Очернённое': 'desecrated',
    'Очернённый': 'desecrated',
    'Очернённая': 'desecrated',
  },

  properties: {
    'Энергетический щит': 'energyShield',
    'Доступно возрождений': 'waystoneRevives',
    'Размер групп монстров': 'monsterPackSize',
    'Эффективность монстров': 'monsterEffectiveness',
    'Шанс выпадения путевого камня': 'waystoneDropChance',
  },

  requirements: {
    'Уровень': 'level',
    'Сил': 'str',
    'Лов': 'dex',
    'Инт': 'int',
  },

  flags: {
    'Осквернено': 'corrupted',
    'Расколото': 'fractured', // TODO подтвердить образцом
    'Освящено': 'sanctified', // TODO подтвердить образцом
  },

  markers: {
    augmented: 'augmented',
    rune: 'rune',
    fixedValue: 'Неизменяемое значение',
    unmet: 'unmet',
  },
};

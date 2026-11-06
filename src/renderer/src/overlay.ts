/**
 * Рендерер отдельного окна-оверлея.
 *
 * Контракт с preload: window.craft.onCapture(callback: (text: string | null) => void).
 * Полученный сырой текст предмета разбирается тем же парсером, что и основное
 * окно, и рисуется компактной карточкой. Всё, что приходит из игры,
 * экранируется; внешних ресурсов нет.
 */

import { parseItemText } from '../../core/parser';
import { analyzeCraft } from '../../core/craft/advisor';
import type { CraftAdvice } from '../../core/craft/advisor';
import type { ModifierGroup, ModValue, ParsedItem, StatLine } from '../../core/types';

const RARITY_LABEL: Record<string, string> = {
  normal: 'Обычный',
  magic: 'Волшебный',
  rare: 'Редкий',
  unique: 'Уникальный',
  gem: 'Камень',
  currency: 'Валюта',
  unknown: 'Неизвестно',
};

const SOURCE_LABEL: Record<string, string> = {
  explicit: 'Свойство',
  implicit: 'Имплисит',
  unique: 'Уникальное',
  enchantment: 'Улучшение',
  corrupted: 'Осквернение',
  rune: 'Руна',
  unknown: 'Неизвестно',
};

const KIND_LABEL: Record<string, string> = {
  prefix: 'Префикс',
  suffix: 'Суффикс',
};

const STATE_LABEL: Record<string, string> = {
  fractured: 'расколото',
  desecrated: 'очернено',
  crafted: 'ремесленное',
  sanctified: 'освящено',
  unmodifiable: 'неизменяемо',
};

const FLAG_LABEL: Record<string, string> = {
  corrupted: 'Осквернено',
  doubleCorrupted: 'Дважды осквернено',
  fractured: 'Расколотый предмет',
  desecrated: 'Очернено',
  sanctified: 'Освящено',
  mirrored: 'Отзеркалено',
  split: 'Разделено',
  unmodifiable: 'Неизменяемо',
  unidentified: 'Неопознано',
};

const REQUIREMENT_LABEL: Record<string, string> = {
  level: 'Уровень',
  str: 'Сила',
  dex: 'Ловкость',
  int: 'Интеллект',
  unknown: 'Требование',
};

/** Горячие клавиши должны совпадать с src/main/index.ts. */
const CAPTURE_HOTKEY = 'Alt+F';
const HIDE_HOTKEY = 'Alt+Shift+F';

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Не найден элемент: ${selector}`);
  return element;
}

const root = queryRequired<HTMLElement>('#ov-root');
const minimizeButton = document.querySelector<HTMLButtonElement>('#ov-minimize');
const closeButton = document.querySelector<HTMLButtonElement>('#ov-close');

minimizeButton?.addEventListener('click', () => window.craft.hideOverlay());
closeButton?.addEventListener('click', () => window.craft.quitApp());

// Ручной drag: окно неактивируемое (focusable:false), поэтому нативный
// -webkit-app-region: drag на Windows не двигает его. Двигаем через IPC.
let dragging = false;
let lastDragX = 0;
let lastDragY = 0;

const titlebar = document.querySelector<HTMLElement>('#ov-titlebar');
titlebar?.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  const target = event.target;
  if (target instanceof Element && target.closest('button')) return;
  dragging = true;
  lastDragX = event.screenX;
  lastDragY = event.screenY;
  event.preventDefault();
});

window.addEventListener('mousemove', (event) => {
  if (!dragging) return;
  const dx = event.screenX - lastDragX;
  const dy = event.screenY - lastDragY;
  lastDragX = event.screenX;
  lastDragY = event.screenY;
  if (dx !== 0 || dy !== 0) window.craft.moveOverlay(dx, dy);
});

window.addEventListener('mouseup', () => {
  dragging = false;
});

/** Экранирует любой текст из игры перед вставкой через innerHTML. */
function escapeHtml(value: unknown): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (character) => map[character] ?? character);
}

function chip(text: string, extraClass = ''): string {
  const className = extraClass ? `ov-chip ${extraClass}` : 'ov-chip';
  return `<span class="${className}">${escapeHtml(text)}</span>`;
}

function block(title: string, body: string): string {
  return `<section class="ov-block"><h2 class="ov-block-title">${escapeHtml(title)}</h2>${body}</section>`;
}

function show(html: string, variant = ''): void {
  const className = variant ? `ov-panel ${variant}` : 'ov-panel';
  root.innerHTML = `<div class="${className}">${html}</div>`;
}

function renderIdle(): void {
  show(`
    <div class="ov-state">
      <div class="ov-state-title">Ожидание предмета</div>
      <div class="ov-state-text">
        Наведи курсор на предмет в игре и нажми
        <span class="ov-kbd">${escapeHtml(CAPTURE_HOTKEY)}</span> — карточка появится здесь.
      </div>
      <div class="ov-state-text ov-state-hint">
        <span class="ov-kbd">${escapeHtml(HIDE_HOTKEY)}</span> — скрыть оверлей.
      </div>
    </div>
  `);
}

function renderCaptureError(reason?: string): void {
  const detail = reason ? `<div class="ov-reason">${escapeHtml(reason)}</div>` : '';
  show(
    `
      <div class="ov-state ov-error">
        <div class="ov-state-title">Не удалось получить предмет</div>
        <div class="ov-state-text">
          Наведи курсор на предмет в игре и повтори
          <span class="ov-kbd">${escapeHtml(CAPTURE_HOTKEY)}</span>.
        </div>
        ${detail}
      </div>
    `,
    'ov-panel-error',
  );
}

function handleCapture(text: string | null): void {
  if (text === null) {
    renderCaptureError('Предмет не попал в буфер обмена.');
    return;
  }

  try {
    const parsed = parseItemText(text, 'ru');
    if (!parsed.ok || !parsed.item) {
      const reason = parsed.warnings.join('; ') || 'Не удалось разобрать текст предмета.';
      renderCaptureError(reason);
      return;
    }
    renderItem(parsed.item);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Неизвестная ошибка разбора.';
    renderCaptureError(reason);
  }
}

function renderItem(item: ParsedItem): void {
  const rarityClass = `ov-rarity-${item.rarity}`;
  const name = item.name ?? item.baseType ?? item.itemClass;

  const baseLine =
    item.name && item.baseType ? `<div class="ov-base">${escapeHtml(item.baseType)}</div>` : '';

  const chips: string[] = [];
  if (item.itemClass) chips.push(chip(item.itemClass));
  if (item.itemLevel !== undefined) chips.push(chip(`ilvl ${item.itemLevel}`));
  if (item.quality !== undefined) {
    const qualityType = item.qualityType ? ` · ${item.qualityType}` : '';
    chips.push(chip(`качество ${item.quality}%${qualityType}`));
  }
  if (item.waystoneTier !== undefined) chips.push(chip(`тир ${item.waystoneTier}`));
  if (item.sockets.length > 0) chips.push(chip(`сокеты ${item.sockets.join(' ')}`));

  const flagChips = Object.entries(item.flags)
    .filter(([, enabled]) => enabled === true)
    .map(([key]) => chip(FLAG_LABEL[key] ?? key, 'ov-flag'));

  const meta =
    chips.length + flagChips.length > 0
      ? `<div class="ov-chips">${chips.join('')}${flagChips.join('')}</div>`
      : '';

  const properties =
    item.properties.length > 0
      ? block(
          'Свойства',
          `<div class="ov-kv">${item.properties
            .map(
              (property) => `
                <div class="ov-kv-row">
                  <span class="ov-kv-label">${escapeHtml(property.label)}</span>
                  <span class="ov-kv-value">${escapeHtml(property.values.join(', '))}${property.augmented ? '<span class="ov-mini">aug</span>' : ''}</span>
                </div>`,
            )
            .join('')}</div>`,
        )
      : '';

  const requirements =
    item.requirements.length > 0
      ? block(
          'Требования',
          `<div class="ov-kv">${item.requirements
            .map(
              (requirement) => `
                <div class="ov-kv-row">
                  <span class="ov-kv-label">${escapeHtml(REQUIREMENT_LABEL[requirement.key] ?? requirement.key)}</span>
                  <span class="ov-kv-value">${requirement.value}${requirement.unmet ? '<span class="ov-mini ov-mini-bad">не выполнено</span>' : ''}${requirement.augmented ? '<span class="ov-mini">aug</span>' : ''}</span>
                </div>`,
            )
            .join('')}</div>`,
        )
      : '';

  let stats = '';
  if (properties && requirements) {
    stats = `<div class="ov-cols">${properties}${requirements}</div>`;
  } else {
    stats = properties || requirements;
  }

  const modifiers =
    item.modifiers.length > 0
      ? block(
          'Моды',
          `<div class="ov-mods">${item.modifiers.map((modifier) => renderModifier(modifier)).join('')}</div>`,
        )
      : '';

  const advice =
    item.category === 'weapon' ||
    item.category === 'armour' ||
    item.category === 'offhand' ||
    item.category === 'jewellery' ||
    item.category === 'flask' ||
    item.category === 'charm' ||
    item.category === 'jewel' ||
    item.category === 'waystone' ||
    item.category === 'tablet' ||
    item.category === 'trap' ||
    item.category === 'relic'
      ? analyzeCraft(item)
      : null;

  const grantedSkills =
    item.grantedSkills.length > 0
      ? block(
          'Дарует умения',
          `<ul class="ov-stats">${item.grantedSkills
            .map((skill) => `<li class="ov-stat"><span class="ov-stat-text">${escapeHtml(skill)}</span></li>`)
            .join('')}</ul>`,
        )
      : '';

  const runes =
    item.runes.length > 0
      ? block('Руны', `<ul class="ov-stats">${item.runes.map((line) => statLine(line)).join('')}</ul>`)
      : '';

  const flavour =
    item.flavourText && item.flavourText.length > 0
      ? `<blockquote class="ov-flavour">${item.flavourText.map((line) => escapeHtml(line)).join('<br>')}</blockquote>`
      : '';

  const description =
    item.description && item.description.length > 0
      ? block(
          'Описание',
          `<div class="ov-description">${item.description.map((line) => escapeHtml(line)).join('<br>')}</div>`,
        )
      : '';

  show(`
    <div class="ov-head">
      <div class="ov-rarity ${rarityClass}">${escapeHtml(RARITY_LABEL[item.rarity] ?? item.rarity)}</div>
      <h1 class="ov-name ${rarityClass}">${escapeHtml(name)}</h1>
      ${baseLine}
      ${meta}
    </div>
    <div class="ov-body">
      ${advice ? renderAdvice(advice) : ''}
      ${stats}
      ${modifiers}
      ${grantedSkills}
      ${runes}
      ${flavour}
      ${description}
    </div>
  `);
}

function renderAdvice(advice: CraftAdvice): string {
  const profile = escapeHtml(advice.profile);
  const warnings = advice.warnings.length
    ? `<div class="ov-advice-warnings">${advice.warnings.map((warning) => `<div>${escapeHtml(warning)}</div>`).join('')}</div>`
    : '';

  if (!advice.supported) {
    return `
      <div class="ov-advice ov-advice-off">
        <div class="ov-advice-head">Совет по крафту · ${profile}</div>
        <div class="ov-advice-summary">${escapeHtml(advice.summary)}</div>
        ${warnings}
      </div>
    `;
  }

  const steps = advice.steps
    .slice(0, 5)
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join('');

  const esBlock = advice.esBody
    ? `<div class="ov-advice-es ov-advice-es-${escapeHtml(advice.esBody.verdict)}">
        <div class="ov-advice-es-head">
          <span>ES <b>${advice.esBody.es}</b></span>
          <span>${advice.esBody.baseTierLabel ? escapeHtml(advice.esBody.baseTierLabel) : 'база вне тиров'}</span>
          <span>${advice.esBody.quality === null ? 'качество ?' : `качество ${advice.esBody.quality}%`}</span>
          <span>руны ${advice.esBody.runes}/${advice.esBody.sockets}</span>
        </div>
        <div class="ov-advice-es-plan">план: ${escapeHtml(advice.esBody.planLabel)} · цель ≥ ${advice.esBody.targetEs}</div>
        <ul>${advice.esBody.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join('')}</ul>
      </div>`
    : '';

  const targets = `
    <div class="ov-advice-targets">
      <div><b>P:</b> ${advice.targetPrefixes.map((target) => escapeHtml(target)).join(' · ')}</div>
      <div><b>S:</b> ${advice.targetSuffixes.map((target) => escapeHtml(target)).join(' · ')}</div>
    </div>
  `;

  return `
    <div class="ov-advice">
      <div class="ov-advice-head">Совет по крафту · ${profile}</div>
      <div class="ov-advice-summary">${escapeHtml(advice.summary)}</div>
      ${esBlock}
      <ol class="ov-advice-steps">${steps}</ol>
      ${targets}
      ${warnings}
    </div>
  `;
}

function renderModifier(group: ModifierGroup): string {
  const source = SOURCE_LABEL[group.source] ?? group.source;
  const kind = group.kind === 'none' ? '' : KIND_LABEL[group.kind] ?? group.kind;
  const title = kind ? `${source} · ${kind}` : source;

  const affixName = group.affixName
    ? `<span class="ov-affix">«${escapeHtml(group.affixName)}»</span>`
    : '';
  const tier =
    group.tier !== undefined ? `<span class="ov-tag ov-tag-tier">тир ${group.tier}</span>` : '';
  const annotation = group.annotation
    ? `<span class="ov-tag ov-tag-annotation">${escapeHtml(group.annotation)}</span>`
    : '';
  const states = group.states
    .filter((state) => state !== 'unknown')
    .map((state) => `<span class="ov-tag ov-tag-state">${escapeHtml(STATE_LABEL[state] ?? state)}</span>`)
    .join('');

  const lines =
    group.lines.length > 0
      ? `<ul class="ov-stats">${group.lines.map((line) => statLine(line)).join('')}</ul>`
      : '<div class="ov-stat-empty">—</div>';

  return `
    <div class="ov-mod ov-mod-${escapeHtml(group.source)}">
      <div class="ov-mod-head">
        <span class="ov-mod-source">${escapeHtml(title)}</span>
        ${affixName}${tier}${annotation}${states}
      </div>
      ${lines}
    </div>
  `;
}

function statLine(line: StatLine): string {
  const roll = formatValues(line.values);
  return `<li class="ov-stat">
    <span class="ov-stat-text">${escapeHtml(line.text)}</span>
    ${roll ? `<span class="ov-roll">${escapeHtml(roll)}</span>` : ''}
    ${line.fixedValue ? '<span class="ov-tag">фикс.</span>' : ''}
  </li>`;
}

function formatValues(values: ModValue[]): string {
  return values
    .map((value) => {
      if (value.rolled === null) {
        if (value.min !== undefined && value.max !== undefined) {
          return `(${value.min}–${value.max})`;
        }
        return '?';
      }
      if (value.min !== undefined && value.max !== undefined) {
        return `${value.rolled} (${value.min}–${value.max})`;
      }
      return String(value.rolled);
    })
    .join(' · ');
}

renderIdle();

const bridge = window.craft;
if (bridge && typeof bridge.onCapture === 'function') {
  bridge.onCapture((text) => handleCapture(text));
} else {
  renderCaptureError('Мост preload (window.craft.onCapture) недоступен.');
}

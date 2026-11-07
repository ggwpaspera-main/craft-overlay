import { parseItemText } from '../../core/parser';
import { analyzeCraft } from '../../core/craft/advisor';
import type { CraftAdvice, GoalCategory, GoalCurrentMod } from '../../core/craft/advisor';

const root = document.querySelector<HTMLElement>('#goal-root');
if (!root) throw new Error('Не найден #goal-root');
const rootElement: HTMLElement = root;

let dragging = false;
let lastDragX = 0;
let lastDragY = 0;

window.addEventListener('mousemove', (event) => {
  if (!dragging) return;
  const dx = event.screenX - lastDragX;
  const dy = event.screenY - lastDragY;
  lastDragX = event.screenX;
  lastDragY = event.screenY;
  if (dx !== 0 || dy !== 0) window.craft.moveGoal(dx, dy);
});

window.addEventListener('mouseup', () => {
  dragging = false;
});

function bindDrag(head: Element | null): void {
  head?.addEventListener('mousedown', (event) => {
    if (!(event instanceof MouseEvent) || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    dragging = true;
    lastDragX = event.screenX;
    lastDragY = event.screenY;
    event.preventDefault();
  });
}


function escapeHtml(value: unknown): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value).replace(/[&<>"']/g, (char) => map[char] ?? char);
}

function hide(): void {
  rootElement.innerHTML = '';
  window.craft.setGoalVisible(false);
}

function renderCategory(category: GoalCategory): string {
  const items = category.items?.length
    ? `<div class="goal-subitems">${category.items
        .map((item) => `<span class="goal-subitem">${escapeHtml(item)}</span>`)
        .join('')}</div>`
    : '';
  return `
    <div class="goal-category goal-color-${category.color}">
      <div class="goal-category-head">
        <span class="goal-kind">${category.kind === 'prefix' ? 'P' : 'S'}</span>
        <span class="goal-category-label">${escapeHtml(category.label)}</span>
        ${category.matched ? '<span class="goal-category-check">✓</span>' : ''}
      </div>
      ${items}
      <div class="goal-category-note">${escapeHtml(category.note)}</div>
    </div>`;
}

function renderCurrent(mod: GoalCurrentMod): string {
  return `
    <div class="goal-current goal-color-${mod.color}">
      <span class="goal-kind">${mod.kind === 'prefix' ? 'P' : 'S'}</span>
      <span>${escapeHtml(mod.text)}</span>
    </div>`;
}

let expanded = false;

function renderVerdict(advice: CraftAdvice): string {
  const verdict = advice.shortVerdict;
  const es = advice.esBody;
  if (!verdict) return '';
  const metrics = es
    ? `<div class="goal-verdict-metrics">
        <span>ES <b>${es.es}</b> → ${es.projectedEs}</span>
        <span>${es.quality === null ? 'качество ?' : `качество ${es.quality}%`}</span>
        <span>${es.runes > 0 ? 'руны есть' : 'рун нет'}</span>
      </div>`
    : '';
  return `
    <div class="goal-verdict goal-verdict-${verdict.tone}">
      <div class="goal-verdict-kicker">Промежуточная оценка</div>
      <div class="goal-verdict-title">${escapeHtml(verdict.title)}</div>
      <div class="goal-verdict-reason">${escapeHtml(verdict.reason)}</div>
      <div class="goal-verdict-action">${escapeHtml(verdict.action)}</div>
      ${metrics}
      <button id="goal-details-toggle" class="goal-details-toggle" type="button">Подробнее</button>
    </div>`;
}

function renderDetails(advice: CraftAdvice): string {
  const es = advice.esBody;
  const checks = es?.checks.length
    ? `<ul class="goal-details-list">${es.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join('')}</ul>`
    : '';
  const steps = advice.steps.length
    ? `<ul class="goal-details-list">${advice.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>`
    : '';
  const mods = advice.mods
    .map(
      (mod) => `<div class="goal-details-mod goal-details-mod-${mod.verdict}">
        <span class="goal-kind">${mod.kind === 'prefix' ? 'P' : 'S'}</span>
        <span>${mod.tier !== undefined ? `T${mod.tier} · ` : ''}${escapeHtml(mod.text)}</span>
      </div>`,
    )
    .join('');
  return `
    <aside class="goal-details">
      <div class="goal-details-head">Подробности</div>
      <div class="goal-details-summary">${escapeHtml(advice.summary)}</div>
      ${checks}
      <div class="goal-details-section-title">Моды</div>
      <div class="goal-details-mods">${mods}</div>
      <div class="goal-details-section-title">Шаги</div>
      ${steps}
    </aside>`;
}

function render(text: string | null): void {
  if (!text) {
    hide();
    return;
  }

  const parsed = parseItemText(text, 'ru');
  if (!parsed.item) {
    hide();
    return;
  }

  const advice: CraftAdvice = analyzeCraft(parsed.item);
  if (!advice.goal) {
    hide();
    return;
  }

  const goal = advice.goal;
  const prefixCategories = goal.categories.prefixes.map(renderCategory).join('');
  const suffixCategories = goal.categories.suffixes.map(renderCategory).join('');
  const currentPrefixes = goal.current.prefixes.map(renderCurrent).join('');
  const currentSuffixes = goal.current.suffixes.map(renderCurrent).join('');
  const trash = goal.trash
    .map(
      (mod) => `
        <div class="goal-trash-row">
          <span class="goal-trash-tag">мусор</span>
          <span class="goal-kind">${mod.kind === 'prefix' ? 'P' : 'S'}</span>
          <span>${escapeHtml(mod.text)}</span>
        </div>`,
    )
    .join('');

  rootElement.innerHTML = `
    <div class="goal-head">
      <span class="goal-kicker">Цель крафта</span>
      <button class="goal-close" type="button" aria-label="Скрыть цель">×</button>
    </div>
    <div class="goal-content">
      <div class="goal-columns">
        <section class="goal-column goal-column-left">
          <div class="goal-image">
            <img src="${escapeHtml(goal.baseImage)}" alt="${escapeHtml(goal.baseLabel)}">
            <div class="goal-base">${escapeHtml(goal.baseLabel)}</div>
            <div class="goal-sub">Хорошие свойства, которые мы ищем</div>
          </div>
          <div class="goal-categories">
            <section class="goal-category-column">
              <h3>Префиксы</h3>
              ${prefixCategories}
            </section>
            <section class="goal-category-column">
              <h3>Суффиксы</h3>
              ${suffixCategories}
            </section>
          </div>
        </section>

        <section class="goal-column goal-column-right">
          <div class="goal-bingo-head">
            <h3>Выпавшие свойства</h3>
            <span>цвет = категория; заливка = свойство есть</span>
          </div>
          <div class="goal-bingo">
            <section class="goal-bingo-column">
              <h4>Префиксы</h4>
              ${currentPrefixes || '<div class="goal-empty">нет</div>'}
            </section>
            <section class="goal-bingo-column">
              <h4>Суффиксы</h4>
              ${currentSuffixes || '<div class="goal-empty">нет</div>'}
            </section>
          </div>
          ${trash ? `<div class="goal-trash"><div class="goal-trash-head">Мусорные свойства</div>${trash}</div>` : ''}
          ${renderVerdict(advice)}
        </section>
        ${renderDetails(advice)}
      </div>
    </div>
  `;

  rootElement.classList.toggle('expanded', expanded);
  rootElement.querySelector<HTMLButtonElement>('.goal-close')?.addEventListener('click', () => {
    window.craft.hideGoal();
  });
  const detailsToggle = rootElement.querySelector<HTMLButtonElement>('#goal-details-toggle');
  detailsToggle?.addEventListener('click', () => {
    expanded = !expanded;
    rootElement.classList.toggle('expanded', expanded);
    detailsToggle.textContent = expanded ? 'Скрыть подробности' : 'Подробнее';
    window.craft.setGoalExpanded(expanded);
  });
  if (detailsToggle) {
    detailsToggle.textContent = expanded ? 'Скрыть подробности' : 'Подробнее';
  }
  bindDrag(rootElement.querySelector('.goal-head'));
  window.craft.setGoalVisible(true);
}

window.craft.onCapture(render);

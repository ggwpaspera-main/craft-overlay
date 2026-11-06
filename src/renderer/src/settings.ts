import type { SettingsView } from './env';

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Не найден элемент: ${selector}`);
  return element;
}

export function initSettings(): void {
  if (!window.craft?.getSettings) return;

  const panel = required<HTMLElement>('#settings');
  const targetText = required<HTMLTextAreaElement>('#target-text');
  const targetError = required<HTMLElement>('#target-error');
  const targetList = required<HTMLElement>('#target-list');
  const tolerance = required<HTMLInputElement>('#tolerance');
  const league = required<HTMLInputElement>('#league');
  const priceRows = required<HTMLElement>('#price-rows');
  const pricesStatus = required<HTMLElement>('#prices-status');

  let manualPrices: Record<string, number> = {};

  function renderTargets(view: SettingsView): void {
    targetList.replaceChildren(
      ...view.targets.map((target) => {
        const row = document.createElement('li');
        const text = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = `${target.name} · ${target.baseType}`;
        const mods = document.createElement('div');
        mods.className = 'target-mods';
        mods.textContent = target.mods.join('; ');
        text.append(title, mods);

        const remove = document.createElement('button');
        remove.className = 'btn small';
        remove.type = 'button';
        remove.textContent = 'Удалить';
        remove.addEventListener('click', () => {
          void window.craft.removeTarget(target.id).then(render);
        });
        row.append(text, remove);
        return row;
      }),
    );
  }

  function renderPrices(view: SettingsView): void {
    manualPrices = Object.fromEntries(
      view.priceRows.flatMap((row) => (row.manual === null ? [] : [[row.id, row.manual]])),
    );
    priceRows.replaceChildren(
      ...view.priceRows.map((row) => {
        const line = document.createElement('tr');
        const label = document.createElement('td');
        label.textContent = row.label;
        const auto = document.createElement('td');
        auto.textContent = row.price === null ? '—' : row.price.toFixed(2);

        const manualCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = 'any';
        input.setAttribute('aria-label', `Цена вручную: ${row.label}`);
        input.value = row.manual === null ? '' : String(row.manual);
        input.addEventListener('change', () => {
          const value = Number(input.value);
          const { [row.id]: _removed, ...others } = manualPrices;
          void window.craft
            .updateSettings({
              manualPrices: input.value && value > 0 ? { ...others, [row.id]: value } : others,
            })
            .then(render);
        });
        manualCell.append(input);
        line.append(label, auto, manualCell);
        return line;
      }),
    );

    pricesStatus.textContent = view.pricesFetchedAt
      ? `Обновлено: ${new Date(view.pricesFetchedAt).toLocaleString('ru-RU')}`
      : 'Цены ещё не загружались';
  }

  function render(view: SettingsView): void {
    tolerance.value = String(view.tolerancePct);
    league.value = view.league;
    renderTargets(view);
    renderPrices(view);
  }

  required('#settings-open').addEventListener('click', () => {
    panel.hidden = false;
    void window.craft.getSettings().then(render);
  });
  required('#settings-close').addEventListener('click', () => {
    panel.hidden = true;
  });

  required('#target-add').addEventListener('click', () => {
    void window.craft.addTarget(targetText.value).then((result) => {
      if ('error' in result) {
        targetError.textContent = result.error;
        return;
      }
      targetError.textContent = '';
      targetText.value = '';
      render(result);
    });
  });

  tolerance.addEventListener('change', () => {
    void window.craft.updateSettings({ tolerancePct: Number(tolerance.value) }).then(render);
  });
  league.addEventListener('change', () => {
    void window.craft.updateSettings({ league: league.value }).then(render);
  });

  required('#prices-refresh').addEventListener('click', () => {
    pricesStatus.textContent = 'Загрузка…';
    void window.craft.refreshPrices().then(({ error, view }) => {
      render(view);
      if (error) pricesStatus.textContent = error;
    });
  });
}

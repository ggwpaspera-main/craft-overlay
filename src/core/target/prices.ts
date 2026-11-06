/** Ответ poe.ninja: /poe2/api/economy/exchange/current/overview. */
interface NinjaOverview {
  core?: { primary?: string; rates?: Record<string, number> };
  lines?: Array<{ id?: string; primaryValue?: number }>;
}

export const NINJA_TYPES = ['Currency', 'Ritual', 'Essences', 'Abyss', 'Runes', 'SoulCores', 'Idols', 'Breach', 'Delirium'] as const;

/** Переводит цены в Exalted Orb. Бросает исключение на незнакомом формате. */
export function parseNinjaOverview(json: unknown): Record<string, number> {
  const data = json as NinjaOverview;
  const primary = data?.core?.primary;
  const rate = primary === 'exalted' ? 1 : data?.core?.rates?.exalted;
  if (!Array.isArray(data?.lines) || !rate || rate <= 0) {
    throw new Error('poe.ninja: неизвестный формат ответа');
  }

  const prices: Record<string, number> = {};
  for (const line of data.lines) {
    if (line.id && typeof line.primaryValue === 'number' && line.primaryValue > 0) {
      prices[line.id] = line.primaryValue * rate;
    }
  }
  if (primary) prices[primary] = rate;
  prices.exalted = 1;
  return prices;
}

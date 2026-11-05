import type { ItemFlags } from './types';
import type { LocaleDictionary } from './locale/types';

/** Возвращает ключ флага, если строка — известный флаг ("Осквернено"). */
export function parseFlagLine(
  line: string,
  dict: LocaleDictionary,
): keyof ItemFlags | null {
  const trimmed = line.trim();
  return dict.flags[trimmed] ?? null;
}

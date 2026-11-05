import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface BaseEntry {
  slug: string;
  name: string;
  properties: Array<{ label: string; value: string }>;
  requirements: string[];
  implicitMods: string[];
}

interface BaseClass {
  slug: string;
  name: string;
  category: string;
  baseCount: number;
  bases: BaseEntry[];
}

interface BaseData {
  classes: BaseClass[];
}

interface CurrencyItem {
  name: string;
  effect: string;
  description?: string;
  en?: string;
  core?: boolean;
}

interface CurrencyData {
  coreCount: number;
  items: CurrencyItem[];
}

function readJson<T>(relativePath: string): T {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('data snapshots', () => {
  it('bases.json содержит все классы и базовые типы', () => {
    const data = readJson<BaseData>('../data/bases.json');
    expect(data.classes).toHaveLength(36);

    const total = data.classes.reduce((sum, item) => sum + item.bases.length, 0);
    expect(total).toBeGreaterThan(1800);

    for (const item of data.classes) {
      expect(item.slug).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.baseCount).toBe(item.bases.length);
      for (const base of item.bases) {
        expect(base.slug).toBeTruthy();
        expect(base.name).toBeTruthy();
      }
    }

    const swords = data.classes.find((item) => item.slug === 'One_Hand_Swords');
    expect(swords).toBeDefined();
    expect(swords?.bases.some((base) => base.slug === 'Golden_Blade')).toBe(true);

    const armour = data.classes.find((item) => item.slug === 'Body_Armours');
    expect(armour?.bases.some((base) => base.requirements.length > 0)).toBe(true);

    const waystones = data.classes.find((item) => item.slug === 'Waystones');
    expect(waystones?.bases[0]?.name).toContain('Путевой камень');

    const tablets = data.classes.find((item) => item.slug === 'Tablets');
    expect(tablets?.baseCount).toBe(0);
  });

  it('currency.json содержит 11 основных сфер и остальную валюту', () => {
    const data = readJson<CurrencyData>('../data/currency.json');
    expect(data.coreCount).toBe(11);
    expect(data.items.length).toBeGreaterThan(140);

    const core = data.items.filter((item) => item.core);
    expect(core).toHaveLength(11);
    expect(core.every((item) => Boolean(item.description))).toBe(true);

    for (const item of data.items) {
      expect(item.name).toBeTruthy();
      expect(typeof item.effect).toBe('string');
    }

    const chaos = data.items.find((item) => item.name === 'Сфера хаоса');
    expect(chaos).toBeDefined();
    expect(chaos?.en).toBe('Chaos Orb');
    expect(chaos?.effect).toContain('мод');
  });
});

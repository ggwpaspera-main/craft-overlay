const SEPARATOR = '--------';

/** Убирает BOM, приводит переводы строк к \n и обрезает хвостовые пробелы. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
}

/**
 * Делит текст предмета на секции по строке "--------".
 * Возвращает массив секций; каждая секция — массив строк без пустых краёв.
 */
export function splitSections(raw: string): string[][] {
  const lines = normalizeText(raw).split('\n');
  const sections: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === SEPARATOR) {
      sections.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  sections.push(current);

  return sections
    .map((section) => trimEmptyEdges(section))
    .filter((section) => section.length > 0);
}

function trimEmptyEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === '') start += 1;
  while (end > start && lines[end - 1]?.trim() === '') end -= 1;

  return lines.slice(start, end);
}

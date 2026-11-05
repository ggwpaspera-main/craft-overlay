import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseItemText } from './core/parser';

const file = process.argv[2];

if (!file) {
  console.error('Использование: npm.cmd run parse -- <путь к файлу с текстом предмета>');
  process.exit(1);
}

try {
  const raw = readFileSync(resolve(file), 'utf8');
  const result = parseItemText(raw, 'ru');
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  console.error(`Не удалось прочитать или разобрать файл: ${String(error)}`);
  process.exit(1);
}

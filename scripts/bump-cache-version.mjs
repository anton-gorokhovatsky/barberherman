import { readFile, writeFile } from 'node:fs/promises';

const version = process.argv[2] || new Date().toISOString()
  .slice(0, 16)
  .replace(/[-:T]/g, '');

const edits = [
  {
    file: 'index.html',
    replacements: [
      [/styles\.css\?v=[^"']+/g, `styles.css?v=${version}`],
      [/script\.js\?v=[^"']+/g, `script.js?v=${version}`],
    ],
  },
  {
    file: 'privacy.html',
    replacements: [[/styles\.css\?v=[^"']+/g, `styles.css?v=${version}`]],
  },
  {
    file: '404.html',
    replacements: [[/styles\.css\?v=[^"']+/g, `styles.css?v=${version}`]],
  },
];

for (const { file, replacements } of edits) {
  let source = await readFile(file, 'utf8');
  for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement);
  await writeFile(file, source);
}

console.log(`Cache version set to ${version}`);

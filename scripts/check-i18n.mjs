import { readdir, readFile } from "node:fs/promises";

// Flags Spanish keys defined in more than one dictionary file: the later spread silently wins.
const dir = "src/i18n/es";
const seen = new Map();
let problems = 0;
for (const file of (await readdir(dir)).filter((name) => name.endsWith(".ts") && name !== "index.ts")) {
  const text = await readFile(`${dir}/${file}`, "utf8");
  for (const [, key, value] of text.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) {
    const previous = seen.get(key);
    if (previous && previous.value !== value) { problems += 1; console.log(`conflict  ${JSON.stringify(key)}\n  ${previous.file}: ${previous.value}\n  ${file}: ${value}`); }
    else if (previous) console.log(`duplicate ${JSON.stringify(key)} in ${previous.file} and ${file}`);
    else seen.set(key, { file, value });
  }
}
console.log(`${seen.size} keys, ${problems} conflicting`);
process.exitCode = problems ? 1 : 0;

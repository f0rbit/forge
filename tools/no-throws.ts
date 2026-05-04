#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(ROOT, "src");
const PIXI = join(SRC, "pixi");

type Rule = { name: string; pattern: RegExp; allow_pixi: boolean };

const rules: readonly Rule[] = [
	{ name: "Date.now", pattern: /\bDate\.now\s*\(/, allow_pixi: true },
	{ name: "Math.random", pattern: /\bMath\.random\s*\(/, allow_pixi: true },
	{ name: "setTimeout", pattern: /\bsetTimeout\s*\(/, allow_pixi: true },
	{ name: "setInterval", pattern: /\bsetInterval\s*\(/, allow_pixi: true },
	{ name: "throw", pattern: /^\s*throw\s+/m, allow_pixi: true },
	{ name: "try block", pattern: /\btry\s*\{/, allow_pixi: true },
	{ name: "pixi import outside src/pixi", pattern: /from\s+["'](pixi\.js|@pixi\/[^"']+)["']/, allow_pixi: true },
];

const walk = function* (dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const s = statSync(full);
		if (s.isDirectory()) {
			yield* walk(full);
		} else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) {
			yield full;
		}
	}
};

let failed = 0;
for (const file of walk(SRC)) {
	const in_pixi = file.startsWith(PIXI);
	const text = readFileSync(file, "utf8");
	const lines = text.split("\n");
	for (const rule of rules) {
		if (in_pixi && rule.allow_pixi) continue;
		if (!rule.pattern.test(text)) continue;
		for (let n = 0; n < lines.length; n++) {
			const line = lines[n] as string;
			if (!rule.pattern.test(line)) continue;
			if (line.includes("// non-deterministic-ok:")) continue;
			console.error(`${relative(ROOT, file)}:${n + 1} forbidden: ${rule.name}`);
			console.error(`  ${line.trim()}`);
			failed += 1;
		}
	}
}

if (failed > 0) {
	console.error(`\n${failed} determinism violation(s) found.`);
	process.exit(1);
}
console.log("determinism check ok");

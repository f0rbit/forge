import { ok, err, type Result } from "@f0rbit/corpus";
import type { CommandError } from "./types.ts";

export type ParsedLine = { name: string; argv: readonly string[] };

export const tokenise = (line: string): Result<readonly string[], CommandError> => {
	const out: string[] = [];
	let cur = "";
	let in_quote: '"' | "'" | null = null;
	let escape = false;
	for (const ch of line) {
		if (escape) {
			cur += ch;
			escape = false;
			continue;
		}
		if (ch === "\\") {
			escape = true;
			continue;
		}
		if (in_quote) {
			if (ch === in_quote) {
				in_quote = null;
				continue;
			}
			cur += ch;
			continue;
		}
		if (ch === '"' || ch === "'") {
			in_quote = ch;
			continue;
		}
		if (ch === " " || ch === "\t") {
			if (cur.length > 0) {
				out.push(cur);
				cur = "";
			}
			continue;
		}
		cur += ch;
	}
	if (in_quote) return err({ kind: "parse", message: `unterminated ${in_quote} quote` });
	if (escape) return err({ kind: "parse", message: "trailing escape" });
	if (cur.length > 0) out.push(cur);
	return ok(out);
};

export const parse_line = (line: string): Result<ParsedLine, CommandError> => {
	const tokens = tokenise(line.trim());
	if (!tokens.ok) return tokens;
	if (tokens.value.length === 0) return err({ kind: "parse", message: "empty input" });
	const [name, ...argv] = tokens.value;
	return ok({ name: name as string, argv });
};

const num_re = /^-?\d+(\.\d+)?$/;
const bool_re = /^(true|false)$/i;

export const coerce_arg = (raw: string): string | number | boolean => {
	if (num_re.test(raw)) return Number(raw);
	if (bool_re.test(raw)) return raw.toLowerCase() === "true";
	return raw;
};

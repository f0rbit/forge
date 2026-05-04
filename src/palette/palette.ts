import { ok, err, type Result } from "@f0rbit/corpus";
import { z } from "zod";
import type { Ctx } from "../schedule.ts";
import { coerce_arg, parse_line } from "./parser.ts";
import { fuzzy_rank } from "./fuzzy.ts";
import type { Command, CommandError, SearchHit } from "./types.ts";

export type PaletteOpts = {
	history_size?: number;
};

export type Palette = {
	register: <A>(c: Command<A>) => void;
	unregister: (name: string) => boolean;
	commands: () => readonly Command<unknown>[];
	get: (name: string) => Command<unknown> | undefined;
	search: (query: string) => readonly SearchHit[];
	exec: (line: string, ctx: Ctx) => Promise<Result<string, CommandError>>;
	history: () => readonly string[];
	clear_history: () => void;
	recall: (offset: number) => string | undefined;
	open: () => boolean;
	toggle: () => void;
};

const validate = <A>(cmd: Command<A>, argv: readonly string[]): Result<A, CommandError> => {
	if (!cmd.args) return ok(argv as unknown as A);
	const coerced = argv.map(coerce_arg);
	const result = cmd.args.safeParse(coerced);
	if (result.success) return ok(result.data);
	const issues = result.error.issues.map(i => `${i.path.join(".") || "<root>"}: ${i.message}`);
	return err({ kind: "validation", issues });
};

export const palette = (opts?: PaletteOpts): Palette => {
	const max_history = opts?.history_size ?? 100;
	const registry = new Map<string, Command<unknown>>();
	const history_buf: string[] = [];
	let opened = false;

	const push_history = (line: string): void => {
		history_buf.push(line);
		if (history_buf.length > max_history) history_buf.shift();
	};

	const api: Palette = {
		register: <A>(c: Command<A>) => {
			registry.set(c.name, c as unknown as Command<unknown>);
		},
		unregister: name => registry.delete(name),
		commands: () => Array.from(registry.values()),
		get: name => registry.get(name),
		search: query => {
			const hits = fuzzy_rank(Array.from(registry.values()), query, c => c.name);
			return hits.map(h => ({ command: h.item, score: h.score }));
		},
		exec: async (line, ctx) => {
			const parsed = parse_line(line);
			if (!parsed.ok) return parsed;
			const { name, argv } = parsed.value;
			const cmd = registry.get(name);
			if (!cmd) return err({ kind: "unknown_command", name });
			const args = validate(cmd, argv);
			if (!args.ok) return args;
			push_history(line);
			const out = await cmd.run(args.value, ctx);
			return out;
		},
		history: () => history_buf.slice(),
		clear_history: () => {
			history_buf.length = 0;
		},
		recall: offset => {
			if (offset <= 0) return undefined;
			const idx = history_buf.length - offset;
			return history_buf[idx];
		},
		open: () => opened,
		toggle: () => {
			opened = !opened;
		},
	};
	return api;
};

export const palette_noop = (): Palette => palette();

export { z };

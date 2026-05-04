import { describe, expect, test } from "bun:test";
import { ok } from "@f0rbit/corpus";
import { z } from "zod";
import { palette, fuzzy_score, parse_line, tokenise } from "../../src/index.ts";
import { make_ctx } from "../helpers/ctx.ts";

describe("palette — registry", () => {
	test("register / unregister / commands", () => {
		const p = palette();
		p.register({ name: "alpha", run: () => ok("alpha-ran") });
		p.register({ name: "beta", run: () => ok("beta-ran") });
		expect(p.commands().map(c => c.name).sort()).toEqual(["alpha", "beta"]);
		expect(p.unregister("alpha")).toBe(true);
		expect(p.commands().map(c => c.name)).toEqual(["beta"]);
		expect(p.unregister("nothing")).toBe(false);
	});

	test("get returns the registered command", () => {
		const p = palette();
		p.register({ name: "x", desc: "test", run: () => ok("ok") });
		expect(p.get("x")?.desc).toBe("test");
	});
});

describe("palette — exec roundtrip", () => {
	test("calls run with parsed args, returns ok on success", async () => {
		const p = palette();
		const ctx = make_ctx();
		p.register({
			name: "echo",
			args: z.tuple([z.string()]),
			run: ([msg]) => ok(`echo:${msg}`),
		});
		const r = await p.exec("echo hi", ctx);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toBe("echo:hi");
	});

	test("validates args; returns validation error on bad input", async () => {
		const p = palette();
		const ctx = make_ctx();
		p.register({
			name: "add",
			args: z.tuple([z.number(), z.number()]),
			run: ([a, b]) => ok(`${a + b}`),
		});
		const bad = await p.exec("add 1 nope", ctx);
		expect(bad.ok).toBe(false);
		if (!bad.ok) expect(bad.error.kind).toBe("validation");
	});

	test("unknown command yields unknown_command error", async () => {
		const p = palette();
		const ctx = make_ctx();
		const r = await p.exec("nope", ctx);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("unknown_command");
	});

	test("empty input yields parse error", async () => {
		const p = palette();
		const ctx = make_ctx();
		const r = await p.exec("", ctx);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("parse");
	});

	test("unterminated quote yields parse error", async () => {
		const p = palette();
		const ctx = make_ctx();
		p.register({ name: "say", args: z.tuple([z.string()]), run: ([s]) => ok(s) });
		const r = await p.exec(`say "hello`, ctx);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("parse");
	});
});

describe("palette — history", () => {
	test("successful exec is appended to history", async () => {
		const p = palette();
		const ctx = make_ctx();
		p.register({ name: "noop", args: z.tuple([]), run: () => ok("ok") });
		await p.exec("noop", ctx);
		await p.exec("noop", ctx);
		expect(p.history()).toEqual(["noop", "noop"]);
	});

	test("recall returns input at offset", async () => {
		const p = palette();
		const ctx = make_ctx();
		p.register({ name: "noop", args: z.tuple([z.string()]), run: () => ok("ok") });
		await p.exec("noop a", ctx);
		await p.exec("noop b", ctx);
		await p.exec("noop c", ctx);
		expect(p.recall(1)).toBe("noop c");
		expect(p.recall(3)).toBe("noop a");
		expect(p.recall(99)).toBeUndefined();
	});

	test("clear_history empties the buffer", async () => {
		const p = palette();
		const ctx = make_ctx();
		p.register({ name: "noop", args: z.tuple([]), run: () => ok("ok") });
		await p.exec("noop", ctx);
		p.clear_history();
		expect(p.history()).toEqual([]);
	});

	test("history is bounded by history_size opt", async () => {
		const p = palette({ history_size: 2 });
		const ctx = make_ctx();
		p.register({ name: "noop", args: z.tuple([z.string()]), run: () => ok("ok") });
		await p.exec("noop a", ctx);
		await p.exec("noop b", ctx);
		await p.exec("noop c", ctx);
		expect(p.history()).toEqual(["noop b", "noop c"]);
	});
});

describe("palette — fuzzy search", () => {
	test("ranks matches; non-matches absent", () => {
		const p = palette();
		p.register({ name: "save", run: () => ok("") });
		p.register({ name: "load", run: () => ok("") });
		p.register({ name: "tscale", run: () => ok("") });
		const hits = p.search("sav");
		expect(hits.length).toBe(1);
		expect(hits[0]?.command.name).toBe("save");
	});

	test("subsequence matching with prefix bonus", () => {
		const p = palette();
		p.register({ name: "saveall", run: () => ok("") });
		p.register({ name: "rsa", run: () => ok("") });
		const hits = p.search("sa");
		const names = hits.map(h => h.command.name);
		expect(names[0]).toBe("saveall");
	});
});

describe("palette parser unit tests", () => {
	test("tokenise handles quoted strings", () => {
		const r = tokenise(`a "b c" d`);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toEqual(["a", "b c", "d"]);
	});

	test("tokenise rejects unterminated quote", () => {
		const r = tokenise(`a "b`);
		expect(r.ok).toBe(false);
	});

	test("parse_line splits name and argv", () => {
		const r = parse_line("save slot-1");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.name).toBe("save");
	});

	test("fuzzy_score returns null on miss", () => {
		expect(fuzzy_score("xyz", "abc")).toBeNull();
		expect(fuzzy_score("ab", "abc")).not.toBeNull();
	});
});

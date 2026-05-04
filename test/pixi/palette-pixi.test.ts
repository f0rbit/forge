import { describe, expect, test } from "bun:test";
import { ok } from "@f0rbit/corpus";
import { Container } from "pixi.js";
import { world, time, rng, resources, input, debug_noop, palette, type Ctx } from "../../src/index.ts";
import { palette_pixi } from "../../src/pixi/index.ts";

const make_ctx = (pal: ReturnType<typeof palette>): Ctx => ({
	time: time(),
	rng: rng(1),
	res: resources(),
	input: input(),
	debug: debug_noop(),
	palette: pal,
});

describe("palette_pixi", () => {
	test("type / submit runs registered command", async () => {
		const overlay = new Container();
		const pal = palette();
		pal.register({ name: "echo", run: () => ok("ran") });

		const ui = palette_pixi({
			overlay,
			palette: pal,
			get_ctx: () => make_ctx(pal),
		});

		ui.open();
		ui.type("echo");
		expect(ui.state().query).toBe("echo");
		expect(ui.state().hits.includes("echo")).toBe(true);

		await ui.submit();
		expect(ui.state().result).toBe("ran");
		ui.dispose();
	});

	test("autocomplete returns hits from palette.search", () => {
		const overlay = new Container();
		const pal = palette();
		pal.register({ name: "save", run: () => ok("") });
		pal.register({ name: "load", run: () => ok("") });

		const ui = palette_pixi({
			overlay,
			palette: pal,
			get_ctx: () => make_ctx(pal),
		});
		ui.open();
		ui.type("sa");
		expect(ui.state().hits.includes("save")).toBe(true);
		ui.dispose();
	});

	test("backspace removes last char", () => {
		const overlay = new Container();
		const pal = palette();
		const ui = palette_pixi({
			overlay,
			palette: pal,
			get_ctx: () => make_ctx(pal),
		});
		ui.type("abc");
		ui.backspace();
		expect(ui.state().query).toBe("ab");
		ui.dispose();
	});

	test("close hides the overlay and reflects palette open() state", () => {
		const overlay = new Container();
		const pal = palette();
		const ui = palette_pixi({
			overlay,
			palette: pal,
			get_ctx: () => make_ctx(pal),
		});
		ui.open();
		expect(pal.open()).toBe(true);
		ui.close();
		expect(pal.open()).toBe(false);
		ui.dispose();
	});

	test("renders runtime errors", async () => {
		const overlay = new Container();
		const pal = palette();
		const ui = palette_pixi({
			overlay,
			palette: pal,
			get_ctx: () => make_ctx(pal),
		});
		ui.open();
		ui.type("missing-cmd");
		await ui.submit();
		expect(ui.state().result).toMatch(/unknown/);
		ui.dispose();
	});
});

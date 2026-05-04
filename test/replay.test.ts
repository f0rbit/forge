import { describe, expect, test } from "bun:test";
import { input, replay, type ReplayDoc } from "../src/index.ts";
import { presets } from "../src/presets/index.ts";

describe("replay schema", () => {
	test("rejects malformed JSON", () => {
		const r = replay.load("{ not valid json");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("replay_parse_error");
	});

	test("rejects valid JSON failing schema", () => {
		const r = replay.load(JSON.stringify({ version: 2, seed: 1, fixed_dt: 0.016, frames: [] }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.kind).toBe("replay_validation_error");
	});

	test("accepts a minimal valid replay doc", () => {
		const doc: ReplayDoc = { version: 1, seed: 42, fixed_dt: 1 / 60, frames: [] };
		const r = replay.load(JSON.stringify(doc));
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.seed).toBe(42);
	});
});

describe("replay record/save/load round-trip", () => {
	test("recorded action stream round-trips through save/load identically", () => {
		const i = input(presets.platformer);
		let tick = 0;
		const rec = replay.record(i, { seed: 1, fixed_dt: 1 / 60, get_tick: () => tick });

		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		tick = 1;
		i.pump([]);
		tick = 2;
		i.pump([{ kind: "key.up", code: "Space", pad: null, t: 0 }]);

		const doc = rec.stop();
		const json = replay.save(doc);
		const loaded = replay.load(json);
		expect(loaded.ok).toBe(true);
		if (loaded.ok) expect(loaded.value).toEqual(doc);
	});

	test("press/release events recorded at correct ticks", () => {
		const i = input(presets.platformer);
		let tick = 0;
		const rec = replay.record(i, { seed: 1, fixed_dt: 1 / 60, get_tick: () => tick });

		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		tick = 5;
		i.pump([{ kind: "key.up", code: "Space", pad: null, t: 0 }]);

		const doc = rec.stop();
		expect(doc.frames.length).toBe(2);
		expect(doc.frames[0]?.tick).toBe(0);
		expect(doc.frames[1]?.tick).toBe(5);
		const press = doc.frames[0]?.events.find(e => e.kind === "press");
		const release = doc.frames[1]?.events.find(e => e.kind === "release");
		expect(press?.action).toBe("jump");
		expect(release?.action).toBe("jump");
	});

	test("axis changes recorded only when value changes", () => {
		const i = input(presets.movement2d);
		let tick = 0;
		const rec = replay.record(i, { seed: 1, fixed_dt: 1 / 60, get_tick: () => tick });

		i.pump([{ kind: "key.down", code: "KeyD", pad: null, t: 0 }]);
		tick = 1;
		i.pump([]);
		tick = 2;
		i.pump([]);
		tick = 3;
		i.pump([{ kind: "key.up", code: "KeyD", pad: null, t: 0 }]);

		const doc = rec.stop();
		expect(doc.frames.length).toBe(2);
		expect(doc.frames[0]?.tick).toBe(0);
		expect(doc.frames[1]?.tick).toBe(3);
	});
});

describe("replay playback drives action state", () => {
	test("inject_actions overrides input state on playback", () => {
		const i = input(presets.platformer);
		let tick = 0;
		const doc: ReplayDoc = {
			version: 1,
			seed: 1,
			fixed_dt: 1 / 60,
			frames: [
				{ tick: 0, events: [{ kind: "press", action: "jump", tick: 0 }] },
				{ tick: 5, events: [{ kind: "release", action: "jump", tick: 5 }] },
			],
		};
		const player = replay.play(doc, i, () => tick);
		i.pump([]);
		expect(i.pressed("jump")).toBe(true);
		tick = 1;
		i.pump([]);
		expect(i.pressed("jump")).toBe(true);
		tick = 5;
		i.pump([]);
		expect(i.pressed("jump")).toBe(false);
		expect(player.complete()).toBe(true);
		player.detach();
	});
});

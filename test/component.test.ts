import { describe, expect, test } from "bun:test";
import { component } from "../src/index.ts";

describe("component", () => {
	test("each call returns a unique key", () => {
		const a = component<number>("score");
		const b = component<number>("score");
		expect(a.key).not.toBe(b.key);
		expect(a.name).toBe("score");
		expect(b.name).toBe("score");
	});

	test("name carries through for serialization use", () => {
		const c = component<{ hp: number }>("health");
		expect(c.name).toBe("health");
		expect(typeof c.key).toBe("symbol");
	});
});

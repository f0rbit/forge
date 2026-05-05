import { describe, expect, test } from "bun:test";
import { component } from "../src/index.ts";

describe("component", () => {
	test("same name returns the same key (cross-bundle identity)", () => {
		const a = component<number>("score");
		const b = component<number>("score");
		expect(a.key).toBe(b.key);
		expect(a.name).toBe("score");
		expect(b.name).toBe("score");
	});

	test("different names return different keys", () => {
		const a = component<number>("score");
		const b = component<number>("health");
		expect(a.key).not.toBe(b.key);
	});

	test("name carries through for serialization use", () => {
		const c = component<{ hp: number }>("health");
		expect(c.name).toBe("health");
		expect(typeof c.key).toBe("symbol");
	});
});

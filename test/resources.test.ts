import { describe, expect, test } from "bun:test";
import { resources, resource } from "../src/index.ts";

describe("resources", () => {
	const score = resource<number>("score");
	const config = resource<{ debug: boolean }>("config");

	test("set then get returns the stored value", () => {
		const r = resources();
		r.set(score, 42);
		const got = r.get(score);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toBe(42);
	});

	test("get on missing resource returns resource_missing", () => {
		const r = resources();
		const got = r.get(score);
		expect(got.ok).toBe(false);
		if (!got.ok) {
			expect(got.error.kind).toBe("resource_missing");
			if (got.error.kind === "resource_missing") expect(got.error.resource).toBe("score");
		}
	});

	test("has reflects whether the resource is set", () => {
		const r = resources();
		expect(r.has(score)).toBe(false);
		r.set(score, 1);
		expect(r.has(score)).toBe(true);
	});

	test("remove deletes the resource", () => {
		const r = resources();
		r.set(score, 1);
		r.remove(score);
		expect(r.has(score)).toBe(false);
	});

	test("typed resources don't collide", () => {
		const r = resources();
		r.set(score, 10);
		r.set(config, { debug: true });
		const got = r.get(config);
		expect(got.ok && got.value.debug).toBe(true);
	});
});

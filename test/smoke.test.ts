import { describe, expect, test } from "bun:test";
import { VERSION } from "../src/index.ts";

describe("forge smoke", () => {
  test("module loads with a VERSION constant", () => {
    expect(VERSION).toBe("0.0.1");
  });
});

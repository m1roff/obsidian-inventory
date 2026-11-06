import { describe, expect, it } from "vitest";
import { describeError, formatLogLine, NO_DEBUG_LOG } from "../../src/domain/DebugLog";

const AT = new Date("2026-11-06T12:00:00.000Z");

describe("formatLogLine", () => {
  it("writes time, scope and message", () => {
    expect(formatLogLine(AT, "photo", "picked")).toBe("2026-11-06T12:00:00.000Z [photo] picked");
  });

  it("appends the details as one JSON object", () => {
    expect(formatLogLine(AT, "photo", "picked", { size: 12, name: "a.jpg" })).toBe(
      '2026-11-06T12:00:00.000Z [photo] picked {"size":12,"name":"a.jpg"}',
    );
  });

  it("does not throw on details that cannot be written", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(formatLogLine(AT, "photo", "picked", loop)).toContain("could not be written");
  });
});

describe("describeError", () => {
  it("keeps the stack of an error and the text of anything else", () => {
    expect(describeError(new Error("boom"))).toContain("boom");
    expect(describeError("plain")).toBe("plain");
  });
});

describe("NO_DEBUG_LOG", () => {
  it("is off and ignores writes", () => {
    expect(NO_DEBUG_LOG.enabled).toBe(false);
    expect(() => NO_DEBUG_LOG.write("a", "b")).not.toThrow();
  });
});

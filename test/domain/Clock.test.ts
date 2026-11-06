import { expect, it } from "vitest";
import { formatStamp } from "../../src/domain/Clock";

it("formats local time as YYYYMMDD-HHmmss with zero padding", () => {
  expect(formatStamp(new Date(2026, 0, 5, 3, 4, 9))).toBe("20260105-030409");
});

import { formatPhotoStamp } from "../../src/domain/Clock";

it("formats the photo prefix like the vault's existing photos", () => {
  expect(formatPhotoStamp(new Date(2026, 7, 23, 23, 26, 35, 540))).toBe("2026-08-23-23_26_35_540");
  expect(formatPhotoStamp(new Date(2026, 0, 5, 3, 4, 9, 7))).toBe("2026-01-05-03_04_09_007");
});

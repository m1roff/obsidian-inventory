import { describe, expect, it } from "vitest";
import { AttachCoverService } from "../../src/domain/AttachCoverService";
import { CoverWriter } from "../../src/domain/CoverWriter";

class FakeWriter implements CoverWriter {
  calls: { itemPath: string; fileName: string; bytes: ArrayBuffer }[] = [];
  async attach(itemPath: string, fileName: string, bytes: ArrayBuffer, _options?: unknown): Promise<void> {
    this.calls.push({ itemPath, fileName, bytes });
  }
}

const clock = { now: () => new Date(2026, 7, 23, 23, 26, 35, 540) };

describe("AttachCoverService", () => {
  it("names the file like the existing photos in the vault", async () => {
    const writer = new FakeWriter();
    const bytes = new ArrayBuffer(4);
    await new AttachCoverService(writer, clock).attach("Inventory_Items/X.md", { bytes, extension: "JPG" });
    expect(writer.calls).toEqual([
      { itemPath: "Inventory_Items/X.md", fileName: "2026-08-23-23_26_35_540-image.jpg", bytes },
    ]);
  });

  it("falls back to jpg for an unusable extension", async () => {
    const writer = new FakeWriter();
    await new AttachCoverService(writer, clock).attach("a.md", { bytes: new ArrayBuffer(0), extension: "../" });
    expect(writer.calls[0].fileName.endsWith("-image.jpg")).toBe(true);
  });
});

describe("AttachCoverService.attachAll", () => {
  it("adds every photo in order to the chosen section and lets only the first touch the cover", async () => {
    const calls: { fileName: string; cover: string; heading: string }[] = [];
    const writer: CoverWriter = {
      async attach(_path, fileName, _bytes, options) {
        calls.push({ fileName, cover: options.cover, heading: options.heading });
      },
    };
    const images = [1, 2, 3].map(() => ({ bytes: new ArrayBuffer(1), extension: "jpg" }));
    await new AttachCoverService(writer, clock).attachAll("a.md", images, { cover: "ifEmpty", heading: "# Gallery" });
    expect(calls.map((call) => call.cover)).toEqual(["ifEmpty", "none", "none"]);
    expect(calls.every((call) => call.heading === "# Gallery")).toBe(true);
  });

  it("does nothing for an empty list", async () => {
    const writer = new FakeWriter();
    await new AttachCoverService(writer, clock).attachAll("a.md", []);
    expect(writer.calls).toEqual([]);
  });
});

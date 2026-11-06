import { describe, expect, it } from "vitest";
import { appendToSection } from "../../src/domain/MarkdownSection";

const H = "## Real photo";
const card = `---\nid: X\n---\n\n## Stock\n\n![[Stock positions.base#Current Product]]\n\n\n# Extra description\n\n\n${H}\n\n## Item card photos\n`;

describe("appendToSection", () => {
  it("puts the line into an empty section, keeping the next heading separated", () => {
    expect(appendToSection(card, H, "![[a.jpg]]")).toBe(
      card.replace(`${H}\n\n## Item`, `${H}\n\n![[a.jpg]]\n\n## Item`),
    );
  });

  it("appends after existing embeds", () => {
    const once = appendToSection(card, H, "![[a.jpg]]");
    const twice = appendToSection(once, H, "![[b.jpg]]");
    expect(twice).toContain(`${H}\n\n![[a.jpg]]\n![[b.jpg]]\n\n## Item`);
  });

  it("works when the section is the last thing in the note", () => {
    expect(appendToSection(`# T\n\n${H}\n`, H, "![[a.jpg]]")).toBe(`# T\n\n${H}\n\n![[a.jpg]]\n`);
  });

  it("creates the section when it is missing", () => {
    expect(appendToSection("# T\ntext\n", H, "![[a.jpg]]")).toBe(`# T\ntext\n\n${H}\n\n![[a.jpg]]\n`);
  });
});

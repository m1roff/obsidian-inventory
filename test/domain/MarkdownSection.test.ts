import { describe, expect, it } from "vitest";
import { appendToSection, findHeadings } from "../../src/domain/MarkdownSection";

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

describe("appendToSection with ranks", () => {
  const note = "# Notes\ntext\n\n## Sub\nsub text\n\n# Other\nmore\n";

  it("keeps a # section's own ## subsections inside it", () => {
    expect(appendToSection(note, "# Notes", "![[a.jpg]]")).toBe(
      "# Notes\ntext\n\n## Sub\nsub text\n\n![[a.jpg]]\n\n# Other\nmore\n",
    );
  });

  it("ends a ## section at the next # heading", () => {
    expect(appendToSection("## Real photo\n\n# Next\n", "## Real photo", "![[a.jpg]]")).toBe(
      "## Real photo\n\n![[a.jpg]]\n\n# Next\n",
    );
  });
});

describe("findHeadings", () => {
  it("lists the headings of one rank in order and skips the properties and code", () => {
    const text = "---\n# not a heading\n---\n# One\n## Two\n```\n# in code\n```\n# Three\n#tag\n";
    expect(findHeadings(text, 1)).toEqual(["# One", "# Three"]);
    expect(findHeadings(text, 2)).toEqual(["## Two"]);
  });
});

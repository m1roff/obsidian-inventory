/**
 * The plugin's emblem (an open box with a crystal), drawn from one set of shapes.
 * The shapes come from icons/inventory-outline-*.svg (viewBox 1254 x 1254).
 * Two renderings use them: the Obsidian icon (follows the theme colour) and the
 * black-and-white emblem in QR labels (see QrLogo).
 */

export const INVENTORY_ICON_ID = "inventory-ui";

/** The box outline: stroked lines. */
export const ICON_OUTLINE_PATHS: readonly string[] = [
  "M435 353 207 453 310 554 450 493",
  "M811 353 1043 453 941 554 802 493",
  "M451 620V410L625 225 797 410V620",
  "M450 493 309 552 625 710 500 811 195 659 309 552",
  "M803 493 942 552 625 710 746 811 1045 659 942 552",
  "M290 713V873L625 1038 955 873V713",
  "M625 710V1038",
];

/** The crystal: flat-colour facets, with the colour used in the Obsidian icon. */
export const ICON_FACETS: readonly { readonly points: string; readonly color: string }[] = [
  { points: "625,274 486,423 565,487", color: "#EBD5FF" },
  { points: "625,274 565,487 622,509", color: "#B876F1" },
  { points: "625,274 622,509 688,482", color: "#A361E6" },
  { points: "625,274 688,482 760,422", color: "#6938C2" },
  { points: "486,423 565,487 550,591 543,657 486,622", color: "#AE67EF" },
  { points: "565,487 622,509 550,591", color: "#8638D6" },
  { points: "622,509 688,482 622,697 543,657 550,591", color: "#6A27C1" },
  { points: "688,482 760,422 760,622 622,697", color: "#BB7AEE" },
];

/** The part of the 1254 x 1254 sheet the drawing actually covers (with room for the stroke). */
export const ICON_BOUNDS = { x: 180, y: 210, width: 880, height: 845 } as const;

/** An SVG path for a facet's polygon. */
export function facetPath(points: string): string {
  const pairs = points.trim().split(/\s+/);
  return `M${pairs.join("L")}Z`;
}

/**
 * Markup for Obsidian's `addIcon`: it is drawn on a 100 x 100 sheet.
 * Lines use the current text colour, so the icon follows light and dark themes;
 * the crystal keeps its own colours.
 */
export function inventoryIconMarkup(): string {
  const scale = 100 / ICON_BOUNDS.width;
  const offsetX = -ICON_BOUNDS.x * scale;
  const offsetY = (100 - ICON_BOUNDS.height * scale) / 2 - ICON_BOUNDS.y * scale;
  const outline = ICON_OUTLINE_PATHS.map((d) => `<path d="${d}"/>`).join("");
  const facets = ICON_FACETS.map(
    (facet) => `<path d="${facetPath(facet.points)}" fill="${facet.color}"/>`,
  ).join("");
  // Thicker line than the source drawing: at 16-24 px a thin stroke disappears.
  return (
    `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})">` +
    `<g stroke="none">${facets}</g>` +
    `<g fill="none" stroke="currentColor" stroke-width="52" stroke-linecap="round" stroke-linejoin="round">${outline}</g>` +
    `</g>`
  );
}

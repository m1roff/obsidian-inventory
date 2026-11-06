/** Dev-build only: dumps what decides whether a modal can scroll, for Safari's Web Inspector. */
const PREFIX = "[inventory-ui qr]";

function styleOf(el: HTMLElement): Record<string, string | number> {
  const s = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    el: `${el.tagName.toLowerCase()}.${Array.from(el.classList).join(".")}`,
    display: s.display,
    position: s.position,
    height: s.height,
    maxHeight: s.maxHeight,
    minHeight: s.minHeight,
    overflowY: s.overflowY,
    transform: s.transform,
    top: Math.round(rect.top),
    bottom: Math.round(rect.bottom),
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    scrollTop: Math.round(el.scrollTop),
  };
}

/** The element and every ancestor up to <body>: one of them is what stops the scrolling. */
function chain(el: HTMLElement): Array<Record<string, string | number>> {
  const result: Array<Record<string, string | number>> = [];
  for (let node: HTMLElement | null = el; node && node !== document.documentElement; node = node.parentElement) {
    result.push(styleOf(node));
  }
  return result;
}

export function debugLog(
  label: string,
  modalEl: HTMLElement,
  contentEl: HTMLElement,
  extra: Record<string, unknown> = {},
): void {
  const viewport = window.visualViewport;
  const focused = document.activeElement;
  // warn level so it shows even when the inspector hides plain logs
  console.warn(PREFIX, label, {
    ...extra,
    focused: focused instanceof HTMLElement ? `${focused.tagName}.${focused.className}` : "(none)",
    modalClasses: modalEl.className,
    keyboardVar: modalEl.style.getPropertyValue("--inventory-ui-keyboard-height") || "(unset)",
    window: { innerHeight: window.innerHeight, innerWidth: window.innerWidth },
    visualViewport: viewport
      ? {
          height: Math.round(viewport.height),
          offsetTop: Math.round(viewport.offsetTop),
          pageTop: Math.round(viewport.pageTop),
          scale: viewport.scale,
        }
      : null,
    spacerHeight: contentEl.querySelector(".inventory-ui__keyboard-spacer")?.getBoundingClientRect().height ?? "none",
    chain: chain(contentEl),
  });
}

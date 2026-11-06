import { Notice, Setting } from "obsidian";
import { saveFile } from "./FileDownload";
import { canvasToPng, renderIconCanvas } from "./IconExport";
import { QrLogo } from "./QrLogo";
import { STRINGS } from "./strings";

export interface IconExportDeps {
  readonly itemLogo: QrLogo;
  readonly placeLogo: QrLogo;
}

interface IconKind {
  readonly name: string;
  readonly desc: string;
  readonly fileName: string;
  readonly logo: QrLogo;
}

/**
 * Settings block that shares the QR emblems as PNG files (black on a transparent ground).
 * Each file is made once, the first time it is needed, and kept: on a phone the share
 * sheet only opens right after a tap, so a tap should not wait for drawing.
 */
export class IconExportPanel {
  private readonly files = new Map<string, File>();
  private readonly pictures = new Map<string, HTMLCanvasElement>();

  constructor(private readonly deps: IconExportDeps) {}

  render(parent: HTMLElement): void {
    new Setting(parent).setName(STRINGS.iconsName).setDesc(STRINGS.iconsDesc).setHeading();
    const kinds: IconKind[] = [
      { name: STRINGS.iconItemName, desc: STRINGS.iconItemDesc, fileName: "inventory-icon.png", logo: this.deps.itemLogo },
      { name: STRINGS.iconPlaceName, desc: STRINGS.iconPlaceDesc, fileName: "inventory-place-icon.png", logo: this.deps.placeLogo },
    ];
    const previews: Array<[IconKind, HTMLElement]> = [];
    for (const kind of kinds) {
      const row = new Setting(parent)
        .setName(kind.name)
        .setDesc(kind.desc)
        .addButton((button) => button.setButtonText(STRINGS.iconShare).onClick(() => void this.share(kind)));
      // The icon is black on a see-through ground, so it is shown on white, the way it prints.
      const preview = createDiv({ cls: "inventory-ui__icon-preview" });
      row.settingEl.prepend(preview);
      previews.push([kind, preview]);
    }
    // Drawn now, while the block opens, so the tap itself can hand the file over at once.
    void this.prepare(previews).catch((error: unknown) => console.error(error));
  }

  private async prepare(previews: ReadonlyArray<[IconKind, HTMLElement]>): Promise<void> {
    for (const [kind, preview] of previews) {
      await this.fileOf(kind);
      const picture = this.pictures.get(kind.fileName);
      if (picture) preview.appendChild(this.copyOf(picture));
    }
  }

  /** A fresh canvas with the same picture: a canvas node can sit in one place only. */
  private copyOf(source: HTMLCanvasElement): HTMLCanvasElement {
    const copy = createEl("canvas");
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext("2d")?.drawImage(source, 0, 0);
    return copy;
  }

  private async fileOf(kind: IconKind): Promise<File> {
    const known = this.files.get(kind.fileName);
    if (known) return known;
    const canvas = renderIconCanvas(kind.logo);
    this.pictures.set(kind.fileName, canvas);
    const blob = await canvasToPng(canvas);
    const file = new File([blob], kind.fileName, { type: "image/png" });
    this.files.set(kind.fileName, file);
    return file;
  }

  private async share(kind: IconKind): Promise<void> {
    try {
      const outcome = await saveFile(await this.fileOf(kind));
      if (outcome !== "cancelled") new Notice(STRINGS.iconDone(kind.fileName));
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        new Notice(STRINGS.iconTapAgain);
        return;
      }
      console.error(error);
      new Notice(STRINGS.unexpectedError);
    }
  }
}

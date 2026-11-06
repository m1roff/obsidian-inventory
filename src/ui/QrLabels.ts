import { App, Modal, Notice, Setting, TextComponent } from "obsidian";
import { InventoryEntry } from "../domain/InventoryEntry";
import { buildItemLink, buildPlaceLink } from "../domain/ItemLink";
import { Place } from "../domain/Place";
import { QrEncoder } from "../domain/QrCode";
import { QrLabelOptions, qrFileName } from "../domain/QrLabel";
import { QrStyle, qrPalette } from "../domain/QrStyle";
import { labelsCsv, labelsFileName } from "../domain/LabelExport";
import { saveTextFile } from "./FileDownload";
import { guardKeyboard } from "./KeyboardGuard";
import { QrLogo } from "./QrLogo";
import { renderQrLabel } from "./QrLabelRenderer";
import { STRINGS } from "./strings";

export interface QrLabelsDeps {
  readonly encoder: QrEncoder;
  readonly itemLogo: QrLogo;
  readonly placeLogo: QrLogo;
  /** The look chosen in the settings, read when a label is drawn. */
  readonly style: () => QrStyle;
}

/** What a label is made for: its id, the name offered as caption, what the code carries and the emblem. */
interface QrSubject {
  readonly id: string;
  readonly name: string;
  readonly link: (vaultName: string) => string;
  readonly logo: QrLogo;
}

/** Opens the window that builds a QR label for an item or a place. */
export class QrLabels {
  constructor(
    private readonly app: App,
    private readonly deps: QrLabelsDeps,
  ) {}

  openItem(entry: InventoryEntry): void {
    if (entry.item.id.trim() === "") {
      new Notice(STRINGS.qrNoId);
      return;
    }
    this.open({
      id: entry.item.id,
      name: entry.item.name,
      link: (vault) => buildItemLink(vault, entry.item.id),
      logo: this.deps.itemLogo,
    });
  }

  /** The place must already have an id. */
  openPlace(place: Place): void {
    if (place.id.trim() === "") {
      new Notice(STRINGS.qrNoId);
      return;
    }
    this.open({
      id: place.id,
      name: place.name,
      link: (vault) => buildPlaceLink(vault, place.id),
      logo: this.deps.placeLogo,
    });
  }

  private open(subject: QrSubject): void {
    new QrLabelModal(this.app, this.deps.encoder, subject, this.deps.style()).open();
  }
}

class QrLabelModal extends Modal {
  private options: QrLabelOptions;
  private blob: Blob | null = null;
  private previewEl: HTMLElement | null = null;
  private captionSetting: Setting | null = null;
  private captionInput: TextComponent | null = null;

  constructor(
    app: App,
    private readonly encoder: QrEncoder,
    private readonly subject: QrSubject,
    /** The look from the settings: where this window starts. Changing it here changes nothing else. */
    private style: QrStyle,
  ) {
    super(app);
    this.options = { showId: true, showCaption: false, caption: subject.name };
  }

  onOpen(): void {
    this.setTitle(STRINGS.qrTitle);
    this.modalEl.addClass("inventory-ui__qr-modal");
    const { contentEl } = this;
    contentEl.empty();

    this.previewEl = contentEl.createDiv({ cls: "inventory-ui__qr-preview" });

    new Setting(contentEl)
      .setName(STRINGS.qrLightName)
      .setDesc(STRINGS.qrLightDesc)
      .addToggle((toggle) =>
        toggle.setValue(this.style === "dark").onChange((value) => {
          this.style = value ? "dark" : "light";
          this.draw();
        }),
      );

    new Setting(contentEl)
      .setName(STRINGS.qrShowId)
      .setDesc(STRINGS.qrShowIdDesc)
      .addToggle((toggle) =>
        toggle.setValue(this.options.showId).onChange((value) => {
          this.options = { ...this.options, showId: value };
          this.draw();
        }),
      );

    new Setting(contentEl)
      .setName(STRINGS.qrShowCaption)
      .setDesc(STRINGS.qrShowCaptionDesc)
      .addToggle((toggle) =>
        toggle.setValue(this.options.showCaption).onChange((value) => {
          // Switching it on again starts over with the item's name.
          this.options = {
            ...this.options,
            showCaption: value,
            caption: value ? this.subject.name : this.options.caption,
          };
          this.captionInput?.setValue(this.options.caption);
          this.captionSetting?.settingEl.toggle(value);
          this.draw();
        }),
      );

    this.captionSetting = new Setting(contentEl)
      .setName(STRINGS.qrCaption)
      .addText((text) => {
        this.captionInput = text;
        text.setValue(this.options.caption).onChange((value) => {
          this.options = { ...this.options, caption: value };
          this.draw();
        });
              });
    this.captionSetting.settingEl.toggle(this.options.showCaption);

    new Setting(contentEl)
      .setName(STRINGS.qrCsvName)
      .setDesc(STRINGS.qrCsvDesc)
      .addButton((button) => button.setButtonText(STRINGS.qrCsvButton).onClick(() => void this.shareCsv()));

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText(STRINGS.qrShare)
          .setCta()
          .onClick(() => this.share()),
      )
      .settingEl.addClass("inventory-ui__modal-actions");

    guardKeyboard(this);
    this.draw();
  }

  /** Redraws the preview and prepares the picture, so sharing can start right on the tap. */
  private draw(): void {
    const canvas = renderQrLabel(
      this.encoder.encode(this.subject.link(this.app.vault.getName())),
      this.subject.id,
      this.options,
      this.subject.logo,
      qrPalette(this.style),
    );
    this.previewEl?.empty();
    this.previewEl?.appendChild(canvas);

    this.blob = null;
    canvas.toBlob((blob) => {
      // Ignore a result that arrives after a newer drawing replaced this canvas.
      if (this.previewEl?.firstChild === canvas) this.blob = blob;
    }, "image/png");
  }

  /** The same label as one row of the table a label printer program reads: id, name, link. */
  private async shareCsv(): Promise<void> {
    const row = { id: this.subject.id, name: this.subject.name, link: this.subject.link(this.app.vault.getName()) };
    try {
      const outcome = await saveTextFile(labelsFileName(this.subject.id, new Date()), labelsCsv([row]));
      if (outcome !== "cancelled") new Notice(STRINGS.exportDone(1));
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.unexpectedError);
    }
  }

  private share(): void {
    const blob = this.blob;
    if (!blob) {
      new Notice(STRINGS.qrNotReady);
      return;
    }
    const file = new File([blob], qrFileName(this.subject.id, this.subject.name), { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch((error: unknown) => {
        // Closing the share sheet counts as an error too: not worth a message.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error(error);
          new Notice(STRINGS.qrShareFailed);
        }
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = createEl("a", { href: url });
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    new Notice(STRINGS.qrSaved);
  }
}

import { AddItemError } from "./NewItemDraft";
import { FILAMENT_CLASS, FILAMENT_TAGS } from "./modules/FilamentModule";

export interface FilamentInput {
  readonly material: string;
  readonly spoolFormat: string;
  readonly variant: string;
  readonly colorId: string;
  readonly colorName: string;
}

/** What an item card gets on top of the basics: its extra class, fields and tags. */
export interface ItemDetails {
  readonly fileClass: string;
  readonly fields: Readonly<Record<string, string>>;
  readonly tags: readonly string[];
}

/** The filament part of a new card: validated, and able to name the card the way the owner does. */
export class FilamentDetails {
  private constructor(private readonly input: FilamentInput) {}

  static create(input: FilamentInput): FilamentDetails {
    const clean: FilamentInput = {
      material: input.material.trim(),
      spoolFormat: input.spoolFormat.trim(),
      variant: input.variant.trim(),
      colorId: input.colorId.trim(),
      colorName: input.colorName.trim(),
    };
    if (clean.material === "" || clean.spoolFormat === "" || clean.colorName === "") {
      throw new AddItemError("details-missing");
    }
    return new FilamentDetails(clean);
  }

  /**
   * The name as the owner writes it: "PLA Matte Charcoal 11101 With Spool". A variant the color
   * name already contains (Matte in "Matte Charcoal") is not written twice.
   */
  static nameOf(input: FilamentInput): string {
    const { material, spoolFormat, variant, colorId, colorName } = input;
    const repeated = variant.trim() !== "" && colorName.toLowerCase().includes(variant.trim().toLowerCase());
    return [
      material,
      repeated ? "" : variant,
      colorName,
      colorId,
      spoolFormat === "Spool" ? "With Spool" : spoolFormat,
    ]
      .map((part) => part.trim())
      .filter((part) => part !== "")
      .join(" ");
  }

  name(): string {
    return FilamentDetails.nameOf(this.input);
  }

  toDetails(): ItemDetails {
    const { material, spoolFormat, variant, colorId, colorName } = this.input;
    return {
      fileClass: FILAMENT_CLASS,
      fields: {
        material,
        spool_format: spoolFormat,
        variant,
        ColorID: colorId,
        ColorName: colorName,
      },
      tags: FILAMENT_TAGS,
    };
  }
}

import { Place } from "../domain/Place";
import { ReferenceLists } from "../domain/ReferenceLists";
import { isInFolder } from "../obsidian/InventoryFolders";
import { BarButton, BarSource } from "./CardBar";
import { PlaceQr } from "./PlaceQr";
import { STRINGS } from "./strings";

/** The bar of a place's note: its QR label. */
export class PlaceBarSource implements BarSource {
  constructor(
    private readonly references: ReferenceLists,
    private readonly placeQr: PlaceQr,
    private readonly placesFolder: () => string,
  ) {}

  buttonsFor(path: string): BarButton[] | null {
    if (!isInFolder(path, this.placesFolder())) return null;
    if (!this.placeAt(path)) return null;

    return [
      {
        id: "qr",
        label: STRINGS.qrButton,
        icon: "qr-code",
        enabled: true,
        // Read afresh: a first click may have just given the place its id.
        run: async () => {
          const place = this.placeAt(path);
          if (place) await this.placeQr.open(place);
        },
      },
    ];
  }

  private placeAt(path: string): Place | undefined {
    return this.references.places().find((place) => place.path === path);
  }
}

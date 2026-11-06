import { Place } from "../domain/Place";
import { ReferenceLists } from "../domain/ReferenceLists";
import { isInFolder } from "../obsidian/InventoryFolders";
import { BarButton, BarPanel, BarSource } from "./CardBar";
import { PlaceItemsPanel } from "./PlaceItemsPanel";
import { PlaceQr } from "./PlaceQr";
import { STRINGS } from "./strings";

/** A place's note: the bar has its QR label, and under it comes the list of items stored there. */
export class PlaceBarSource implements BarSource {
  constructor(
    private readonly references: ReferenceLists,
    private readonly placeQr: PlaceQr,
    private readonly placesFolder: () => string,
    private readonly items: PlaceItemsPanel,
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

  panelFor(path: string): BarPanel | null {
    if (!isInFolder(path, this.placesFolder())) return null;
    const place = this.placeAt(path);
    if (!place) return null;
    // Read afresh on each draw: the place may have been renamed since.
    return { render: (host) => this.items.render(host, this.placeAt(path) ?? place) };
  }

  private placeAt(path: string): Place | undefined {
    return this.references.places().find((place) => place.path === path);
  }
}

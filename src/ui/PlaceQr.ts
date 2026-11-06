import { Notice } from "obsidian";
import { Place } from "../domain/Place";
import { PlaceIds } from "../domain/PlaceIds";
import { QrLabels } from "./QrLabels";
import { STRINGS } from "./strings";

/**
 * The QR label of a place, from wherever the button is: a place without an id
 * gets one first, then its label opens.
 */
export class PlaceQr {
  constructor(
    private readonly placeIds: PlaceIds,
    private readonly labels: QrLabels,
  ) {}

  async open(place: Place): Promise<void> {
    try {
      const id = await this.placeIds.ensure(place);
      this.labels.openPlace({ ...place, id });
    } catch (error) {
      console.error(error);
      new Notice(STRINGS.unexpectedError);
    }
  }
}

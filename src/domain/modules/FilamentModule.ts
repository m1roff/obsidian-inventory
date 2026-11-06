import { StockStatePolicy } from "../StockState";
import { StructureLayout } from "../structure/StructureLayout";
import {
  classData,
  countedClause,
  stockQuantityExpression,
  field,
  FieldSpec,
  FileClassSpec,
  FileSpec,
  values,
} from "../structure/StructureSkeleton";
import { StructureModule } from "./StructureModule";

export const FILAMENT_MODULE_ID = "filament";
/** The Metadata Menu class of a filament card. */
export const FILAMENT_CLASS = "Filament";
/** Tags every filament card gets. */
export const FILAMENT_TAGS: readonly string[] = ["3dPrinter", "Filament"];
/** The kind a filament card is filed under unless the owner picks another one. */
export const DEFAULT_FILAMENT_KIND = "Plastic for 3d";

export const FILAMENT_MATERIALS: readonly string[] = [
  "PLA", "PETG", "ASA", "TPU", "PC", "PA/PET", "PPS", "Support", "Fiber Reinforced", "ABS", "PVA",
];
export const FILAMENT_FORMATS: readonly string[] = ["Refill", "Spool"];
export const FILAMENT_VARIANTS: readonly string[] = [
  "Basic", "Matte", "Silk", "CF", "GF", "HF", "Sparkle", "for AMS", "Translucent",
];

/** Filament: 3D-printer plastic with its material, spool format, variant and color. */
export class FilamentModule implements StructureModule {
  readonly id = FILAMENT_MODULE_ID;
  readonly title = "Filament";

  fileClasses(layout: StructureLayout): FileClassSpec[] {
    const fields: FieldSpec[] = [
      field("material", "h4eyEP", "Select", { ...values(...FILAMENT_MATERIALS), required: true }),
      field("spool_format", "BvjmYF", "Select", { ...values(...FILAMENT_FORMATS), required: true }),
      field("variant", "4VglPF", "Select", values(...FILAMENT_VARIANTS)),
      field("ColorID", "eedaJv", "Input", {}),
      field("ColorName", "4QJFPI", "Input", { required: true }),
    ];
    return [
      {
        name: FILAMENT_CLASS,
        path: `${layout.fileClasses}/${FILAMENT_CLASS}.md`,
        fields,
        folders: [],
        data: classData(fields, {
          extends: "Inventory item file class",
          baseFile: layout.filamentBase,
          newNotes: [{ name: FILAMENT_CLASS, folder: layout.items }],
          tagNames: [...FILAMENT_TAGS],
        }),
      },
    ];
  }

  files(layout: StructureLayout, states: StockStatePolicy): FileSpec[] {
    const counted = countedClause(states);
    return [
      {
        path: layout.filamentBase,
        mustMention: [counted],
        formulas: [{ name: "quantity", expression: stockQuantityExpression(counted), mention: counted }],
        content: `filters:
  and:
    - fileClass.contains("Filament")
formulas:
  quantity: ${stockQuantityExpression(counted)}
views:
  - type: fileclass-table
    name: Filament
    filters:
      and:
        - fileClass.containsAny("Filament")
    order:
      - formula.quantity
      - cover
      - file.name
      - material
      - spool_format
      - variant
      - ColorID
      - ColorName
      - id
    sort:
      - property: formula.quantity
        direction: ASC
`,
      },
    ];
  }
}

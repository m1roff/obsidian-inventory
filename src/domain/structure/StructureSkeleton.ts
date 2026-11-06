import { DEFAULT_STOCK_STATE_POLICY, StockStatePolicy } from "../StockState";
import type { StructureModule } from "../modules/StructureModule";
import { StructureLayout } from "./StructureLayout";

/** One field of a Metadata Menu class, as it is stored in the class note. */
export interface FieldSpec {
  readonly name: string;
  readonly type: string;
  /** The whole field (id, options, ...), written as is when the field is added. */
  readonly raw: Readonly<Record<string, unknown>>;
}

/** A Metadata Menu class: a note in the fileclasses folder. */
export interface FileClassSpec {
  readonly name: string;
  readonly path: string;
  /** The note's whole frontmatter: what a new note gets. */
  readonly data: Readonly<Record<string, unknown>>;
  readonly fields: readonly FieldSpec[];
  /** Folders the class must point at (`filesPaths`); a different one is a warning. */
  readonly folders: readonly string[];
  /** The optional module this class belongs to; absent for the core. */
  readonly module?: string;
}

/** A plain file (a Bases view) the plugin relies on. */
export interface FileSpec {
  readonly path: string;
  readonly content: string;
  /** Text that must be in the file for it to work here (the folders it filters by). */
  readonly mustMention: readonly string[];
  /** The optional module this file belongs to; absent for the core. */
  readonly module?: string;
  /**
   * Formulas the plugin relies on. When a file only lacks the text a formula brings
   * (`mention`), that one formula is set in place instead of rewriting the whole file.
   */
  readonly formulas?: readonly FormulaSpec[];
}

export interface FormulaSpec {
  readonly name: string;
  readonly expression: string;
  /** The text of `mustMention` that this formula provides. */
  readonly mention: string;
}

/** Bases formula: the units of an item that are in stock, summed. */
export function stockQuantityExpression(counted: string): string {
  return `file.backlinks.filter(value.asFile().properties.fileClass == "Stock position" && ${counted}).map(value.asFile().properties.quantity).reduce(acc + value, 0)`;
}

/** Everything the plugin expects in the vault. */
export interface StructureSkeleton {
  readonly folders: readonly string[];
  readonly files: readonly FileSpec[];
  readonly fileClasses: readonly FileClassSpec[];
}

export function field(
  name: string,
  id: string,
  type: string,
  options: Record<string, unknown>,
): FieldSpec {
  return { name, type, raw: { name, id, type, options, path: "" } };
}

export function values(...list: string[]): Record<string, unknown> {
  const valuesList: Record<string, string> = {};
  list.forEach((value, index) => {
    valuesList[String(index + 1)] = value;
  });
  return { sourceType: "ValuesList", valuesList };
}

export function classData(
  fields: readonly FieldSpec[],
  rest: Record<string, unknown>,
): Record<string, unknown> {
  return {
    fields: fields.map((f) => f.raw),
    icon: null,
    extends: null,
    baseFile: null,
    baseView: null,
    newNotes: null,
    relatedViews: null,
    fileClassNotesFolder: null,
    fileClassNoteTemplate: null,
    mapWithTag: false,
    tagNames: null,
    filesPaths: null,
    bookmarksGroups: null,
    excludes: null,
    ...rest,
  };
}

/**
 * The skeleton for a layout: the core plus the pieces of the modules that are on.
 * Pure data: reading and writing the vault is somewhere else.
 */
export function buildSkeleton(
  layout: StructureLayout,
  states: StockStatePolicy = DEFAULT_STOCK_STATE_POLICY,
  modules: readonly StructureModule[] = [],
): StructureSkeleton {
  const itemFields = [
    field("id", "J3M28B", "Input", { required: true }),
    field("kind", "cWVekS", "File", {
      baseFile: layout.listsBase,
      viewName: "Kinds",
      required: true,
    }),
    field("origin", "Y3Hdza", "Input", {}),
    field("price", "b6SdFc", "Number", { step: 0.01, min: 0 }),
    field("currency", "yhvJu0", "Select", values("EUR", "USD", "SO`M", "none")),
    field("cover", "AnWIYU", "Media", {
      baseFile: layout.imagesBase,
      viewName: "Images from current note",
    }),
    field("tags", "G7alp7", "Multi", {
      sourceType: "ValuesFromBase",
      baseFile: layout.listsBase,
      viewName: "TagsList",
    }),
  ];

  const positionFields = [
    field("Product", "xsnpjN", "File", {
      baseFile: layout.itemsBase,
      viewName: "All",
      required: true,
    }),
    field("quantity", "ymCIX6", "Number", { step: 1, min: 1, required: true }),
    field("Location", "3luASU", "File", {
      baseFile: layout.listsBase,
      viewName: "Locations",
      required: true,
    }),
    field("State", "Qwv2Yb", "Select", {
      ...values(...states.names()),
      required: true,
    }),
  ];

  const listFields = [
    field("comment", "RyVnoQ", "Input", { multiline: true }),
    field("cover", "CrP9pF", "Media", {
      baseFile: layout.imagesBase,
      viewName: "Images from current note",
    }),
    // The id a place's QR label carries; kinds and tags simply do not use it.
    field("id", "PlcId1", "Input", {}),
    // The same cloud of tags as the items have; kinds and tags lists do not use it either.
    field("tags", "PlcTg1", "Multi", {
      sourceType: "ValuesFromBase",
      baseFile: layout.listsBase,
      viewName: "TagsList",
    }),
  ];

  const fileClasses: FileClassSpec[] = [
    {
      name: "Inventory item file class",
      path: `${layout.fileClasses}/Inventory item file class.md`,
      fields: itemFields,
      folders: [layout.items],
      data: classData(itemFields, {
        baseFile: layout.itemsBase,
        baseView: "All",
        newNotes: [{ name: "Inventory item", folder: layout.items }],
        filesPaths: [layout.items],
      }),
    },
    {
      name: "Stock position",
      path: `${layout.fileClasses}/Stock position.md`,
      fields: positionFields,
      folders: [layout.positions],
      data: classData(positionFields, {
        baseFile: layout.positionsBase,
        baseView: "All positions",
        newNotes: [{ name: "Stock Position", folder: layout.positions }],
        relatedViews: [{ field: "Product", view: `${layout.positionsBase}#Current Product` }],
        filesPaths: [layout.positions],
      }),
    },
    {
      name: "Inventory-List",
      path: `${layout.fileClasses}/Inventory-List.md`,
      fields: listFields,
      folders: [layout.locations],
      data: classData(listFields, {
        newNotes: [
          { name: "Location", folder: layout.locations },
          { name: "Kind", folder: layout.kinds },
          { name: "Tags", folder: layout.tags },
        ],
        filesPaths: [layout.locations],
      }),
    },
  ];

  return {
    folders: [
      layout.root,
      layout.items,
      layout.positions,
      layout.config,
      layout.fileClasses,
      layout.lists,
      layout.kinds,
      layout.locations,
      layout.tags,
    ].filter((folder) => folder !== ""),
    files: [
      ...baseFiles(layout, states),
      ...modules.flatMap((module) => module.files(layout, states).map((file) => ({ ...file, module: module.id }))),
    ],
    fileClasses: [
      ...fileClasses,
      ...modules.flatMap((module) =>
        module.fileClasses(layout).map((spec) => ({ ...spec, module: module.id })),
      ),
    ],
  };
}

/** The part of a Bases formula that keeps only positions in states that count as in stock. */
export function countedClause(states: StockStatePolicy): string {
  const counted = states.names().filter((name) => states.counts(name));
  const list = counted.map((name) => `"${name}"`).join(", ");
  return `[${list}].contains(value.asFile().properties.State)`;
}

function baseFiles(layout: StructureLayout, states: StockStatePolicy): FileSpec[] {
  const counted = countedClause(states);
  return [
    {
      path: layout.itemsBase,
      mustMention: [layout.items, counted],
      formulas: [{ name: "totalQuantity", expression: stockQuantityExpression(counted), mention: counted }],
      content: `filters:
  and:
    - fileClass.contains("Inventory item file class")
    - file.inFolder("${layout.items}")
formulas:
  updatedAt: file.mtime.format('DD.MM.YYYY HH:mm:ss')
  createdAt: file.ctime.format("DD.MM.YYYY HH:mm:ss")
  stockPositions: file.backlinks.filter(value.asFile().properties.fileClass == "Stock position").map(value.asFile().properties.Location.asFile().asLink(value.asFile().properties.Location.asFile().basename + " × " + value.asFile().properties.quantity.toString() + " · " + value.asFile().properties.State))
  totalQuantity: ${stockQuantityExpression(counted)}
views:
  - type: fileclass-table
    name: All
    order:
      - id
      - cover
      - tags
      - formula.totalQuantity
      - file.name
      - kind
      - origin
      - price
      - currency
      - formula.updatedAt
      - formula.createdAt
      - formula.stockPositions
    sort:
      - property: file.mtime
        direction: DESC
  - type: cards
    name: By Kinds
    groupBy:
      property: kind
      direction: ASC
    sort:
      - property: formula.updatedAt
        direction: DESC
    image: note.cover
  - type: cards
    name: By Tags
    groupBy:
      property: tags
      direction: ASC
    sort:
      - property: formula.updatedAt
        direction: DESC
    image: note.cover
`,
    },
    {
      path: layout.positionsBase,
      mustMention: [layout.positions],
      content: `filters:
  and:
    - fileClass == "Stock position"
formulas:
  productCover: Product.asFile().properties.cover
views:
  - type: fileclass-table
    name: All positions
    filters:
      and:
        - or:
            - fileClass.containsAny("Stock position")
            - file.inFolder("${layout.positions}")
    order:
      - Product
      - quantity
      - Location
      - State
      - file.name
  - type: fileclass-table
    name: Current Product
    filters:
      and:
        - Product == this.file.asLink()
    order:
      - location
      - quantity
      - State
    summaries:
      quantity: Sum
    columnSize:
      note.location: 308
  - type: cards
    name: By Location
    groupBy:
      property: Location
      direction: ASC
    order:
      - file.name
      - formula.ProductCover
    sort:
      - property: file.ctime
        direction: DESC
    image: formula.productCover
  - type: table
    name: Current Location
    filters:
      and:
        - Location == this.file.asLink()
    order:
      - Product
      - quantity
      - State
    summaries:
      quantity: Sum
`,
    },
    {
      path: layout.listsBase,
      mustMention: [layout.lists],
      content: `filters:
  and:
    - file.folder.startsWith("${layout.lists}")
    - file.ext == "md"
views:
  - type: table
    name: All Lists
    order:
      - file.name
      - where
      - comment
  - type: table
    name: Locations
    filters:
      and:
        - file.folder.contains("locations")
  - type: table
    name: Kinds
    filters:
      and:
        - file.folder.contains("kinds")
  - type: table
    name: TagsList
    filters:
      and:
        - file.folder == "${layout.tags}"
`,
    },
    {
      path: layout.imagesBase,
      mustMention: [],
      content: `filters:
  and:
    - this.file.hasLink(file) && ["png", "jpg", "jpeg", "webp", "gif", "svg", "heic", "avif"].contains(file.ext.lower())
views:
  - type: table
    name: Images from current note
`,
    },
  ];
}

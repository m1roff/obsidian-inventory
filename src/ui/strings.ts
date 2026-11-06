import { ReferenceErrorCode } from "../domain/AddReferenceService";
import { AddItemErrorCode } from "../domain/NewItemDraft";
import { StockErrorCode } from "../domain/StockError";
import { StockState, StockStateErrorCode } from "../domain/StockState";
import { IssueCode } from "../domain/structure/StructureReport";

const STATE_LABELS: Record<string, string> = {
  stored: "Stored",
  installed: "Installed",
  defective: "Defective",
  consumed: "Used up",
  disposed: "Thrown away",
};

// All user-visible text in one place, so the UI language is easy to change.
export const STRINGS = {
  viewTitle: "Dashboard",
  searchClear: "Clear search",
  searchPlaceholder: "Search by name, id, place or tag",
  empty: "Nothing found",
  emptyInventory: "No items yet. Add your first one: you will choose its kind and where it lies.",
  boardEmptyTitle: "Locations",
  boardEmptyHint:
    "No locations yet. A location is a shelf, a box or a room. Add one to see what is stored where.",
  boardAddLocation: "Add location",
  outOfStock: "Out of stock",
  openCard: "Open card",
  openInventory: "Inventory dashboard",

  sortLabel: "Sort",
  sortCreated: "Added",
  sortUpdated: "Updated",
  sortCreatedHint: "Newest added first",
  sortUpdatedHint: "Most recently updated first",

  // QR labels
  qrButton: "QR code",
  qrTitle: "QR code label",
  qrShowId: "Show id under the code",
  qrShowIdDesc: "Prints the item's id in bold under the code, so you can read it without scanning.",
  qrShowCaption: "Show text under the code",
  qrShowCaptionDesc:
    "Prints a line of text under the code. It starts as the item's name, and you can change it to anything. Switch it off and on again to get the name back.",
  qrCaption: "Text",
  qrShare: "Share or save image",
  qrNoId: "This item has no id yet, so there is nothing to put in a code.",
  qrNotReady: "The picture is not ready yet, try again.",
  qrShareFailed: "Could not share the picture",
  qrSaved: "Picture saved",
  qrScan: "Scan a QR code from a photo",
  qrScanning: "Reading the photo...",
  qrNotFound: "No QR code found in the photo",
  qrNoItem: (id: string) => `No item with id ${id}`,
  qrNoPlace: (id: string) => `No place with id ${id}`,

  // Plugin settings
  settingsHeading: "Dashboard",
  settingsTabs: {
    general: "General",
    dashboard: "Dashboard",
    locations: "Locations",
    states: "Stock states",
    mobile: "Mobile",
    structure: "Structure",
    danger: "Danger zone",
  },
  sectionDanger: "Danger zone",
  sectionDangerDesc: "Actions here change many settings at once. Your notes and items are never touched.",
  foldedItemsName: "Items shown when folded",
  foldedItemsDesc:
    "The items list on the dashboard can be folded to save space. This is how many items you still see in it while it is folded. Tap \"Show all items\" to see the rest.",
  foldedLocationsName: "Locations shown when folded",
  foldedLocationsDesc:
    "The locations block (shelves, boxes, rooms) can be folded too. This is how many tiles you still see while it is folded. Pinned locations always come first.",
  openOnStartName: "Open the dashboard at start",
  openOnStartDesc:
    "When this is on, the dashboard opens by itself every time you open Obsidian, so the inventory is the first thing you see. Turn it off if you want Obsidian to open the way it was before, and open the dashboard yourself when you need it (from the left side menu, the menu with three dots, or the command list).",
  searchThresholdName: "Search in pick lists after",
  searchThresholdDesc:
    "When you pick something from a list (a kind, a location), a short list just shows everything. A long list also gets a search box at the top, so you can type a few letters instead of scrolling. This number is how many entries a list may have before the search box appears. For example, with 5 a list of 6 or more entries gets a search box. Set 0 to always show it.",
  statesName: "Stock states",
  statesDesc:
    "Every unit of an item lies in one state, for example stored or defective. A tick means units in this state count as in stock: they add up in the number you see and in the tables inside the notes. Units in a state without a tick are not counted, but they are still shown next to the number (for example, 2 defective), so you do not forget them. The order here is the order in the lists when you move units. You can add your own states, for example On loan.",
  stateBuiltIn: "Built in. Tick it to count units in this state as in stock.",
  stateOwn: "Your own state. Tick it to count units in this state as in stock.",
  stateMoveUp: "Move up",
  stateMoveDown: "Move down",
  stateRemove: "Remove",
  stateAddName: "Add a state",
  stateAddDesc:
    "A name for your own state, for example On loan. After adding, use Check structure to add it to the State field of the stock class, and update the tables if you want it counted.",
  stateAddPlaceholder: "On loan",
  stateAddButton: "Add",
  stateErrors: {
    "name-empty": "Enter a name.",
    "name-invalid": "The name must not contain \\ / : * ? \" < > | # ^ [ ]",
    "name-taken": "A state with this name already exists.",
    "in-use": "Some units are still in this state. Move them to another state first.",
  } satisfies Record<StockStateErrorCode, string>,
  stateUsed: (count: number): string => (count === 1 ? "1 unit position" : `${count} unit positions`),
  stateFind: "Show these items on the dashboard",
  stateRemoveBlocked: (count: number): string => `Cannot remove: used by ${count}`,
  stateFindNotice: (name: string): string => `Dashboard shows the items with "${name}"`,
  uncounted: (parts: string): string => `Not counted: ${parts}`,
  modulesName: "Modules",
  modulesDesc:
    "Parts of the inventory that not everyone needs. A module you turn on adds its own notes and table to the structure (use Check structure after turning it on) and, for some, extra fields when you add an item.",
  filamentName: "Filament (3D printing)",
  filamentDesc:
    "For plastic for a 3D printer. When it is on, the structure gets a Filament class and a Filament table, and when you add an item of the kind chosen below, the form asks for the material, spool format, variant and color and builds the name for you, like PLA Matte Charcoal 11101 With Spool. Turning it off removes nothing you already have.",
  filamentTurnedOn: "Filament module is on. Use Check structure to add its class and table.",
  filamentKindName: "Kind of filament",
  filamentKindDesc:
    "When you pick this kind in Add item, the filament fields appear. Type the name of the kind exactly as it is in your kinds list.",
  filamentKindPlaceholder: "Plastic for 3d",
  fieldMaterial: "Material",
  fieldSpoolFormat: "Spool format",
  fieldVariant: "Variant",
  fieldColorId: "Color id",
  fieldColorName: "Color name",
  variantNone: "- None",
  placeIdsName: "Ids for places",
  placeIdsDesc:
    "Every place (shelf, box, room) can have its own QR label, and the label needs an id, like a name tag that never changes. New places get one automatically. This button gives an id to the places that were created before and have none. It adds one line (id) to each such place's note and never changes an id that already exists.",
  placeIdsButton: "Give ids",
  placeIdsConfirmTitle: "Give ids to places?",
  placeIdsConfirmMessage:
    "One line (id) will be added to the note of each place listed below. Nothing else in those notes changes.",
  placeIdsNothingToDo: "All places already have an id",
  placeIdsDone: (count: number): string =>
    count === 0 ? "All places already have an id" : `Ids given to ${count} place(s)`,
  resetName: "Factory settings",
  resetDesc:
    "Puts everything above back to how it was when you installed the plugin. It also makes the dashboard forget what it remembered: pinned locations, the order of lists, and which blocks were folded or open. Your items and notes stay as they are.",
  resetButton: "Reset all",
  resetConfirmTitle: "Reset the dashboard?",
  resetConfirmMessage:
    "The settings go back to their defaults, and pinned locations, sort order and the folded or open state of the blocks are forgotten. Your items and notes are not touched.",
  resetDone: "Dashboard reset",
  cancel: "Cancel",

  // Items list
  itemsTitle: "Items",
  itemsExpand: "Show all items",
  itemsCollapse: "Show fewer items",
  itemsShowAll: (count: number): string => `Show all ${count} items`,
  backToTop: "Back to top",

  // Locations board
  boardTitle: "Locations",
  boardSortAlpha: "A-Z",
  boardSortAdded: "Added",
  boardSortUpdated: "Updated",
  boardExpand: "Show all locations",
  boardCollapse: "Show fewer locations",
  pin: "Pin to top",
  unpin: "Unpin",
  moveLeft: "Move left",
  moveRight: "Move right",
  pinned: (name: string): string => `Pinned: ${name}`,
  placeApply: "Filter",
  placeApplyAria: "Show only what is in this place",
  placeClear: "Clear",
  placeClearAria: "Stop filtering by this place",
  placeOpen: "Open",
  placeOpenAria: "Open the note of this place",
  placeQr: "QR",
  placeQrAria: "QR code label of this place",

  // Select lists
  choose: "Choose...",
  selectSearch: "Search...",
  addNew: "+ Add new",
  addNamed: (name: string): string => `+ Add "${name}"`,
  fieldTags: "Tags",
  tagAdd: "Add tag",
  tagRemove: "Remove tag",
  newTag: "New tag",
  tagSuggestTitle: "Tags",
  newKind: "New kind",
  newLocation: "New location",
  referenceErrors: {
    "name-empty": "Enter a name.",
    "name-invalid": "The name must not contain \\ / : * ? \" < > | # ^ [ ]",
    "name-taken": "This name already exists.",
    "tag-spaces": "A tag cannot contain spaces. Use _ or - instead.",
  } satisfies Record<ReferenceErrorCode, string>,

  // Row actions
  addMore: "Add more",
  move: "Move",
  addPhoto: "Add photo",
  savingPhoto: "Saving photo...",
  photoSaved: "Photo added",
  photoFailed: "Could not save the photo. See the developer console.",

  // Add more (restock)
  addMoreTitle: (name: string): string => `Add more: ${name}`,
  addedMore: (name: string, quantity: number, to: string): string =>
    `Added ${quantity} × ${name} to ${to}`,

  // Move
  moveTitle: (name: string): string => `Move: ${name}`,
  fieldFrom: "From",
  fieldTo: "To",
  fieldState: "State",
  moved: (name: string, quantity: number, to: string): string =>
    `Moved ${quantity} × ${name}: ${to}`,
  // Destinations that take units out of stock instead of putting them somewhere.
  exitConsumed: "Used up",
  exitDisposed: "Thrown away",
  /** A state's label: the known ones are worded, the owner's own show as written. */
  stateLabel: (name: StockState): string =>
    STATE_LABELS[name.toLowerCase()] ?? name,
  stockErrors: {
    "not-available": "These units are not available.",
    "location-missing": "Choose a location.",
    "quantity-invalid": "Quantity must be a whole number within what is there.",
    "nothing-changes": "Choose another location or state.",
  } satisfies Record<StockErrorCode, string>,

  // Setup and structure
  setupTitle: "Set up your inventory",
  setupIntro:
    "The inventory keeps its items, stock and lists as notes in one folder. Two quick steps, and nothing is created until you press the button.",
  setupStep1: "Step 1. Required plugins",
  setupStep1Done: "All required plugins are on.",
  setupPluginMissing: (name: string): string => `${name} is not installed or not turned on.`,
  setupPluginOk: (name: string): string => `${name} is on.`,
  setupStep2: "Step 2. Create the structure",
  setupStep2Muted: "Finish step 1 first.",
  setupStep2Text: (folder: string): string =>
    `This will be created in the folder "${folder}". Nothing that already exists is changed.`,
  setupInitialize: "Initialize",
  setupCheckAgain: "Check again",
  setupChecking: "Checking...",
  setupAllFound: "All required plugins are on.",
  setupStillMissing: (names: string): string => `Still missing: ${names}`,
  setupDone: (count: number): string => `Created ${count} item(s)`,
  structureTitle: "Inventory structure",
  structureLegend:
    "Present, to be added, or different from what the plugin expects. Things that differ can be replaced: tick them to do so (they are off by default, because a replace overwrites what you have).",
  structureModuleTag: "module",
  structureReplaceFile:
    "Rewrites the whole file with the plugin's structure (filters, formulas, views). Columns, sorting and views you added to it are lost.",
  structurePatchFile: (formulas: string) =>
    `Changes only the formula ${formulas}. The rest of the file, including your own columns and views, stays.`,
  structureReplaceField: "Replaces this field by the expected one.",
  structureApply: (count: number): string => `Apply selected (${count})`,
  structureRecheck: "Check again",
  structureClose: "Close",
  structureAllGood: "Everything is in place.",
  structureNothingSelected: "Nothing selected to add.",
  structureOpen: "Open",
  structureApplied: (applied: number, failed: number): string =>
    failed === 0
      ? `Done: ${applied} item(s)`
      : `Done: ${applied} item(s), ${failed} failed. See the developer console.`,
  structureIssue: {
    "folder-missing": () => "The folder is missing.",
    "file-missing": () => "The file is missing.",
    "file-paths": (detail: string) =>
      `It does not mention "${detail}": it may point to another folder or use an old formula.`,
    "class-missing": () => "The class note is missing.",
    "class-unreadable": () => "The class note cannot be read.",
    "field-missing": (detail: string) => `The field "${detail}" is missing.`,
    "field-type": (detail: string, found: string) =>
      `The field is "${found}", the plugin expects "${detail}".`,
    "class-folder": (detail: string) => `It does not list the folder "${detail}" (it will be added to the list).`,
    "field-values-missing": (detail: string, found: string) =>
      `The field "${detail}" does not offer "${found}" yet.`,
  } satisfies Record<IssueCode, (detail: string, found: string) => string>,
  baseFolderName: "Base folder",
  baseFolderDesc:
    "Everything the plugin uses (items, stock, lists) lives in this one folder. The names inside it stay as they are. To move to another folder, rename it in the file explorer first, then type the same name here. A new name that does not exist yet is offered for creation on the dashboard.",
  baseFolderPlaceholder: "Inventory",
  baseFolderSave: "Save",
  baseFolderInvalid: "This name cannot be used for a folder.",
  baseFolderSaved: (name: string): string => `Base folder is now "${name}"`,
  checkStructureName: "Check structure",
  checkStructureDesc:
    "Looks at the folders and notes the plugin relies on and shows what is missing or different. It changes nothing by itself: you choose what to add, and what to replace. Replacing overwrites what you have, so those entries are off until you tick them.",
  checkStructureButton: "Check structure",

  // Add item
  addItem: "Add item",
  addButton: "Add",
  fieldName: "Name",
  fieldKind: "Kind",
  photoRemoved: "Photo removed from the note.",
  tileSetPhoto: "Add photo",
  tileReplacePhoto: "Replace photo",
  tileRemovePhoto: "Remove photo",
  showPlaceCoversName: "Show photos on location tiles",
  showPlaceCoversDesc:
    "A location with a photo shows it behind its tile. Keep an eye on the size of the photos: big ones can slow your phone down. Turn this off if the screen feels heavy.",
  hapticsName: "Touch feedback",
  hapticsDesc:
    "A tiny tick under your finger on a phone or tablet: when you flip a switch or tick a box in this plugin, and while you hold a location tile: the ticks grow until its menu opens. Nothing happens on a computer. Turn it off if you do not like it.",
  hapticsDesktopNote: "Available only on a phone or tablet.",
  qrLightName: "Dark background",
  qrLightDesc:
    "Makes this label a white code on black. Only for this window: the default stays as set in the plugin settings. Some scanners cannot read a code like that, so test a printed one.",
  qrStyleName: "QR code look",
  qrStyleDesc:
    "How new QR labels look by default. Light is the usual black code on a white ground. Dark is a white code on a black ground. You can still switch a single label when you make it. Some scanners cannot read the dark one, so try it with your phone first.",
  qrStyleDark: "Dark",
  qrStyleLight: "Light",
  helpLabel: "What is this?",
  addSeveralName: "Add several in a row",
  addSeveralDesc:
    "Off: after adding, the new card opens. On: the form stays for the next one, with the same location, kind and tags.",
  defaultLocationName: "Default location",
  defaultLocationDesc:
    "Where a new item goes unless you pick another place. There is always one: a fresh vault gets it from the start.",
  renameDefaultName: "Rename default location",
  renameDefaultDesc: "Gives that place a new name. Notes that point at it follow the new name.",
  renameButton: "Rename",
  renameDefaultTitle: "New name of the default location",
  defaultLocationRenamed: (name: string) => `Renamed to ${name}`,
  fieldLocation: "Location",
  fieldQuantity: "Quantity",
  namePlaceholder: "What is it",
  added: (name: string, id: string): string => `Added ${name} (${id})`,
  alreadyExists: "Already in your inventory",
  similarItems: "Similar items",
  noSimilarItems: "Nothing similar yet",
  unexpectedError: "Could not complete the action. See the developer console.",
  errors: {
    "name-empty": "Enter a name.",
    "name-invalid": "The name must not contain \\ / : * ? \" < > | # ^ [ ]",
    "name-taken": "An item with this name already exists.",
    "kind-missing": "Choose a kind.",
    "location-missing": "Choose a location.",
    "quantity-invalid": "Quantity must be a whole number, 1 or more.",
    "details-missing": "Fill in material, spool format and color name.",
  } satisfies Record<AddItemErrorCode, string>,
} as const;

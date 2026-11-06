# Inventory UI

An Obsidian plugin for home inventory: tools, fasteners, filament, household things. Your data stays in plain markdown notes with properties. The plugin gives you a fast screen on top of them, so adding, finding and moving things takes seconds, also on a phone.

Works on desktop, tablet and phone (not desktop-only).

## How the data is kept

- **Item card** (`Inventory_Items/`): what the thing is (id, kind, tags, price, photo). It has no quantity.
- **Stock position** (`Inventory_Positions/`): how many units of an item sit where, and in which state (stored, installed, defective, consumed, disposed, or your own).
- **Lists** (`_inventory_config/lists/`): kinds, locations and tags, one note each.
- The stock of an item is the sum of its counted positions. An item can lie in several places at once.

Everything lives in one base folder (default `Inventory`, changeable in the settings). Obsidian Bases tables are created for you.

## What it does

- **Dashboard:** search (by name, id, `#tag`, place, `state:name`), item list, locations board with a photo and the stock for each place.
- **Add item:** card and first position in one step, with a check for similar names. Optional "add several in a row".
- **Add more** and **Move:** buy more, move between places and states, mark as used up or thrown away. The same buttons sit on the item note.
- **Photos:** take or pick a photo for an item or a location.
- **QR labels:** print a label for an item or a place (its id is in the code, so renaming a note does not break it). Scan a label with the built-in scanner or the phone camera to open the card or filter by place.
- **Stock states:** choose which states count as "in stock".
- **Touch feedback** on phones (optional).
- **Optional filament module:** extra fields (material, variant, colour) and a ready-made table.

## Requirements

- Obsidian 1.7.2 or newer, with the core **Bases** plugin turned on.
- The **Metadata Menu** plugin (plugin id `fileclass`) for the field forms of the item notes.

On the first start the dashboard shows two steps: check the plugins, then **Initialize** to create the folders, tables and classes. **Check structure** in the settings compares the vault with what the plugin expects and fixes the differences you tick.

## Install

Until the plugin is in the community catalog, use [BRAT](https://github.com/TfTHacker/obsidian42-brat) and add this repository, or copy `main.js`, `manifest.json` and `styles.css` from a release into `<vault>/.obsidian/plugins/inventory-ui/`.

## Development

The tooling runs in Docker, so nothing is installed on the host.

```bash
docker compose build
docker compose run --rm build npm install
docker compose run --rm build npm run typecheck
docker compose run --rm build npm test
docker compose run --rm build npm run lint
docker compose run --rm build npm run build        # production bundle
docker compose run --rm build npm run build:dev    # dev bundle (adds the "Reload plugin" command)
docker compose up -d                                # watch mode
```

The code is split into a domain layer (`src/domain`, no Obsidian imports), the Obsidian adapters (`src/obsidian`) and the interface (`src/ui`).

## Releasing

Bump the version in `manifest.json`, `package.json` and `package-lock.json`, add the entry to `versions.json`, then push a tag equal to the version. The workflow builds the plugin, attests the files and creates a **draft** release: publish it by hand.

## Support

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/miroff)

## License

[MIT](LICENSE)

import esbuild from "esbuild";
import chokidar from "chokidar";
import { existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { resolve } from "node:path";

const mode = process.argv[2];
const prod = mode === "production";
// `dev-once` builds a development bundle one time and exits (used for the phone).
const once = mode === "dev-once";

// `dev-tools` is the owner's set of development commands. They are not part of this repository:
// a development build picks them up from `src/dev` when that folder is mounted there, and every
// other build (production, or from this repository alone) gets an empty stand-in.
const devTools = {
  name: "dev-tools",
  setup(build) {
    build.onResolve({ filter: /^dev-tools$/ }, () => {
      const real = resolve("src/dev/index.ts");
      return { path: !prod && existsSync(real) ? real : resolve("src/devToolsStub.ts") };
    });
  },
};

const ctx = await esbuild.context({
  plugins: [devTools],
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2018",
  outfile: "main.js",
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules,
  ],
  sourcemap: prod ? false : "inline",
  minify: prod,
  treeShaking: true,
  // Dev-only code (e.g. the reload command) is compiled out of production builds.
  define: { __DEV__: prod ? "false" : "true" },
  logLevel: "info",
});

await ctx.rebuild();

if (prod || once) {
  await ctx.dispose();
  process.exit(0);
}

// esbuild's native watch mode relies on fsevents, which Docker Desktop on
// macOS does not reliably forward into the container. Poll instead.
chokidar
  .watch(["src", "manifest.json", "styles.css"], {
    usePolling: true,
    interval: 400,
    ignoreInitial: true,
  })
  .on("all", () => {
    ctx.rebuild().catch((err) => console.error(err));
  });

console.log("[esbuild] watching for changes (polling)...");

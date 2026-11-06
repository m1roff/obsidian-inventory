/**
 * The owner's development tools (test commands, labs). They live outside this repository and
 * are mounted at `src/dev` for a development build: the build resolves `dev-tools` to
 * `src/dev/index.ts` when it is there and to a no-op otherwise (always in a production build).
 */
declare module "dev-tools" {
  export function installDevTools(context: import("../DevToolsContext").DevToolsContext): void;
}

import "obsidian";

// Obsidian's plugin manager is not part of the public typings. Used only by the
// dev-only reload command; it works the same way on desktop and mobile.
declare module "obsidian" {
  interface App {
    plugins: {
      plugins?: Record<string, unknown>;
      disablePlugin(id: string): Promise<void>;
      enablePlugin(id: string): Promise<void>;
    };
    /** The settings window; undocumented, used to close it when jumping to the dashboard. */
    setting?: {
      close(): void;
    };
    internalPlugins?: {
      getEnabledPluginById?(id: string): unknown;
    };
  }
}

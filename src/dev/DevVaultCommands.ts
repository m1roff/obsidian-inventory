import { FileSystemAdapter, Notice, Platform, Plugin } from "obsidian";

/**
 * Development only (the whole file is compiled out of production builds).
 * Puts this test vault back to a known state by running the repository's reset
 * script, found by following the plugin's symlinked main.js back to the repository.
 * Desktop only: a phone cannot run scripts.
 */
export function addDevVaultCommands(plugin: Plugin): void {
  plugin.addCommand({
    id: "dev-vault-fresh",
    name: "Dev: make the vault fresh (no structure)",
    callback: () => void runReset(plugin, "--fresh"),
  });
  plugin.addCommand({
    id: "dev-vault-examples",
    name: "Dev: restore the vault with examples",
    callback: () => void runReset(plugin, ""),
  });
}

async function runReset(plugin: Plugin, mode: "--fresh" | ""): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  if (!Platform.isDesktopApp || !(adapter instanceof FileSystemAdapter)) {
    new Notice("Dev reset works on the desktop only");
    return;
  }
  try {
    const path = await import("path");
    const fs = await import("fs");
    const { execFile } = await import("child_process");

    const vaultPath = adapter.getBasePath();
    const pluginMain = path.join(vaultPath, plugin.manifest.dir ?? "", "main.js");
    // The built plugin lives in the code folder; the dev scripts sit one level above it.
    const codeDir = path.dirname(fs.realpathSync(pluginMain));
    const script = path.join(codeDir, "..", "scripts", "reset-test-vault.sh");
    const args = mode === "" ? [script] : [script, mode];

    execFile("bash", args, { env: { ...process.env, TEST_VAULT: vaultPath } }, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        new Notice(`Reset failed: ${error.message}`);
        return;
      }
      new Notice(stdout.trim() || "Vault reset");
    });
  } catch (error) {
    console.error(error);
    new Notice("Could not find the reset script. See the developer console.");
  }
}

import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig(({ command }) => ({
  // Keep the supplied originals intact locally. Ship only player models.
  publicDir: command === "build" ? false : "public",
  plugins: [
    {
      name: "player-assets-only",
      apply: "build",
      generateBundle() {
        const characters = JSON.parse(
          readFileSync(resolve("src/characters.json"), "utf8"),
        ) as { url: string }[];
        for (const { url } of characters) {
          const fileName = url.slice(1);
          this.emitFile({
            type: "asset",
            fileName,
            source: readFileSync(resolve("public", fileName)),
          });
        }
        this.emitFile({
          type: "asset",
          fileName: "favicon.svg",
          source: readFileSync(resolve("public/favicon.svg")),
        });
      },
    },
  ],
}));

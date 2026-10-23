import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig(({ command }) => ({
  // Keep supplied originals intact locally. Ship player models and portraits.
  publicDir: command === "build" ? false : "public",
  plugins: [
    {
      name: "player-assets-only",
      apply: "build",
      generateBundle() {
        const characters = JSON.parse(
          readFileSync(resolve("src/characters.json"), "utf8"),
        ) as { id: string; url: string }[];
        for (const { id, url } of characters) {
          const fileName = url.slice(1);
          this.emitFile({
            type: "asset",
            fileName,
            source: readFileSync(resolve("public", fileName)),
          });
          const thumbnail = `character-thumbnails/${id}.png`;
          this.emitFile({
            type: "asset",
            fileName: thumbnail,
            source: readFileSync(resolve("public", thumbnail)),
          });
        }
        for (const fileName of ["favicon.svg", "community-thumbnail.jpg"]) {
          this.emitFile({
            type: "asset",
            fileName,
            source: readFileSync(resolve("public", fileName)),
          });
        }
      },
    },
  ],
}));

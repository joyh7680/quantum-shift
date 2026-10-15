import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = "public/codmos-glb-assets-2026-10-15";
const manifest = JSON.parse(
  fs
    .readFileSync(path.join(root, "manifest.json"), "utf8")
    .replace(/^\uFEFF/, ""),
);
const seen = new Set();
const report = manifest.assets.map((a) => {
  const bytes = fs.readFileSync(path.join(root, a.file));
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw Error(`Not GLB: ${a.file}`);
  const gltf = JSON.parse(
    bytes
      .subarray(20, 20 + bytes.readUInt32LE(12))
      .toString("utf8")
      .trim(),
  );
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha !== a.sha256) throw Error(`Checksum mismatch: ${a.file}`);
  const duplicate = seen.has(sha);
  seen.add(sha);
  return {
    id: a.skinKey || a.name,
    name: a.name,
    category: a.category,
    url: `/codmos-glb-assets-2026-10-15/${a.file}`,
    sha256: sha,
    duplicate,
    animations: (gltf.animations || []).map((x) => x.name || "(unnamed)"),
    skins: gltf.skins?.length || 0,
    meshes: gltf.meshes?.length || 0,
    textures: gltf.textures?.length || 0,
    materials: (gltf.materials || []).map((m) => ({
      name: m.name,
      color: m.pbrMetallicRoughness?.baseColorFactor,
      texture: m.pbrMetallicRoughness?.baseColorTexture?.index,
    })),
    nodes: (gltf.nodes || []).map((n) => n.name).filter(Boolean),
    extensions: gltf.extensionsUsed || [],
  };
});
fs.mkdirSync("src", { recursive: true });
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/asset-audit.json", JSON.stringify(report, null, 2));
fs.writeFileSync(
  "src/characters.json",
  JSON.stringify(
    report.filter((a) => a.category === "character" && !a.duplicate),
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      files: report.length,
      characters: report.filter((a) => a.category === "character").length,
      duplicates: report.filter((a) => a.duplicate).length,
      clips: report.reduce((n, a) => n + a.animations.length, 0),
      characterNodes: report.filter((a) =>
        ["armstrong", "alien", "codmos_nova"].includes(a.id),
      ),
    },
    null,
    2,
  ),
);

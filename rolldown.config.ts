import { defineConfig } from "rolldown";

const external = [
  "@f0rbit/corpus",
  "@f0rbit/corpus/file",
  "@f0rbit/corpus/cloudflare",
  "@f0rbit/corpus/types",
  "@f0rbit/corpus/schema",
  "zod",
  "pixi.js",
  /^@pixi\//,
];

const entry = (name: string, path: string) =>
  defineConfig({
    input: { [name]: path },
    output: {
      dir: "dist",
      format: "esm",
      entryFileNames: "[name].js",
      sourcemap: true,
    },
    external,
    platform: "neutral",
    resolve: {
      tsconfigFilename: "./tsconfig.json",
    },
  });

export default defineConfig([
  entry("index", "src/index.ts"),
  entry("pixi/index", "src/pixi/index.ts"),
  entry("debug/index", "src/debug/index.ts"),
  entry("storage/index", "src/storage/index.ts"),
  entry("presets/index", "src/presets/index.ts"),
  entry("grid/index", "src/grid/index.ts"),
  entry("pixi/light/index", "src/pixi/light/index.ts"),
  entry("autotile/index", "src/autotile/index.ts"),
]);

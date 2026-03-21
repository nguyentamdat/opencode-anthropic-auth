import { build } from "bun";

await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist-bundle",
  format: "esm",
  target: "node",
  bundle: true,
  external: [],
});

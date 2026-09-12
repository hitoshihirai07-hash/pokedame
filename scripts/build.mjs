import { build } from "esbuild";
import { mkdir, readFile, writeFile, cp, rm, lstat } from "node:fs/promises";
import { resolve, dirname } from "node:path";

// Both entries live together so the worker's URL stays relative to main.mjs.
const output = resolve("dist");
if (
  dirname(output) !== process.cwd() ||
  (await lstat(output).catch(() => null))?.isSymbolicLink()
)
  throw new Error("Unsafe output directory");
await rm(output, { recursive: true, force: true });
await mkdir("dist/assets", { recursive: true });
await build({
  entryPoints: ["src/main.jsx", "src/inference.worker.mjs"],
  outdir: "dist/assets",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  charset: "utf8",
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
  logLevel: "info",
});
await cp("public", "dist", { recursive: true });
const html = (await readFile("index.html", "utf8"))
  .replace("/src/main.jsx", "/assets/main.mjs")
  .replace(
    "</head>",
    '<link rel="stylesheet" href="/assets/main.css" /></head>',
  );
await writeFile("dist/index.html", html);
console.log("Production build complete: dist");

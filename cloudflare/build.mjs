#!/usr/bin/env node
/* Builds (and optionally previews or deploys) CSDP Tracker for Cloudflare
   Workers WITHOUT changing the app's own files.

   It copies the app into a sibling folder, ../csdp-tracker-cloudflare-build
   (outside the project, so nothing here can affect the normal build), leaving
   out node_modules, build output and this folder. It drops the two Cloudflare
   settings files next to the copy, installs the Cloudflare adapter there, and
   runs it.

     node cloudflare/build.mjs            build only
     node cloudflare/build.mjs preview    build, then run it locally on Cloudflare's runtime
     node cloudflare/build.mjs deploy     build, then publish to Cloudflare (needs `npx wrangler login` once)
*/
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const work = resolve(appRoot, "..", "csdp-tracker-cloudflare-build");
const mode = process.argv[2] ?? "build";
if (!["build", "preview", "deploy"].includes(mode)) {
  console.error(`Unknown step "${mode}". Use build, preview or deploy.`);
  process.exit(1);
}

const SKIP = new Set(["node_modules", ".next", ".open-next", ".git", "cloudflare", ".vercel", ".wrangler"]);
const run = (cmd) => execSync(cmd, { cwd: work, stdio: "inherit", env: process.env });

console.log("1/4  Copying the app (its own files stay untouched)…");
const keepModules = existsSync(join(work, "node_modules"));
if (existsSync(work)) {
  for (const entry of ["app", "components", "lib", "public", "supabase", "tests", "docs"]) rmSync(join(work, entry), { recursive: true, force: true });
}
mkdirSync(work, { recursive: true });
cpSync(appRoot, work, {
  recursive: true,
  filter: (src) => {
    const rel = relative(appRoot, src);
    if (!rel) return true;
    return !SKIP.has(rel.split(sep)[0]);
  },
});
cpSync(join(here, "wrangler.jsonc"), join(work, "wrangler.jsonc"));
cpSync(join(here, "open-next.config.template.txt"), join(work, "open-next.config.ts"));

// Cloudflare's own build output folders stay out of the copy's TypeScript/ESLint view.
const gitignore = join(work, ".gitignore");
if (existsSync(gitignore) && !readFileSync(gitignore, "utf8").includes(".open-next")) {
  writeFileSync(gitignore, readFileSync(gitignore, "utf8") + "\n.open-next\n.wrangler\n");
}

console.log(`2/4  Installing packages${keepModules ? " (reusing the last install)" : ""}…`);
run("npm install --no-audit --no-fund");
run("npm install --no-audit --no-fund --save-dev @opennextjs/cloudflare@^1.20.11 wrangler@^4.150.0");

console.log("3/4  Building for Cloudflare…");
run("npx opennextjs-cloudflare build");

if (mode === "preview") {
  console.log("4/4  Starting a local preview on Cloudflare's runtime…");
  run("npx opennextjs-cloudflare preview");
} else if (mode === "deploy") {
  console.log("4/4  Publishing to Cloudflare…");
  run("npx opennextjs-cloudflare deploy");
} else {
  console.log("4/4  Done. Run with `preview` to try it locally, or `deploy` to publish.");
}

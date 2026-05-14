import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const checks = [
  [join(root, "packages", "core", "package.json"), "packages/core/package.json"],
  [join(root, "packages", "pii", "package.json"), "packages/pii/package.json"],
  [join(root, "packages", "core", "src"), "packages/core/src"],
  [join(root, "packages", "pii", "src"), "packages/pii/src"],
];

for (const [p, label] of checks) {
  if (!existsSync(p)) fail(`Missing: ${label}`);
}

const corePkg = readJson(join(root, "packages", "core", "package.json"));
const piiPkg = readJson(join(root, "packages", "pii", "package.json"));

if (corePkg.name !== "@intelpacket/core") {
  fail(`Expected core name @intelpacket/core, got ${JSON.stringify(corePkg.name)}`);
}
if (piiPkg.name !== "@intelpacket/pii") {
  fail(`Expected pii name @intelpacket/pii, got ${JSON.stringify(piiPkg.name)}`);
}

const piiDeps = { ...piiPkg.dependencies, ...piiPkg.devDependencies, ...piiPkg.peerDependencies };
if (!piiDeps["@intelpacket/core"]) {
  fail("packages/pii must depend on @intelpacket/core");
}
if (piiDeps["@intelpacket/core"] !== "workspace:*") {
  fail(`Expected @intelpacket/core to be workspace:*, got ${JSON.stringify(piiDeps["@intelpacket/core"])}`);
}

const coreDeps = { ...corePkg.dependencies, ...corePkg.devDependencies, ...corePkg.peerDependencies };
if (coreDeps["@intelpacket/pii"]) {
  fail("packages/core must not depend on @intelpacket/pii");
}

const staleRoots = [
  join(root, "IntelPACKET", "package.json"),
  join(root, "IntelPACKETPII", "package.json"),
];
for (const p of staleRoots) {
  if (existsSync(p)) fail(`Stale nested package root must be removed: ${p}`);
}

/**
 * Reject a full per-package dependency tree (isolated linker leaves .pnpm here).
 * Allow: workspace symlink @intelpacket/core under pii, and tooling dirs (e.g. Vitest `.vite`).
 */
for (const pkg of ["core", "pii"]) {
  const nm = join(root, "packages", pkg, "node_modules");
  if (!existsSync(nm)) continue;
  if (existsSync(join(nm, ".pnpm"))) {
    fail(`Remove stale isolated install (contains .pnpm): ${nm}`);
  }
  const entries = readdirSync(nm);
  for (const e of entries) {
    if (e.startsWith(".")) continue;
    if (pkg === "pii" && e === "@intelpacket") {
      if (!existsSync(join(nm, "@intelpacket", "core"))) {
        fail(`Missing workspace link: ${join(nm, "@intelpacket", "core")}`);
      }
      continue;
    }
    fail(`Unexpected package-local dependency in ${nm}: ${e}`);
  }
  if (pkg === "pii" && !entries.includes("@intelpacket")) {
    fail(`packages/pii/node_modules must include workspace scope @intelpacket (pnpm workspace link)`);
  }
}

console.log("Monorepo structure OK.");

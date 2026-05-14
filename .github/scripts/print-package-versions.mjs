import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function pkg(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

const core = pkg("packages/core/package.json");
const pii = pkg("packages/pii/package.json");
const suite = pkg("package.json");

console.log("intelpacket-suite (private):", suite.version);
console.log(core.name, core.version);
console.log(pii.name, pii.version);
console.log("Workspace link:", pii.dependencies?.["@intelpacket/core"]);

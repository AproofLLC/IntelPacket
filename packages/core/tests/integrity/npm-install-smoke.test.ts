import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("integrity npm install smoke", () => {
  it("packs the package manifest the same way an npm consumer would receive it", () => {
    const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: new URL("../..", import.meta.url),
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    const parsed = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>;
    const files = parsed[0]!.files.map((f) => f.path);
    expect(parsed[0]).toMatchObject({ name: "@intelpacket/core" });
    expect(files).toContain("package.json");
    expect(files).toContain("README.md");
  });
});

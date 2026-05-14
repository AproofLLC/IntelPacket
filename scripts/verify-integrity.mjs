import { spawnSync } from "node:child_process";

function pnpmCommand() {
  const direct = spawnSync("pnpm", ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (direct.status === 0) return { cmd: "pnpm", prefix: [] };
  return { cmd: "corepack", prefix: ["pnpm"] };
}

const runner = pnpmCommand();
const commands = [
  [runner.cmd, [...runner.prefix, "--filter", "@intelpacket/core", "test", "--", "tests/integrity"]],
  [runner.cmd, [...runner.prefix, "--filter", "@intelpacket/pii", "test", "--", "tests/integrity"]],
];

for (const [cmd, args] of commands) {
  const display = [cmd, ...args].join(" ");
  console.log(`\n> ${display}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

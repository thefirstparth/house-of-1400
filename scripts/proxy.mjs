// Claude Code cloud sessions route egress through HTTPS_PROXY, but Node's built-in fetch ignores it unless
// NODE_USE_ENV_PROXY=1 (Node 22.21+), and a direct connection is refused. Relaunch the script once with it set.
import { spawnSync } from "node:child_process";

export function ensureProxy() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy || process.env.NODE_USE_ENV_PROXY === "1") return;
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1", HTTP_PROXY: process.env.HTTP_PROXY || proxy, NODE_NO_WARNINGS: "1" },
  });
  process.exit(r.status ?? 1);
}

#!/usr/bin/env node
/**
 * Production deploy guard for Railway.
 *
 * Source of truth: GitHub branch `main` → Railway service `web`.
 * Feature work stays on NPCv1.0 (or other branches); merge into main to ship.
 *
 * Usage:
 *   npm run deploy:prod           # push main (triggers Railway) if needed, else redeploy
 *   npm run deploy:prod -- --up   # upload current tree via `railway up` (main only)
 */
import { execSync } from "node:child_process";
import process from "node:process";

const SERVICE = "web";
const PROD_BRANCH = "main";

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  }).trim();
}

function shInherit(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const args = new Set(process.argv.slice(2));
const useRailwayUp = args.has("--up");

const branch = sh("git rev-parse --abbrev-ref HEAD");
if (branch !== PROD_BRANCH) {
  console.error(
    `[deploy:prod] Refusing to deploy from '${branch}'.\n` +
      `  Production only deploys from '${PROD_BRANCH}'.\n` +
      `  Merge your branch into ${PROD_BRANCH}, checkout ${PROD_BRANCH}, then retry.`,
  );
  process.exit(1);
}

const dirty = sh("git status --porcelain");
if (dirty) {
  console.error(
    "[deploy:prod] Working tree is dirty. Commit or stash before deploying.",
  );
  process.exit(1);
}

sh("git fetch origin " + PROD_BRANCH);
const head = sh("git rev-parse HEAD");
const remote = sh(`git rev-parse origin/${PROD_BRANCH}`);
if (head !== remote) {
  console.error(
    `[deploy:prod] Local ${PROD_BRANCH} (${head.slice(0, 7)}) != origin/${PROD_BRANCH} (${remote.slice(0, 7)}).\n` +
      `  Pull or push until they match, then retry.`,
  );
  process.exit(1);
}

if (useRailwayUp) {
  console.log(
    `[deploy:prod] railway up from ${PROD_BRANCH}@${head.slice(0, 7)} → service ${SERVICE}`,
  );
  shInherit(`railway up -s ${SERVICE} -d`);
} else {
  console.log(
    `[deploy:prod] ${PROD_BRANCH}@${head.slice(0, 7)} already on origin — triggering Railway redeploy`,
  );
  try {
    shInherit(`railway redeploy -s ${SERVICE} -y --from-source`);
  } catch {
    console.log(
      "[deploy:prod] redeploy --from-source failed; falling back to railway up from main",
    );
    shInherit(`railway up -s ${SERVICE} -d`);
  }
}

console.log("[deploy:prod] Done. Watch: railway logs --build");

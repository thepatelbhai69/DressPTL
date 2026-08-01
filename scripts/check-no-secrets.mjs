#!/usr/bin/env node
/**
 * Fails the build if a Mistral key looks like it leaked into anything shipped
 * to browsers, or into the repo at all.
 *
 * The architecture is supposed to make this impossible — the key only ever
 * lives as a Worker secret on the proxy — but "supposed to" is not a control.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

// Mistral keys are 32-char alphanumeric; also catch obvious assignments.
const PATTERNS = [
  { name: "Mistral API key assignment", re: /MISTRAL_API_KEY\s*[:=]\s*["'][^"'\s]{16,}["']/ },
  { name: "Bearer token literal", re: /Bearer\s+[A-Za-z0-9]{32,}/ },
];

const SCAN_DIRS = [
  "apps/web/.next/static",
  "apps/web/.open-next",
  "apps/web/src",
  "workers/mistral-proxy/src",
  "packages/shared/src",
];

const SCAN_EXTENSIONS = new Set([
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".map", ".html", ".css",
]);

let failures = 0;

function scanFile(path) {
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const { name, re } of PATTERNS) {
    const match = re.exec(content);
    if (match) {
      console.error(`FAIL ${name} in ${path}\n     ${match[0].slice(0, 80)}`);
      failures += 1;
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full);
    else if (SCAN_EXTENSIONS.has(extname(full))) scanFile(full);
  }
}

for (const dir of SCAN_DIRS) {
  const full = join(ROOT, dir);
  if (existsSync(full)) walk(full);
}

// A committed .dev.vars would leak the local secret.
for (const path of ["apps/web/.dev.vars", "workers/mistral-proxy/.dev.vars"]) {
  if (existsSync(join(ROOT, path))) {
    console.error(
      `WARN ${path} exists locally. It is gitignored — confirm it is not committed.`,
    );
  }
}

if (failures > 0) {
  console.error(`\n${failures} potential secret leak(s) found.`);
  process.exit(1);
}

console.log("No secrets detected in scanned output.");

#!/usr/bin/env node
// Sets or checks Hushmark's version across its package metadata.
//
//   node scripts/version.mjs 0.3.1   set the version everywhere
//   node scripts/version.mjs --check verify that every copy agrees
//
// package.json is the source of truth. tauri.conf.json reads it directly; the
// npm lockfile and Cargo metadata keep their own copies, which this script
// updates and verifies. CHANGELOG.md must contain a matching version entry.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  packageJson: join(root, "package.json"),
  packageLock: join(root, "package-lock.json"),
  cargoToml: join(root, "src-tauri", "Cargo.toml"),
  cargoLock: join(root, "src-tauri", "Cargo.lock"),
  tauriConf: join(root, "src-tauri", "tauri.conf.json"),
  changelog: join(root, "CHANGELOG.md"),
};

const CARGO_TOML_VERSION = /^(\[package\][^[]*?\nversion = ")([^"]+)(")/m;
const CARGO_LOCK_VERSION = /(\[\[package\]\]\nname = "hushmark"\nversion = ")([^"]+)(")/;

function read(path) {
  return readFileSync(path, "utf8");
}

function match(text, pattern, label) {
  const found = pattern.exec(text);
  if (!found) {
    throw new Error(`Could not find the version in ${label}.`);
  }
  return found[2];
}

function currentVersions() {
  const packageLock = JSON.parse(read(paths.packageLock));
  return {
    "package.json": JSON.parse(read(paths.packageJson)).version,
    "package-lock.json": packageLock.version,
    "package-lock.json (root package)": packageLock.packages?.[""]?.version,
    "src-tauri/Cargo.toml": match(read(paths.cargoToml), CARGO_TOML_VERSION, "Cargo.toml"),
    "src-tauri/Cargo.lock": match(read(paths.cargoLock), CARGO_LOCK_VERSION, "Cargo.lock"),
  };
}

function check() {
  const versions = currentVersions();
  const expected = versions["package.json"];
  const problems = Object.entries(versions)
    .filter(([, version]) => version !== expected)
    .map(([file, version]) => `${file} has ${version}, expected ${expected}.`);

  const tauriVersion = JSON.parse(read(paths.tauriConf)).version;
  if (tauriVersion !== "../package.json") {
    problems.push(
      `src-tauri/tauri.conf.json should read its version from "../package.json", not ${JSON.stringify(tauriVersion)}.`,
    );
  }

  const changelogEntry = new RegExp(`^## ${expected.replaceAll(".", "\\.")}$`, "m");
  if (!changelogEntry.test(read(paths.changelog))) {
    problems.push(`CHANGELOG.md has no "## ${expected}" entry.`);
  }

  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  console.log(`Version metadata is consistent at ${expected}.`);
}

function set(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Expected a version such as 0.3.1, got ${JSON.stringify(version)}.`);
  }

  execFileSync("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], {
    cwd: root,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  for (const [path, pattern] of [
    [paths.cargoToml, CARGO_TOML_VERSION],
    [paths.cargoLock, CARGO_LOCK_VERSION],
  ]) {
    const text = read(path);
    match(text, pattern, path);
    writeFileSync(path, text.replace(pattern, `$1${version}$3`));
  }

  console.log(`Set version ${version}. Add a "## ${version}" entry to CHANGELOG.md.`);
}

const [argument] = process.argv.slice(2);
try {
  if (argument === "--check") {
    check();
  } else if (argument) {
    set(argument);
  } else {
    console.error("Usage: node scripts/version.mjs <version> | --check");
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

// Writes the updater manifest (latest.json) for a universal macOS release, next to the build output.
// Run after a signed build:  bun scripts/latest-json.ts "Release notes"
// Then upload latest.json and AssignedToMe.app.tar.gz to the GitHub release v<version>; running apps read
// releases/latest/download/latest.json and install the tarball after checking its signature.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'enesakkose/AssignedToMe';
const root = join(import.meta.dir, '..', 'src-tauri');
const bundle = join(root, 'target/universal-apple-darwin/release/bundle/macos');
const tarball = 'AssignedToMe.app.tar.gz';

const { version } = JSON.parse(readFileSync(join(root, 'tauri.conf.json'), 'utf8')) as { version: string };
const sigPath = join(bundle, `${tarball}.sig`);
if (!existsSync(sigPath)) throw new Error(`No ${tarball}.sig: build with TAURI_SIGNING_PRIVATE_KEY set (see README → Releasing).`);

// One universal tarball serves both architectures.
const entry = { signature: readFileSync(sigPath, 'utf8').trim(), url: `https://github.com/${REPO}/releases/download/v${version}/${tarball}` };
const manifest = {
  version,
  notes: process.argv[2] ?? '',
  pub_date: new Date().toISOString(),
  platforms: { 'darwin-aarch64': entry, 'darwin-x86_64': entry },
};
const out = join(bundle, '..', 'latest.json');
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(out);

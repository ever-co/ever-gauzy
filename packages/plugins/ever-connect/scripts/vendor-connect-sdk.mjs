#!/usr/bin/env node
/**
 * Copies the parts of the Ever Platform SDK (github.com/ever-co/ever-connect-sdk) this plugin runs on
 * into `src/lib/vendor/`, from a checkout of the SDK at the commit to pin:
 *
 *     git clone https://github.com/ever-co/ever-connect-sdk /tmp/sdk && git -C /tmp/sdk checkout <commit>
 *     node packages/plugins/ever-connect/scripts/vendor-connect-sdk.mjs /tmp/sdk
 *
 * Until the SDK is published on npm, the plugin carries these files instead of a package dependency,
 * so every build of Gauzy (API, Docker images, desktop apps) compiles them like its own sources.
 *
 * The only changes to the copied files: a header naming the commit and the file (and leaving the type
 * check to the SDK's own strict build), and the imports of `@ever-co/connect-contracts` rewritten to
 * the vendored copy. `VENDOR.json` records the
 * commit and, per file, the SHA-256 of the upstream file and of the vendored one; the plugin's
 * `vendor.spec.ts` fails when a vendored file was edited by hand, and, with `EVER_CONNECT_SDK_DIR`
 * pointing at a checkout of that commit, when the upstream files differ.
 *
 *     node packages/plugins/ever-connect/scripts/vendor-connect-sdk.mjs /tmp/sdk --check
 *
 * checks without writing.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(PLUGIN, 'src', 'lib', 'vendor');

/** What is copied: the client, the verifier, the assertion and their contracts. */
export const FILES = {
	'connect-sdk': {
		from: 'packages/ts/connect-sdk/src',
		files: [
			'assertion.ts',
			'client.ts',
			'ed25519.ts',
			'encoding.ts',
			'entitlement.ts',
			'errors.ts',
			'generated/operations.ts',
			'jws.ts',
			'keys.ts',
			'keyset.ts',
			'local.ts',
			'manifest.ts',
			'schema.ts',
			'stats/checks.ts',
			'stats/index.ts',
			'time.ts',
			'token.ts',
			'transport.ts'
		]
	},
	'connect-contracts': {
		from: 'packages/ts/connect-contracts/src',
		files: [
			'generated/constants.ts',
			'generated/ever-platform.v1.ts',
			'generated/integrations.ts',
			'generated/problems.ts',
			'generated/rows.ts',
			'generated/schemas.ts',
			'index.ts',
			'problem.ts',
			'step-up.ts'
		]
	},
	contracts: {
		from: 'contracts',
		files: ['integrations/scope-versions.lock.json']
	}
};

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * The commit a checkout is at, read from its `.git` directory (no `git` process): a detached HEAD
 * holds the commit; a branch HEAD names a ref, in its own file or in `packed-refs`.
 */
export function headCommit(dir) {
	const git = join(dir, '.git');
	const head = readFileSync(join(git, 'HEAD'), 'utf8').trim();
	if (!head.startsWith('ref: ')) return head;
	const ref = head.slice(5).trim();
	if (existsSync(join(git, ref))) return readFileSync(join(git, ref), 'utf8').trim();
	const packed = existsSync(join(git, 'packed-refs')) ? readFileSync(join(git, 'packed-refs'), 'utf8') : '';
	const line = packed.split('\n').find((entry) => entry.endsWith(` ${ref}`));
	if (!line) throw new Error(`cannot resolve ${ref} in ${dir}`);
	return line.split(' ')[0];
}

/** The vendored text of one upstream file. */
export function vendoredText(group, file, upstream, commit) {
	if (file.endsWith('.json')) {
		return upstream;
	}
	const source = `${FILES[group].from}/${file}`;
	// The SDK's own build type-checks these files strictly (no DOM library); Gauzy's looser settings and
	// its DOM library reject some of their type narrowing, so the copy is not type-checked again here.
	const header =
		`// Vendored from github.com/ever-co/ever-connect-sdk@${commit} (${source}) by scripts/vendor-connect-sdk.mjs. Do not edit.\n` +
		"// @ts-nocheck: type-checked by the SDK's own strict build.\n";
	// `@ever-co/connect-contracts` is the vendored copy, relative to this file.
	const target = posix.join('connect-contracts', 'index');
	const from = posix.dirname(posix.join(group, file));
	let specifier = posix.relative(from, target).replace(/\/index$/, '');
	if (!specifier.startsWith('.')) specifier = `./${specifier}`;
	return header + upstream.replace(/(['"])@ever-co\/connect-contracts\1/g, `$1${specifier}$1`);
}

function main() {
	const [dir, flag] = process.argv.slice(2);
	if (!dir || !existsSync(dir)) {
		console.error('usage: vendor-connect-sdk.mjs <checkout of ever-co/ever-connect-sdk> [--check]');
		process.exit(2);
	}
	const check = flag === '--check';
	const commit = headCommit(dir);
	const manifest = { source: 'https://github.com/ever-co/ever-connect-sdk', commit, files: {} };
	const outputs = new Map();
	for (const [group, { from, files }] of Object.entries(FILES)) {
		for (const file of files) {
			const upstream = readFileSync(join(dir, from, file), 'utf8');
			const text = vendoredText(group, file, upstream, commit);
			const path = posix.join(group, file);
			outputs.set(path, text);
			manifest.files[path] = {
				upstream: `${from}/${file}`,
				upstream_sha256: sha256(upstream),
				sha256: sha256(text)
			};
		}
	}
	const manifestText = `${JSON.stringify(manifest, null, '\t')}\n`;
	if (check) {
		const problems = [];
		for (const [path, text] of outputs) {
			const target = join(VENDOR, path);
			if (!existsSync(target) || readFileSync(target, 'utf8') !== text) problems.push(path);
		}
		const current = existsSync(join(VENDOR, 'VENDOR.json'))
			? readFileSync(join(VENDOR, 'VENDOR.json'), 'utf8')
			: '';
		if (current !== manifestText) problems.push('VENDOR.json');
		if (problems.length) {
			console.error(`The vendored SDK differs from ${commit}:\n  ${problems.join('\n  ')}`);
			process.exit(1);
		}
		console.log(`The vendored SDK equals ${commit}.`);
		return;
	}
	for (const group of Object.keys(FILES)) rmSync(join(VENDOR, group), { recursive: true, force: true });
	for (const [path, text] of outputs) {
		const target = join(VENDOR, path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, text);
	}
	writeFileSync(join(VENDOR, 'VENDOR.json'), manifestText);
	console.log(`Vendored ${outputs.size} files of ${commit} into ${relative(process.cwd(), VENDOR)}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}

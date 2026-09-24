/**
 * This script fails a Windows / Linux desktop release job BEFORE electron-builder publishes it, when the
 * package.json that electron-builder is about to read does not carry the per-arch update channel.
 *
 * Why: `yarn run pack --desktop=<app> --arch=<arch> --platform=<win32|linux>` stamps
 * `build.publish[].channel = latest-<arch>` into `apps/<app>/src/package.json`, and the app build copies that
 * file into `dist/apps/<x>`, which is what `electron-builder --project dist/apps/<x>` reads. When the stamp does
 * not reach dist (e.g. pack runs after the copy), electron-builder silently falls back to its default `latest`
 * channel and publishes `latest.yml` / `latest-linux*.yml`, while installed apps only ever request
 * `latest-${process.arch}` (desktop-lib update-strategy), so they stop auto-updating. Gauzy Server shipped like
 * that from v107 to v111.44.45 and nobody noticed for 4.5 months.
 *
 * Usage (from the repository root, right before `yarn electron-builder ... --project <dir>`):
 * ```
 * node .scripts/electron-package-utils/assert-publish-channel.js --project dist/apps/desktop --arch x64
 * ```
 *
 * Prints one OK line and exits 0 when every `build.publish[]` entry has `channel: latest-<arch>`.
 * Otherwise prints a GitHub Actions `::error` annotation and exits 1.
 */

const fs = require('fs');
const path = require('path');

const ARCHES = ['x64', 'arm64'];
const TITLE = 'Update channel missing';
const USAGE = 'node .scripts/electron-package-utils/assert-publish-channel.js --project <dist dir> --arch <x64|arm64>';
const HINT =
	'Hint: `yarn run pack --desktop=<app> --arch=<arch> --platform=<win32|linux>` must run BEFORE the build copies apps/<app>/src/package.json into dist (or copy it into dist again after pack).';

// Workflow command data must escape %, CR and LF, see
// https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
function escapeData(value) {
	return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

// Use exitCode (not process.exit) so buffered stdout is never cut off before the runner sees the annotation.
function fail(title, message, hint) {
	console.log(`::error title=${title}::${escapeData(message)}`);
	if (hint) {
		console.log(hint);
	}
	process.exitCode = 1;
}

// Accepts `--project <dir>` / `--project=<dir>` and `--arch <arch>` / `--arch=<arch>`, nothing else.
function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i++) {
		const match = /^--(project|arch)(?:=(.*))?$/.exec(argv[i]);
		if (!match) {
			throw new Error(`unknown argument "${argv[i]}"`);
		}
		const [, name, inline] = match;
		const value = inline !== undefined ? inline : argv[++i];
		if (value === undefined || value === '' || value.startsWith('--')) {
			throw new Error(`--${name} needs a value`);
		}
		if (args[name] !== undefined) {
			throw new Error(`--${name} was given twice`);
		}
		args[name] = value;
	}
	if (args.project === undefined) {
		throw new Error('--project is required');
	}
	if (args.arch === undefined) {
		throw new Error('--arch is required');
	}
	if (!ARCHES.includes(args.arch)) {
		throw new Error(`--arch must be one of ${ARCHES.join(', ')} (got "${args.arch}")`);
	}
	return args;
}

function describeChannel(entry) {
	if (!entry || typeof entry !== 'object' || entry.channel === undefined) {
		return '(none)';
	}
	return JSON.stringify(entry.channel);
}

function main() {
	let args;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (error) {
		fail('Update channel check misconfigured', `assert-publish-channel: ${error.message}. Usage: ${USAGE}`);
		return;
	}

	const expected = `latest-${args.arch}`;
	const file = path.join(args.project, 'package.json');

	if (!fs.existsSync(file)) {
		fail(TITLE, `${file} not found, so the update channel cannot be checked (expected "${expected}").`, HINT);
		return;
	}

	let pkg;
	try {
		pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch (error) {
		fail(
			TITLE,
			`${file} is not readable JSON (${error.message}), so the update channel cannot be checked (expected "${expected}").`
		);
		return;
	}

	const publish = pkg && pkg.build ? pkg.build.publish : undefined;
	if (!Array.isArray(publish) || publish.length === 0) {
		fail(
			TITLE,
			`${file}: build.publish must be a non-empty array, found ${JSON.stringify(publish)}; expected every entry to have channel "${expected}".`,
			HINT
		);
		return;
	}

	if (publish.some((entry) => !entry || entry.channel !== expected)) {
		const found = publish.map((entry, index) => `[${index}] ${describeChannel(entry)}`).join(', ');
		fail(
			TITLE,
			`${file}: expected build.publish[].channel "${expected}" but found ${found}. electron-builder would publish an update manifest that installed apps never request.`,
			HINT
		);
		return;
	}

	console.log(`Update channel OK: ${file} build.publish[].channel = ${expected} (entries: ${publish.length}).`);
}

main();

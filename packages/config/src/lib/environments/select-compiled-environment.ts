import * as fs from 'fs';
import * as path from 'path';

/**
 * Selects which environment file the COMPILED `@gauzy/config` package exports.
 *
 * `environment.ts` (development) and `environment.prod.ts` (production) are both compiled by
 * `nx build config`. The package is consumed prebuilt — the API and worker bundles externalize
 * `@gauzy/*` and copy `dist/packages/config` into their own `node_modules` — so a `fileReplacements`
 * entry in the consumer's webpack build never reaches it, and `@nx/js:tsc` has no file replacement of
 * its own. The selection therefore happens on the compiled output, in two places:
 *
 * - **Per application, at copy time** (`apps/api/config/webpack-package-copy-patterns.js`): while a
 *   production build copies the package into `dist/apps/<app>/node_modules/@gauzy/config`, the
 *   `environment.js` it writes is `compiledEnvironmentContent(..., 'production')`. Nothing in
 *   `dist/packages/config` changes, so two builds with different configurations never affect each other.
 * - **For a standalone production dist of the package** (`nx run config:select-environment -c production`,
 *   the `lib:build:prod` script): `selectCompiledEnvironment` rewrites `environment.js` in
 *   `dist/packages/config` itself, keeping the development compile to put back later.
 *
 * The source tree is never touched. This file is compiled with the rest of the package and used from
 * `dist/` with plain `node`, so the build needs no extra toolchain; it is not part of the package's public API.
 */

/** `development` keeps the compiled `environment.ts`; `production` substitutes `environment.prod.ts`. */
export type CompiledEnvironmentName = 'development' | 'production';

/**
 * First line of a substituted `environment.js`. It marks the file as a copy of `environment.prod.js`
 * (so a later development selection knows to restore the preserved development compile) and precedes
 * `"use strict"`, which a comment may.
 */
export const PRODUCTION_SUBSTITUTION_MARKER =
	'//# @gauzy/config: production environment, copied from environment.prod.js by select-compiled-environment';

/** Compiled file names inside the `environments` output directory. */
export const COMPILED_ENVIRONMENT = 'environment.js';
const COMPILED_PRODUCTION_ENVIRONMENT = 'environment.prod.js';
/** The compiled `environment.ts`, preserved while `environment.js` carries the production copy. */
const PRESERVED_DEVELOPMENT_ENVIRONMENT = 'environment.dev.js';

/**
 * Writes through a temporary file in the same directory, renamed into place, so a selection interrupted
 * mid-write leaves the previous `environment.js` / `environment.dev.js` intact rather than a partial file
 * (which a later selection could preserve as "the development compile").
 */
function writeFileAtomically(file: string, content: string): void {
	const temporary = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(temporary, content);
	fs.renameSync(temporary, file);
}

function copyFileAtomically(source: string, target: string): void {
	const temporary = `${target}.${process.pid}.tmp`;
	fs.copyFileSync(source, temporary);
	fs.renameSync(temporary, target);
}

export interface CompiledEnvironmentSelection {
	environment: CompiledEnvironmentName;
	/** What had to change: `substituted` (production copied in), `restored` (development put back) or `unchanged`. */
	action: 'substituted' | 'restored' | 'unchanged';
	/** The `environment.js` that was selected. */
	file: string;
}

/**
 * The content `environment.js` must have for the requested environment, read from the compiled files in
 * `outputDirectory` without changing anything there. Correct whatever state the directory is in: a fresh
 * compile, or one where `selectCompiledEnvironment` has already substituted production.
 *
 * @param outputDirectory - The compiled `environments` directory (`dist/packages/config/src/lib/environments`).
 * @param environment - The environment wanted.
 * @returns The file content.
 * @throws When the compiled files are missing (the compile step did not run) or the development compile is gone.
 */
export function compiledEnvironmentContent(outputDirectory: string, environment: CompiledEnvironmentName): string {
	const target = path.join(outputDirectory, COMPILED_ENVIRONMENT);
	const production = path.join(outputDirectory, COMPILED_PRODUCTION_ENVIRONMENT);
	const preserved = path.join(outputDirectory, PRESERVED_DEVELOPMENT_ENVIRONMENT);

	for (const file of [target, production]) {
		if (!fs.existsSync(file)) {
			throw new Error(`${file} is missing: compile @gauzy/config before selecting its environment.`);
		}
	}

	if (environment === 'production') {
		return `${PRODUCTION_SUBSTITUTION_MARKER}\n${fs.readFileSync(production, 'utf8')}`;
	}

	const current = fs.readFileSync(target, 'utf8');
	if (!current.startsWith(PRODUCTION_SUBSTITUTION_MARKER)) {
		return current;
	}
	if (!fs.existsSync(preserved)) {
		throw new Error(
			`${target} carries the production environment and ${preserved} is missing: recompile @gauzy/config.`
		);
	}
	return fs.readFileSync(preserved, 'utf8');
}

/**
 * Makes the compiled `environment.js` in `outputDirectory` the requested environment.
 *
 * Idempotent in every order of selections, including a `tsc` re-emit between two of them: a fresh
 * compile of `environment.ts` is recognised by the absence of the marker and preserved before it is
 * overwritten; a file that already carries the marker is refreshed from `environment.prod.js` without
 * touching the preserved copy, which is still the latest development compile.
 *
 * @param outputDirectory - The compiled `environments` directory (`dist/packages/config/src/lib/environments`).
 * @param environment - The environment to select.
 * @returns What was done.
 * @throws When the compiled files are missing (the compile step did not run) or a restore has nothing to restore from.
 */
export function selectCompiledEnvironment(
	outputDirectory: string,
	environment: CompiledEnvironmentName
): CompiledEnvironmentSelection {
	const target = path.join(outputDirectory, COMPILED_ENVIRONMENT);
	const preserved = path.join(outputDirectory, PRESERVED_DEVELOPMENT_ENVIRONMENT);

	const content = compiledEnvironmentContent(outputDirectory, environment);
	const current = fs.readFileSync(target, 'utf8');
	const substituted = current.startsWith(PRODUCTION_SUBSTITUTION_MARKER);

	if (environment === 'production') {
		if (!substituted) {
			// A fresh compile of environment.ts: keep it for a later development selection.
			copyFileAtomically(target, preserved);
		}
		writeFileAtomically(target, content);
		return { environment, action: 'substituted', file: target };
	}

	if (!substituted) {
		return { environment, action: 'unchanged', file: target };
	}

	writeFileAtomically(target, content);
	return { environment, action: 'restored', file: target };
}

/**
 * Reads `--environment=<name>` (default `development`) and `--output=<directory>` (default: the
 * directory this script runs from, which is the compiled `environments` directory) from CLI arguments.
 *
 * @param argv - The arguments after the script path.
 * @param defaultOutputDirectory - Used when `--output` is absent.
 * @throws When the environment name is not one of the compiled environments.
 */
export function parseSelectionArguments(
	argv: readonly string[],
	defaultOutputDirectory: string
): { environment: CompiledEnvironmentName; outputDirectory: string } {
	let environment = 'development';
	let outputDirectory = defaultOutputDirectory;

	for (const argument of argv) {
		if (argument.startsWith('--environment=')) {
			environment = argument.slice('--environment='.length).trim();
		} else if (argument.startsWith('--output=')) {
			outputDirectory = path.resolve(argument.slice('--output='.length).trim());
		} else {
			throw new Error(
				`Unknown argument ${argument}. Use --environment=<development|production> [--output=<directory>].`
			);
		}
	}

	if (environment !== 'development' && environment !== 'production') {
		throw new Error(
			`Unknown environment "${environment}": the compiled environments are development and production.`
		);
	}

	return { environment, outputDirectory };
}

/* istanbul ignore next -- the CLI entry; the functions above are what the tests cover */
if (require.main === module) {
	try {
		const { environment, outputDirectory } = parseSelectionArguments(process.argv.slice(2), __dirname);
		const selection = selectCompiledEnvironment(outputDirectory, environment);
		console.log(`@gauzy/config: ${selection.environment} environment ${selection.action} (${selection.file})`);
	} catch (error) {
		console.error(`@gauzy/config: environment selection failed: ${error instanceof Error ? error.message : error}`);
		process.exit(1);
	}
}

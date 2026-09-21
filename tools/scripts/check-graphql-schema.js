#!/usr/bin/env node
/**
 * The GraphQL schema gate.
 *
 * Three questions, in this order, all answered from the committed snapshot and the snapshot at the
 * revision the change targets — no boot, no database, no build:
 *
 *   1. `snapshot`       is the committed snapshot a schema this gate can read at all?
 *   2. `deprecations`   does the change remove an element while the removal window its
 *                       `@deprecated(reason: "...; removal planned for <release>")` named is still
 *                       open?
 *   3. `classification` is the change additive, or breaking?
 *
 * Freshness — "the committed snapshot is what the server composes" — is deliberately NOT re-derived
 * here: the CI job runs `yarn nx run core:graphql-snapshot` and then `git diff --exit-code`, which
 * is the composition itself rather than a second opinion about it. This script runs after that step,
 * so the snapshot it reads is the composed one.
 *
 * The comparison logic lives in `packages/core/src/lib/graphql/schema-diff.ts` and is loaded from
 * source: the artefact under review is the source, not a stale build output. Node 24 (the version
 * `package.json` requires) loads TypeScript directly; `ts-node` and a compiled `dist` file are the
 * fallbacks for an older runtime. When none of the three can be loaded the script says so, and
 * `--require-classification` turns that into a failure — which is how CI runs it.
 *
 * Usage:
 *   node tools/scripts/check-graphql-schema.js [--base <ref>] [--previous <file>]
 *                                              [--release <version>] [--allow-breaking]
 *                                              [--require-classification] [--json]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { spawnSync } = require('child_process');

const SNAPSHOT_PATH = 'packages/core/src/lib/graphql/schema/schema.graphql';
const DIFF_MODULE_PATH = 'packages/core/src/lib/graphql/schema-diff.ts';
const COMPILED_DIFF_MODULE_PATH = 'dist/packages/core/src/lib/graphql/schema-diff.js';
const RELEASE_PACKAGE_PATH = 'packages/core/package.json';

function main(argv) {
	const options = parseArguments(argv);
	if (options.help) {
		process.stdout.write(usage());
		return 0;
	}

	const repositoryRoot = resolveRepositoryRoot(__dirname);
	// `--release` wins; otherwise the release this checkout declares, which is what a deprecation
	// window is measured against.
	options.release = options.release || readRelease(repositoryRoot) || '0.0.0';

	const snapshotFile = path.join(repositoryRoot, SNAPSHOT_PATH);
	const results = [];

	if (!fs.existsSync(snapshotFile)) {
		report([failure('snapshot', `The committed snapshot '${SNAPSHOT_PATH}' does not exist.`)], options);
		return 1;
	}

	const current = fs.readFileSync(snapshotFile, 'utf8');
	const loaded = loadSchemaDiff(repositoryRoot);

	if (!loaded.module) {
		results.push(
			options.requireClassification
				? failure(
						'classification',
						`The schema comparison module could not be loaded, and --require-classification was given: ${loaded.error}`
					)
				: warning('classification', `The schema comparison module could not be loaded: ${loaded.error}`)
		);
	}

	if (loaded.module) {
		const problems = loaded.module.validateSchemaSnapshot(current);
		results.push(
			problems.length
				? failure('snapshot', `${SNAPSHOT_PATH} cannot be trusted:\n  - ${problems.join('\n  - ')}`)
				: pass('snapshot', `${SNAPSHOT_PATH} reads as a canonical schema snapshot.`)
		);
	}

	// What the change is compared against. Reported either way, so a green run states what it
	// actually compared.
	//
	// 🛑 **An unresolvable baseline is a failure wherever a comparison was asked for.** Every check
	// below it — the deprecation window, the breaking-change classification — is skipped without one,
	// so a warning here made the gate silently answer "nothing to report" precisely when it could not
	// look. That is the worst thing a gate can do: the run is green, the pull request says the schema
	// was checked, and no comparison happened. It stays a warning only where there is genuinely
	// nothing to compare against — a checkout with no base ref named and no `origin/develop` — which
	// is the case the message below describes.
	const previous = resolvePreviousSnapshot(repositoryRoot, options);
	results.push(
		previous.text !== undefined
			? pass('baseline', previous.detail)
			: previous.requested
				? failure('baseline', previous.detail)
				: warning('baseline', previous.detail)
	);

	if (loaded.module && previous.text !== undefined) {
		results.push(...deprecationCheck(loaded.module, previous, current, options));
		results.push(...classificationCheck(loaded.module, previous, current, options));
	}

	report(results, options);
	return results.some((result) => result.level === 'fail') ? 1 : 0;
}

/* ------------------------------------------------------------------ *
 * Checks
 * ------------------------------------------------------------------ */

function deprecationCheck(module, previous, current, options) {
	const refusals = module.findEarlyDeprecationRemovals(previous.text, current, options.release);
	if (!refusals.length) {
		return [pass('deprecations', `No deprecated element was removed ahead of its declared release.`)];
	}

	return refusals.map((refusal) =>
		failure('deprecations', `${refusal.refusal}\n    path: ${refusal.path}`)
	);
}

function classificationCheck(module, previous, current, options) {
	const diff = module.classifySchemaDiff(previous.text, current);
	if (!diff.changes.length) {
		return [pass('classification', 'The schema is unchanged.')];
	}

	const described = diff.changes.map(
		(change) => `${change.classification === 'BREAKING' ? '!' : '+'} [${change.kind}] ${change.detail}`
	);

	if (diff.kind === 'ADDITIVE') {
		return [pass('classification', `The change is additive:\n    ${described.join('\n    ')}`)];
	}

	if (options.allowBreaking) {
		return [
			warning(
				'classification',
				`The change is BREAKING and was allowed by --allow-breaking:\n    ${described.join('\n    ')}`
			)
		];
	}

	return [
		failure(
			'classification',
			`The change is BREAKING. A breaking schema change needs the schema-breaking-change label on the ` +
				`pull request, which is what passes --allow-breaking:\n    ${described.join('\n    ')}`
		)
	];
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/**
 * The snapshot to compare against, and a sentence naming where it came from.
 *
 * @param {string} repositoryRoot
 * @param {{ base?: string, previousFile?: string }} options
 */
function resolvePreviousSnapshot(repositoryRoot, options) {
	if (options.previousFile) {
		const file = path.resolve(options.previousFile);
		return fs.existsSync(file)
			? { text: fs.readFileSync(file, 'utf8'), detail: `Compared against '${file}'.` }
			: {
					// A baseline was named and is not there. The caller asked for a comparison, so the
					// absence is a refusal rather than a note.
					requested: true,
					detail: `The file given by --previous does not exist: '${file}'.`
			  };
	}

	// `requested` is what separates "the caller told us what to compare against" from "we guessed".
	// A named base — the flag, or the base branch a pull request carries — is a comparison that was
	// asked for, and failing to resolve it must fail the gate rather than skip it.
	const requested = Boolean(options.base || process.env.GITHUB_BASE_REF);
	const candidates = options.base
		? [options.base]
		: process.env.GITHUB_BASE_REF
			? [`origin/${process.env.GITHUB_BASE_REF}`, process.env.GITHUB_BASE_REF]
			: ['origin/develop', 'develop', 'HEAD'];

	for (const ref of candidates) {
		const shown = showFileAtRevision(repositoryRoot, ref, SNAPSHOT_PATH);
		if (shown.found) {
			return { text: shown.text, detail: `Compared against ${ref}:${SNAPSHOT_PATH}.` };
		}
	}

	return {
		requested,
		detail: requested
			? `No snapshot of ${SNAPSHOT_PATH} could be read at ${candidates.join(', ')}, and a base was ` +
			  'named, so the comparison this gate exists to make did not happen. Fetch the base revision — ' +
			  'the default checkout is one commit deep — and run it again.'
			: `No earlier snapshot of ${SNAPSHOT_PATH} exists at ${candidates.join(', ')}, so there is nothing to ` +
			  'compare against. This is expected while the snapshot is being introduced.'
	};
}

function showFileAtRevision(repositoryRoot, ref, file) {
	const result = spawnSync('git', ['-C', repositoryRoot, 'show', `${ref}:${file}`], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});

	return result.status === 0 ? { found: true, text: result.stdout } : { found: false };
}

/**
 * Loads the comparison module, through whichever mechanism this checkout can offer.
 *
 * The SOURCE is preferred over a build output in every path that can read it: the gate exists to
 * judge the file under review, and a stale `dist` would judge the last build instead.
 *
 * @param {string} repositoryRoot
 */
function loadSchemaDiff(repositoryRoot) {
	const source = path.join(repositoryRoot, DIFF_MODULE_PATH);
	const errors = [];

	const attempts = [
		// 1. ts-node — how every other TypeScript script target in this repository is run.
		() => {
			require('ts-node/register');
			return require(source);
		},
		// 2. A workspace that has been built.
		() => require(path.join(repositoryRoot, COMPILED_DIFF_MODULE_PATH)),
		// 3. Node's own TypeScript support, so the gate runs in a checkout that has been neither
		//    installed nor built. A plain `require()` of the file cannot be used: `package.json`
		//    declares `"type": "commonjs"`, so the `.ts` file is parsed as CommonJS and its `export`
		//    statements are a syntax error. The source is transformed to CommonJS here instead, with
		//    the module's own resolution paths attached so that anything it imports still resolves.
		() => loadTransformedTypeScript(source)
	];

	for (const attempt of attempts) {
		try {
			const loaded = attempt();
			if (loaded && typeof loaded.classifySchemaDiff === 'function') return { module: loaded };
			errors.push('the module loaded but does not export classifySchemaDiff');
		} catch (error) {
			errors.push(error && error.message ? error.message.split('\n')[0] : String(error));
		}
	}

	return { error: errors.join(' / ') };
}

/**
 * Compiles one TypeScript module in memory and returns its exports.
 *
 * `Module.prototype._compile` is not public API, but it is the same hook every TypeScript loader —
 * including ts-node, the primary path above — installs. It is used here rather than a temporary
 * file so that nothing is written into the checkout by a check.
 *
 * @param {string} file - The absolute path of the module.
 */
function loadTransformedTypeScript(file) {
	const { stripTypeScriptTypes } = require('node:module');
	if (typeof stripTypeScriptTypes !== 'function') {
		throw new Error(`this Node (${process.version}) has no module.stripTypeScriptTypes`);
	}

	const transformed = stripTypeScriptTypes(fs.readFileSync(file, 'utf8'), { mode: 'transform' });
	const loaded = new Module(file, null);
	loaded.filename = file;
	loaded.paths = Module._nodeModulePaths(path.dirname(file));
	loaded._compile(transformed, file);

	return loaded.exports;
}

function resolveRepositoryRoot(from) {
	let current = path.resolve(from);
	for (;;) {
		if (fs.existsSync(path.join(current, 'nx.json'))) return current;
		const parent = path.dirname(current);
		if (parent === current) throw new Error(`No nx.json above '${from}'.`);
		current = parent;
	}
}

/** The release this change ships in, which is what a deprecation window is measured against. */
function readRelease(repositoryRoot) {
	try {
		return JSON.parse(fs.readFileSync(path.join(repositoryRoot, RELEASE_PACKAGE_PATH), 'utf8')).version;
	} catch (error) {
		return undefined;
	}
}

function parseArguments(argv) {
	const options = {
		help: argv.includes('--help') || argv.includes('-h'),
		allowBreaking: argv.includes('--allow-breaking'),
		requireClassification: argv.includes('--require-classification'),
		json: argv.includes('--json'),
		base: readArgument(argv, '--base'),
		previousFile: readArgument(argv, '--previous'),
		release: readArgument(argv, '--release')
	};
	return options;
}

function readArgument(argv, name) {
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : undefined;
}

/* ------------------------------------------------------------------ *
 * Output
 * ------------------------------------------------------------------ */

function pass(id, detail) {
	return { level: 'pass', id, detail };
}

function warning(id, detail) {
	return { level: 'warn', id, detail };
}

function failure(id, detail) {
	return { level: 'fail', id, detail };
}

function report(results, options) {
	const release = options.release;

	if (options.json) {
		process.stdout.write(`${JSON.stringify({ results, release }, null, 2)}\n`);
		return;
	}

	const label = { pass: 'ok  ', warn: 'warn', fail: 'FAIL' };
	for (const result of results) {
		process.stdout.write(`[${label[result.level]}] ${result.id}: ${result.detail}\n`);
	}

	const failed = results.filter((result) => result.level === 'fail').length;
	process.stdout.write(
		failed
			? `\nThe GraphQL schema gate failed (${failed} check(s)).\n`
			: '\nThe GraphQL schema gate passed.\n'
	);
}

function usage() {
	return [
		'Usage: node tools/scripts/check-graphql-schema.js [options]',
		'',
		'  --base <ref>                the revision to compare against (default: origin/$GITHUB_BASE_REF,',
		'                              then origin/develop, then HEAD)',
		'  --previous <file>           compare against this snapshot file instead',
		'  --release <version>         the release this change ships in (default: packages/core/package.json)',
		'  --allow-breaking            the pull request carries the schema-breaking-change label',
		'  --require-classification    fail instead of warning when the comparison module cannot load',
		'  --json                      machine-readable output',
		''
	].join('\n');
}

// The release is resolved inside main(), after the arguments, because --release overrides the
// version this checkout declares.
if (require.main === module) {
	try {
		process.exitCode = main(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${(error && error.stack) || String(error)}\n`);
		process.exitCode = 1;
	}
}

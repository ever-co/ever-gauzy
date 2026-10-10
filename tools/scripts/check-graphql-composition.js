#!/usr/bin/env node
/**
 * Asserts the GraphQL schema composes, from the SDL files on disk.
 *
 * This is a plain node entry point: no Nest container, no configuration, no database. It reads every
 * `*.gql` file the boot `typePaths` glob would load, runs the same composition pass the API runs at
 * boot, and exits non-zero when anything is wrong — so a redeclared kernel type, a root type
 * declared twice, a root field two domains both claim, a reserved name or a deprecation without a
 * reason is caught before the API is started rather than after.
 *
 *   node tools/scripts/check-graphql-composition.js
 *   node tools/scripts/check-graphql-composition.js --print   # also print the composed SDL
 *
 * The pass itself lives in `packages/core/src/lib/graphql/graphql-composition.ts`, which is
 * TypeScript, so the loader below registers the workspace's own transpiler first. That is the same
 * mechanism the schema-snapshot target uses.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..');
const CORE_LIB = path.join(REPOSITORY_ROOT, 'packages', 'core', 'src', 'lib');

/**
 * Loads the composition module through the workspace transpiler.
 */
function loadCompositionModule() {
	const source = path.join(CORE_LIB, 'graphql', 'graphql-composition.ts');

	// The module is compiled to CommonJS by the API build, so the loader has to agree with it.
	process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'commonjs' });

	const loaders = ['ts-node/register', '@swc-node/register'];
	const failures = [];

	for (const loader of loaders) {
		try {
			require(loader);
			return require(source);
		} catch (error) {
			failures.push(`  ${loader}: ${error && error.message}`);
		}
	}

	// Neither loader is usable — an installation may have one without the other, or neither — so the
	// module is transpiled with the workspace's own TypeScript. A schema check that could not run
	// because a development convenience was missing would be a check nobody runs.
	try {
		return transpileWithWorkspaceTypeScript(source);
	} catch (error) {
		failures.push(`  typescript: ${error && error.message}`);
	}

	console.error(
		'Cannot load the composition pass. Install the workspace dependencies — the API is built with them — then re-run this script.\n' +
			failures.join('\n')
	);
	process.exit(2);
}

/**
 * Loads a TypeScript module by transpiling it with the workspace's own TypeScript.
 *
 * Only the syntax is transpiled, which is all a loader has to do: the composition pass is checked by
 * the compiler elsewhere, and what this script asserts is the schema, not the types.
 *
 * @param {string} file The module's path.
 * @returns {object} Its exports.
 */
function transpileWithWorkspaceTypeScript(file) {
	const ts = require('typescript');
	const Module = require('module');

	const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
		fileName: file,
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2020,
			esModuleInterop: true
		}
	});

	const loaded = new Module(file, module);
	loaded.filename = file;
	loaded.paths = Module._nodeModulePaths(path.dirname(file));
	loaded._compile(outputText, file);

	return loaded.exports;
}

/**
 * Reads every SDL file the boot glob loads.
 *
 * The glob is `<packages/core/src/lib>/**\/schema/*.gql`, so a file is a schema source when it sits
 * in a directory named `schema` anywhere under the core library. A file placed elsewhere is not
 * loaded at boot and is therefore not asserted here either — which is why the location rule is
 * stated where the SDL is written.
 *
 * @param {string} root The directory to walk.
 * @returns {Array<{file: string, sdl: string}>} The sources, in path order.
 */
function readSchemaSources(root) {
	const sources = [];

	const walk = (directory) => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
				continue;
			}

			const full = path.join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(full);
				continue;
			}

			if (!entry.name.endsWith('.gql') || path.basename(directory) !== 'schema') {
				continue;
			}

			sources.push({
				file: path.relative(REPOSITORY_ROOT, full).split(path.sep).join('/'),
				sdl: fs.readFileSync(full, 'utf8')
			});
		}
	};

	walk(root);

	return sources.sort((left, right) => left.file.localeCompare(right.file));
}

function main() {
	const composition = loadCompositionModule();
	const sources = readSchemaSources(CORE_LIB);

	if (sources.length === 0) {
		console.error('No GraphQL SDL was found under packages/core/src/lib/**/schema. That is a bug in the glob or in the layout.');
		process.exit(1);
	}

	console.log(`GraphQL schema sources: ${sources.length}`);
	for (const source of sources) {
		console.log(`  ${source.file}`);
	}

	let composed;
	try {
		composed = composition.composeSchemaFromSdl(sources);
	} catch (error) {
		if (error instanceof composition.GraphqlCompositionError) {
			console.error(`\n${composition.describeCompositionReport(error.report)}`);
			process.exit(1);
		}

		throw error;
	}

	console.log(`\n${composition.describeCompositionReport(composed.report)}`);

	if (composed.report.counts.unusedKernelTypes.length > 0) {
		console.log(
			`\nKernel types no domain uses yet (expected while a capability has no consumer):\n  ${composed.report.counts.unusedKernelTypes.join(', ')}`
		);
	}

	if (process.argv.includes('--print')) {
		console.log(`\n${composed.typeDefs}`);
	}

	if (composed.report.errors.length > 0) {
		process.exit(1);
	}

	console.log('\nThe schema composes. Every kernel type is declared once, by the file that owns it.');
}

main();

// node --test tools/ever-platform/import-boundary.test.mjs
//
// The import boundary of the optional Ever Platform modules: the tree is clean, the known-bad
// fixtures fail with the scanner AND with the ESLint rule (same rules, import-boundary.cjs).
// The ESLint half needs `eslint` and `@typescript-eslint/parser`: from the workspace, or from
// ESLINT_PREFIX (the CI job installs both there). With EVER_BOUNDARY_ESLINT_REQUIRED=true a missing
// ESLint fails instead of skipping.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { check, REPO_ROOT, specifiers } from './check-import-boundary.mjs';

const require = createRequire(import.meta.url);
const { plugin, violation } = require('./import-boundary.cjs');

const FIXTURES = join(REPO_ROOT, 'tools/ever-platform/fixtures/import-bad');

/** The fixture file (its path as if it were in the repository) and the lines that must fail. */
const EXPECTED = {
	'packages/core/src/core-imports-connect.ts': [2],
	'packages/plugins/ever-stats/src/stats-imports-connect.ts': [2, 3],
	'packages/plugins/ever-instance/src/instance-http.ts': [2],
	'packages/plugins/auth-zitadel/src/zitadel-imports-connect.ts': [2],
	'packages/plugins/ever-connect/src/index.ts': [6],
	'packages/plugins/ever-connect-ui/src/ui-imports-server.ts': [2],
	'apps/api/src/plugins.ts': [],
	'apps/gauzy/src/app/deep-import.ts': [2, 3]
};

function fixtureFiles() {
	const out = [];
	const visit = (dir) => {
		for (const name of readdirSync(dir)) {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) visit(p);
			else out.push(relative(FIXTURES, p).split(sep).join('/'));
		}
	};
	visit(FIXTURES);
	return out.sort();
}

test('the tree crosses no boundary', () => {
	assert.deepEqual(check(REPO_ROOT), []);
});

test('every fixture is listed with its expected lines', () => {
	assert.deepEqual(fixtureFiles(), Object.keys(EXPECTED).sort());
});

test('the scanner fails each known-bad fixture on exactly its lines', () => {
	const findings = check(FIXTURES);
	const got = {};
	for (const finding of findings) {
		const [, file, line] = /^(.+?):(\d+) /.exec(finding);
		(got[file] ??= []).push(Number(line));
	}
	for (const [file, lines] of Object.entries(EXPECTED))
		assert.deepEqual((got[file] ?? []).sort(), lines, `${file}: ${findings.join('; ')}`);
});

test('the plugin lists may import the modules through their entry points, nobody their files', () => {
	assert.equal(violation('apps/api/src/plugins.ts', '@gauzy/plugin-ever-connect'), null);
	assert.equal(violation('apps/gauzy/src/plugin-ui.config.ts', '@gauzy/plugin-ever-stats-ui'), null);
	assert.match(violation('apps/api/src/plugins.ts', '@gauzy/plugin-ever-connect/src/lib/sdk'), /entry point/);
	assert.equal(violation('packages/plugins/ever-connect/src/lib/a.ts', '@gauzy/plugin-ever-instance'), null);
	assert.equal(violation('packages/core/src/lib/a.ts', '@gauzy/plugin-integration-ever-async'), null);
	assert.match(
		violation('packages/core/src/lib/a.ts', '@gauzy/plugin-ever-instance'),
		/optional Ever Platform module/
	);
});

test('a specifier inside a string or a comment is not an import', () => {
	assert.deepEqual(
		specifiers(
			`const s = "import x from '@gauzy/plugin-ever-connect'";\n// require('@nestjs/axios')\nimport { a } from './a';\n`
		).map((s) => s.specifier),
		['./a']
	);
});

function loadEslint() {
	const bases = [
		join(REPO_ROOT, 'package.json'),
		...(process.env.ESLINT_PREFIX ? [join(process.env.ESLINT_PREFIX, 'package.json')] : [])
	];
	for (const base of bases.reverse()) {
		try {
			const req = createRequire(base);
			return { Linter: req('eslint').Linter, parser: req('@typescript-eslint/parser') };
		} catch {
			// next
		}
	}
	return null;
}

const eslint = loadEslint();
const required = process.env.EVER_BOUNDARY_ESLINT_REQUIRED === 'true';

test(
	'the ESLint rule reports the same lines',
	{ skip: !eslint && !required && 'eslint is not installed (set ESLINT_PREFIX)' },
	() => {
		assert.ok(
			eslint,
			'eslint and @typescript-eslint/parser are required here (EVER_BOUNDARY_ESLINT_REQUIRED=true)'
		);
		const linter = new eslint.Linter({ configType: 'flat', cwd: REPO_ROOT });
		const config = [
			{
				files: ['**/*.ts'],
				languageOptions: { parser: eslint.parser, sourceType: 'module' },
				plugins: { 'ever-platform': plugin },
				rules: { 'ever-platform/import-boundary': 'error' }
			}
		];
		for (const [file, lines] of Object.entries(EXPECTED)) {
			const messages = linter.verify(readFileSync(join(FIXTURES, file), 'utf8'), config, {
				filename: join(REPO_ROOT, file)
			});
			const fatal = messages.filter((m) => m.fatal);
			assert.deepEqual(fatal, [], `${file}: parse error`);
			assert.deepEqual(
				messages
					.filter((m) => m.ruleId === 'ever-platform/import-boundary')
					.map((m) => m.line)
					.sort(),
				lines,
				`${file}: ${messages.map((m) => `${m.line} ${m.message}`).join('; ')}`
			);
		}
		// The real plugin list passes.
		const real = linter.verify(readFileSync(join(REPO_ROOT, 'apps/api/src/plugins.ts'), 'utf8'), config, {
			filename: join(REPO_ROOT, 'apps/api/src/plugins.ts')
		});
		assert.deepEqual(
			real.filter((m) => m.ruleId === 'ever-platform/import-boundary' || m.fatal),
			[]
		);
	}
);

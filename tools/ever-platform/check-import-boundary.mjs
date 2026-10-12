#!/usr/bin/env node
/**
 * The import boundary of the optional Ever Platform modules (rules in import-boundary.cjs, which the
 * ESLint rule `ever-platform/import-boundary` shares), over the tree (dependencies and build output skipped). The CI gate: it
 * needs nothing but Node, so it runs before any install.
 *
 *   node tools/ever-platform/check-import-boundary.mjs [--root <dir>]
 *
 * --root scans another tree (a fixture) with its own paths. Exit 0 when clean, 1 naming each
 * `file:line specifier: reason`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { violation, exportViolation, FIXTURES } = require('./import-boundary.cjs');

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

const CODE = /\.(m?[jt]sx?|c[jt]s)$/;
const SKIP_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'out-tsc',
	'coverage',
	'.angular',
	'.nx',
	'.cache',
	'tmp'
]);

/**
 * TypeScript's own import scanner (it reads tokens, so a specifier written inside a string or a
 * comment is not an import): from the audit's harness install (tools/egress-audit, `npm ci`), else
 * from the workspace.
 */
function loadTypeScript() {
	for (const base of [join(REPO_ROOT, 'tools/egress-audit/package.json'), join(REPO_ROOT, 'package.json')]) {
		try {
			return createRequire(base)('typescript');
		} catch {
			// next
		}
	}
	throw new Error('typescript is not installed: run npm ci --prefix tools/egress-audit');
}
const ts = loadTypeScript();

/** Every module specifier of a source text (imports, re-exports, require, import()), with its line. */
export function specifiers(text) {
	const { importedFiles } = ts.preProcessFile(text, true, true);
	return importedFiles.map(({ fileName, pos }) => ({ specifier: fileName, line: lineAt(text, pos) }));
}

/** The specifiers an entry point re-exports (`export * from`, `export { a } from`). */
export function reexports(text) {
	// Parsed, so a re-export written over several lines or with comments is still found.
	const source = ts.createSourceFile('entry.ts', text, ts.ScriptTarget.Latest, true);
	return source.statements
		.filter(
			(node) => ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
		)
		.map((node) => ({
			specifier: node.moduleSpecifier.text,
			line: source.getLineAndCharacterOfPosition(node.moduleSpecifier.getStart(source)).line + 1
		}));
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function walk(root) {
	const out = [];
	const visit = (dir) => {
		for (const name of readdirSync(dir)) {
			if (SKIP_DIRS.has(name)) continue;
			const p = join(dir, name);
			if (statSync(p).isDirectory()) visit(p);
			else out.push(relative(root, p).split(sep).join('/'));
		}
	};
	visit(root);
	return out;
}

/** Every file under `root` outside SKIP_DIRS (in CI the checkout holds exactly the tracked files). */
const files = (root) => walk(root);

/** `file:line specifier: reason` for every import across the boundary under `root`. */
export function check(root = REPO_ROOT) {
	const findings = [];
	for (const file of files(root)) {
		if (!CODE.test(file) || file.split('/').some((part) => SKIP_DIRS.has(part)) || file.startsWith(FIXTURES))
			continue;
		let text;
		try {
			text = readFileSync(join(root, file), 'utf8');
		} catch {
			continue;
		}
		// Every rule is about a package name or a module's entry point; skip the rest unread.
		if (!/@gauzy\/plugin-|axios|undici/.test(text) && !file.endsWith('ever-connect/src/index.ts')) continue;
		for (const { specifier, line } of specifiers(text)) {
			const reason = violation(file, specifier);
			if (reason) findings.push(`${file}:${line} ${reason}`);
		}
		for (const { specifier, line } of reexports(text)) {
			const reason = exportViolation(file, specifier);
			if (reason) findings.push(`${file}:${line} ${reason}`);
		}
	}
	return [...new Set(findings)].sort((a, b) => a.localeCompare(b));
}

export function main(argv) {
	const i = argv.indexOf('--root');
	const root = i >= 0 ? resolve(argv[i + 1]) : REPO_ROOT;
	const findings = check(root);
	if (findings.length) {
		process.stderr.write(
			`check-import-boundary: imports across the Ever Platform modules' boundary:\n  ${findings.join('\n  ')}\n`
		);
		return 1;
	}
	process.stdout.write('check-import-boundary: ok\n');
	return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	process.exit(main(process.argv.slice(2)));

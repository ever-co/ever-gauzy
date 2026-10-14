#!/usr/bin/env node
/**
 * Gate: no migration adds a column its own CREATE TABLE already declared.
 *
 * The pricing migration (`1791000000120-CreatePricingTables`) declared `deletedKey` as a generated column in each of
 * four MySQL `CREATE TABLE` statements and then ran `ALTER TABLE … ADD COLUMN deletedKey` on the same four tables, so
 * a fresh MySQL installation stopped at boot with `1060 Duplicate column name 'deletedKey'` (review R2-25). Nothing
 * in CI could see it: no job runs the migration chain on MySQL — the build job's MySQL service serves only the
 * ever-stats and ever-connect suites, the one migration test runs on PostgreSQL, and the fresh-database boot uses
 * SQLite — and SQLite and PostgreSQL never execute a MySQL branch.
 *
 * Running every plugin's migrations on all three databases is the real cure, and a much larger job. This gate is the
 * cheap one for the class that shipped: for every dialect branch of every migration (each `async` method), a
 * column named by `ALTER TABLE <t> ADD [COLUMN] <c>` after that branch's `CREATE TABLE <t> (…)` declared `<c>` is a
 * duplicate — on every database. It reads the source only, so it runs without an install.
 *
 * Run from the repository root: `node tools/scripts/migration-duplicate-column-check.mjs`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SKIP = new Set(['node_modules', 'dist', '.angular', 'coverage', '.nx']);

/** Every `*.ts` file under a `migrations` directory of `packages/` and `apps/`, specs and barrels excluded. */
function migrationFiles(dir, inMigrations = false, found = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP.has(entry.name)) {
			continue;
		}
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			migrationFiles(path, inMigrations || entry.name === 'migrations', found);
		} else if (
			inMigrations &&
			entry.name.endsWith('.ts') &&
			!entry.name.endsWith('.spec.ts') &&
			!entry.name.endsWith('.d.ts') &&
			entry.name !== 'index.ts'
		) {
			found.push(path);
		}
	}
	return found;
}

/** An identifier as a migration writes it: bare, double-quoted or backtick-quoted (escaped in a template). */
const IDENT = String.raw`\\?[\x60"]?(\w+)\\?[\x60"]?`;
const CREATE_TABLE = new RegExp(String.raw`CREATE TABLE (?:IF NOT EXISTS )?${IDENT}\s*\(`, 'g');
const ADD_COLUMN = new RegExp(String.raw`ALTER TABLE ${IDENT}\s+ADD (?:COLUMN )?\\?[\x60"](\w+)\\?[\x60"]`, 'g');
/** A column definition inside a CREATE TABLE: a quoted name right after `(` or `,`, followed by its type. */
const COLUMN = new RegExp(String.raw`[(,]\s*\\?[\x60"](\w+)\\?[\x60"]\s+(?!\()`, 'g');

const findings = [];
const files = ['packages', 'apps'].flatMap((top) => migrationFiles(join(ROOT, top)));

for (const file of files) {
	const source = readFileSync(file, 'utf8');
	// One dialect branch per method: `sqliteUpQueryRunner`, `postgresUpQueryRunner`, `mysqlUpQueryRunner`, …
	for (const branch of source.split(/(?=(?:public|private|protected)?\s*async\s+\w+\s*\()/)) {
		const method = /async\s+(\w+)/.exec(branch)?.[1] ?? '(module)';
		const created = new Map();

		for (const match of branch.matchAll(CREATE_TABLE)) {
			const end = branch.indexOf('\n', match.index);
			const statement = branch.slice(match.index, end > 0 ? end : undefined);
			created.set(match[1], {
				at: match.index,
				columns: new Set([...statement.matchAll(COLUMN)].map((c) => c[1]))
			});
		}
		for (const match of branch.matchAll(ADD_COLUMN)) {
			const [, table, column] = match;
			const table_ = created.get(table);
			if (table_ && match.index > table_.at && table_.columns.has(column)) {
				findings.push(`${relative(ROOT, file).split(sep).join('/')} ${method}: ${table}.${column}`);
			}
		}
	}
}

if (findings.length) {
	console.error(
		`migration duplicate column check: FAILED — ${findings.length} column(s) added by ALTER TABLE after the same ` +
			`branch's CREATE TABLE already declared them (the database refuses the second one, e.g. MySQL 1060):`
	);
	for (const finding of findings) {
		console.error(`  - ${finding}`);
	}
	process.exit(1);
}

console.log(
	`migration duplicate column check: PASSED — ${files.length} migration file(s), and no dialect branch adds a column ` +
		`its own CREATE TABLE already declared.`
);

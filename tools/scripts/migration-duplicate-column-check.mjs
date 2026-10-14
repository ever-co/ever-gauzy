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
 * duplicate — on every database. A `CREATE TABLE` is read to its balanced closing parenthesis, however many lines it
 * spans, and quoted text inside it is skipped. It reads the source only, so it runs without an install.
 *
 * Its readers are held to every statement shape by `migration-duplicate-column-check.test.mjs`.
 *
 * Run from the repository root: `node tools/scripts/migration-duplicate-column-check.mjs`
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SKIP = new Set(['node_modules', 'dist', '.angular', 'coverage', '.nx']);

/** An identifier as a migration's source writes it: bare, double-quoted, or backtick-quoted (escaped in a template). */
const IDENT = String.raw`\\?[\x60"]?(\w+)\\?[\x60"]?`;
const CREATE_TABLE = new RegExp(String.raw`CREATE TABLE (?:IF NOT EXISTS )?${IDENT}\s*\(`, 'g');
const ALTER_TABLE = new RegExp(String.raw`ALTER TABLE ${IDENT}\s+`, 'g');
/** One `ADD [COLUMN] <name>` clause of an `ALTER TABLE`, at the start of a top-level member of the statement. */
const ADD_CLAUSE = new RegExp(String.raw`^ADD\s+(?:COLUMN\s+)?(?:IF NOT EXISTS\s+)?\\?[\x60"]?(\w+)\\?[\x60"]?`, 'i');
/** What a member of a CREATE TABLE starts with when it declares a constraint or an index rather than a column. */
const NOT_A_COLUMN = /^(CONSTRAINT|PRIMARY|INDEX|KEY|UNIQUE|FOREIGN|CHECK|FULLTEXT|SPATIAL)\b/i;
/** `ADD CONSTRAINT …`, `ADD INDEX …` and the like add no column. */
const NOT_A_COLUMN_ADD = /^(CONSTRAINT|PRIMARY|INDEX|KEY|UNIQUE|FOREIGN|CHECK|FULLTEXT|SPATIAL)$/i;

/**
 * The text between the parenthesis at `open` and the one that balances it, skipping quoted text.
 *
 * @param {string} text The source.
 * @param {number} open The index of the opening parenthesis.
 * @returns {string | null} The body, or null when the statement never closes.
 */
export function balancedBody(text, open) {
	let depth = 0;
	let quote = null;

	for (let index = open; index < text.length; index++) {
		const char = text[index];

		if (quote) {
			if (char === quote) {
				quote = null;
			}
			continue;
		}
		if (char === "'") {
			quote = char;
		} else if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
			if (depth === 0) {
				return text.slice(open + 1, index);
			}
		}
	}

	return null;
}

/**
 * The text of the statement that starts at `statement` and is read from `from`: up to the end of the JavaScript
 * string it is written in, or the end of the source.
 *
 * The string's own delimiter decides where it ends, found by stepping back from the statement over whitespace to
 * the quote that opens the string. In a template literal an escaped backtick (\`) is MySQL quoting, not the end; in
 * a single- or double-quoted string MySQL's backticks are plain characters, and stopping at the first of them hid
 * every column the statement named after it (Greptile, #10587).
 *
 * @param {string} text The source.
 * @param {number} statement Where the statement (`ALTER TABLE …`) starts.
 * @param {number} from Where to start reading.
 * @returns {string} The statement's text from `from`.
 */
export function statementFrom(text, statement, from) {
	let opening = statement - 1;
	while (opening >= 0 && /\s/.test(text[opening])) {
		opening -= 1;
	}
	const delimiter = ["'", '"', '\x60'].includes(text[opening]) ? text[opening] : '\x60';

	for (let index = from; index < text.length; index++) {
		if (text[index] === delimiter && text[index - 1] !== '\\') {
			return text.slice(from, index);
		}
	}

	return text.slice(from);
}

/**
 * Splits text at its top-level commas: commas inside parentheses or quoted text do not split.
 *
 * @param {string} text The text.
 * @returns {string[]} The members, trimmed.
 */
export function topLevelMembers(text) {
	let parts = [];
	let depth = 0;
	let quote = null;
	let current = '';

	for (const char of text) {
		if (quote) {
			quote = char === quote ? null : quote;
		} else if (char === "'") {
			quote = char;
		} else if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
		} else if (char === ',' && depth === 0) {
			parts.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}
	parts.push(current.trim());

	return parts;
}

/**
 * The columns an `ALTER TABLE` statement adds, from every one of its `ADD` clauses.
 *
 * MySQL and PostgreSQL both take several actions in one statement (`ADD COLUMN a …, ADD COLUMN b …`), so reading
 * only the first clause let a repeated column in a later one through (Greptile, #10587).
 *
 * @param {string} actions The statement's text after `ALTER TABLE <table>`.
 * @returns {string[]} The added column names; `ADD CONSTRAINT`, `ADD INDEX` and the like are not columns.
 */
export function addedColumns(actions) {
	return topLevelMembers(actions)
		.map((member) => ADD_CLAUSE.exec(member)?.[1])
		.filter((column) => column && !NOT_A_COLUMN_ADD.test(column));
}

/**
 * The columns a CREATE TABLE body declares, in order.
 *
 * @param {string} body The text between the statement's outer parentheses.
 * @returns {string[]} The column names.
 */
export function declaredColumns(body) {
	let parts = [];
	let depth = 0;
	let quote = null;
	let current = '';

	for (const char of body) {
		if (quote) {
			quote = char === quote ? null : quote;
		} else if (char === "'") {
			quote = char;
		} else if (char === '(') {
			depth += 1;
		} else if (char === ')') {
			depth -= 1;
		} else if (char === ',' && depth === 0) {
			parts.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	parts.push(current);

	return parts
		.map((part) => part.trim())
		.filter((part) => part && !NOT_A_COLUMN.test(part))
		.map((part) => new RegExp(`^${IDENT}`).exec(part)?.[1])
		.filter(Boolean);
}

/**
 * Every column one migration's dialect branches add after their own CREATE TABLE already declared it, and every
 * column added after a CREATE TABLE whose members the gate cannot read.
 *
 * A CREATE TABLE that interpolates part of its member list (`(${inherited}, "code" …)` — the promotion set states
 * its inherited base columns that way) declares columns this reader never sees, so an ADD of one of them would pass
 * as if it were new. Such an ADD is reported as **unverifiable** rather than passed: state the column literally, or
 * add it in a migration of its own (Greptile, #10587).
 *
 * @param {string} source A migration's source.
 * @returns {{ method: string, table: string, column: string, unverifiable?: true }[]} The findings.
 */
export function findDuplicateColumnAdds(source) {
	let duplicates = [];

	// One dialect branch per method: `sqliteUpQueryRunner`, `postgresUpQueryRunner`, `mysqlUpQueryRunner`, …
	for (const branch of source.split(/(?=(?:public|private|protected)?\s*async\s+\w+\s*\()/)) {
		const method = /async\s+(\w+)/.exec(branch)?.[1] ?? '(module)';
		let created = new Map();

		for (const match of branch.matchAll(CREATE_TABLE)) {
			const body = balancedBody(branch, match.index + match[0].length - 1);
			created.set(match[1], {
				at: match.index,
				columns: new Set(body === null ? [] : declaredColumns(body)),
				// A member list the reader cannot see all of: an interpolated fragment, or a statement that never closes.
				opaque: body === null || body.includes('${')
			});
		}
		for (const match of branch.matchAll(ALTER_TABLE)) {
			const table = match[1];
			const declared = created.get(table);

			if (!declared || match.index < declared.at) {
				continue;
			}
			for (const column of addedColumns(statementFrom(branch, match.index, match.index + match[0].length))) {
				if (declared.columns.has(column)) {
					duplicates.push({ method, table, column });
				} else if (declared.opaque) {
					duplicates.push({ method, table, column, unverifiable: true });
				}
			}
		}
	}

	return duplicates;
}

/** Every `*.ts` file under a `migrations` directory, specs, declarations and barrels excluded. */
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

function main() {
	const files = ['packages', 'apps'].flatMap((top) => migrationFiles(join(ROOT, top)));
	let findings = [];

	for (const file of files) {
		for (const { method, table, column, unverifiable } of findDuplicateColumnAdds(readFileSync(file, 'utf8'))) {
			findings.push(
				`${relative(ROOT, file).split(sep).join('/')} ${method}: ${table}.${column}${
					unverifiable ? ' (unverifiable: the CREATE TABLE interpolates columns this gate cannot read)' : ''
				}`
			);
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
		`migration duplicate column check: PASSED — ${files.length} migration file(s), and no dialect branch adds a ` +
			`column its own CREATE TABLE already declared.`
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}

#!/usr/bin/env node
/*
 * A rule the specification promises has to exist in a migration, or it does not exist.
 *
 * The schema chapters state the rules the database itself enforces beside the columns they guard, each
 * named the way the migration names it — `CHK_organization_contact_loyalty_nonneg`, `CHK_unit_factor_at_least_one`
 * and so on — and a reader of the chapter is entitled to conclude that the rule is in force. Nothing
 * checked that. A `CHECK` that is promised in the chapter and created by no migration is a rule that
 * holds nowhere, and it is invisible from both sides: the chapter reads as though it were carried, and
 * the migrations read as though nothing were missing. `organization_contact`'s loyalty rule was in
 * exactly that state — promised, documented as "added on Postgres and MySQL", and created by no
 * migration at all — and a gate is what stops the next one from being written in the same way.
 *
 * What this script compares:
 *
 *   - **Promised.** Every `CHK_` name the specification mentions, with the chapter and line it is
 *     promised in, and the table it belongs to. The table is resolved from the statement the name
 *     appears in — a `CREATE TABLE` or an `ALTER TABLE` in the same fenced block or on the same line —
 *     and, when the prose names no statement, from the name itself: a constraint is named
 *     `<table>_<rule>`, so the longest prefix that is a table the migrations know is the table.
 *   - **In force.** Every `CHK_` name any migration creates, read from the migration sources including
 *     the inline `CREATE TABLE` bodies they carry.
 *
 * A promised rule whose table exists and which no migration creates is a **gap**, and the script exits
 * non-zero while one exists. A promise that cannot be created yet — for a table no migration creates, or
 * for a column that is still to be added — is listed in `DEFERRED` below with the reason, and does not
 * fail the run: those are the record of what a later chapter has still to deliver. The list is the point,
 * exactly as the deliberately one-sided root fields are in the API parity gate — a promise that cannot be
 * kept yet has to be *named* as such rather than left to look like a gap forever. An entry whose column
 * has since arrived is reported as stale, so the wave that lands it has to move the name out of the list
 * and into a migration.
 *
 * Usage:
 *   node tools/scripts/constraint-parity-check.mjs [repoRoot] [docsRoot]
 *
 * `docsRoot` defaults to the specification that sits beside the repository; when it is not present the
 * gate reports that it could not look and exits 0, because the repository must build without it.
 */
'use strict';

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(HERE, '..', '..');
const DOCS = process.argv[3] ? resolve(process.argv[3]) : resolve(ROOT, '..', '..', 'docs');

/** Every `.md` under a directory, at any depth. */
function markdownFiles(directory) {
	const found = [];

	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const path = join(current, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
				found.push(path);
			}
		}
	};

	walk(directory);

	return found.sort();
}

/** Every `.ts` under a directory whose path names a migrations folder, at any depth. */
function migrationFiles(directory) {
	const found = [];

	const walk = (current) => {
		let entries;

		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			return;
		}

		for (const entry of entries) {
			if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
				continue;
			}

			const path = join(current, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.isFile() && entry.name.endsWith('.ts') && path.split(sep).includes('migrations')) {
				found.push(path);
			}
		}
	};

	walk(directory);

	return found.sort();
}

/** Every `CHK_…` name in a piece of text, without repeats. */
function checkNames(text) {
	return [...new Set(text.match(/CHK_[A-Za-z0-9_]+/g) ?? [])];
}

/**
 * Every `CHK_…` name a piece of text *creates*, without repeats.
 *
 * A migration in this platform is mostly prose, and its comments name the constraints it creates — which
 * is exactly what a reader wants and exactly what a naive scan gets wrong: a name mentioned in a comment
 * about a rule that is deliberately deferred was counted as in force, and the deferral then vanished from
 * the report instead of being reported. Only a name that follows the `CONSTRAINT` keyword is a statement
 * the database executes, whether it appears in a `CREATE TABLE` body or in an `ALTER TABLE … ADD
 * CONSTRAINT`, so that is what is counted.
 *
 * @param text The migration source.
 * @returns The names it creates.
 */
function createdCheckNames(text) {
	const names = new Set();

	for (const match of text.matchAll(/CONSTRAINT\s+["'`]?(CHK_[A-Za-z0-9_]+)["'`]?/g)) {
		names.add(match[1]);
	}

	return [...names];
}

/** Every table name a piece of text creates, alters or references in a statement. */
function statementTables(text) {
	const names = new Set();

	for (const match of text.matchAll(/(?:CREATE|ALTER)\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z0-9_]+)["'`]?/gi)) {
		names.add(match[1]);
	}

	return names;
}

if (!existsSync(DOCS)) {
	console.log(`constraint parity check: the specification is not at ${DOCS}; nothing to compare against.`);
	process.exit(0);
}

/*
|--------------------------------------------------------------------------
| What is in force: the names the migrations create
|--------------------------------------------------------------------------
*/
const migrations = migrationFiles(join(ROOT, 'packages'));
const inForce = new Map();
const tables = new Map();

for (const file of migrations) {
	const source = readFileSync(file, 'utf8');

	for (const name of createdCheckNames(source)) {
		if (!inForce.has(name)) {
			inForce.set(name, file);
		}
	}

	/*
	 * A table's columns are read from the statements that create and alter it: `CREATE TABLE "x" ( … )`
	 * up to the primary key that closes every table this programme writes, and every `ALTER TABLE "x"`
	 * statement. A column a promise names but no statement declares is what makes a rule unimplementable
	 * today, so this is the difference between "the constraint is missing" and "the column is".
	 */
	for (const match of source.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?([A-Za-z0-9_]+)["'`]?\s*\(/gi)) {
		const table = match[1];
		const from = match.index + match[0].length;
		const rest = source.slice(from);
		const primaryKey = rest.search(/PRIMARY\s+KEY/i);
		const body = rest.slice(0, primaryKey === -1 ? 4000 : primaryKey);
		const entry = tables.get(table) ?? { columns: new Set(), files: new Set() };

		entry.files.add(file);

		for (const column of body.matchAll(/["'`]([A-Za-z0-9_]+)["'`]\s+[A-Za-z]/g)) {
			entry.columns.add(column[1]);
		}

		tables.set(table, entry);
	}

	for (const match of source.matchAll(/ALTER\s+TABLE\s+["'`]?([A-Za-z0-9_]+)["'`]?([\s\S]{0,2000}?)(?:`\)|`;|"\)|";|\)`|\);)/gi)) {
		const table = match[1];
		const entry = tables.get(table) ?? { columns: new Set(), files: new Set() };

		entry.files.add(file);

		for (const column of match[2].matchAll(/["'`]([A-Za-z0-9_]+)["'`]/g)) {
			entry.columns.add(column[1]);
		}

		tables.set(table, entry);
	}
}

/*
|--------------------------------------------------------------------------
| What is promised: the names the specification states
|--------------------------------------------------------------------------
*/
const promised = new Map();

for (const file of markdownFiles(DOCS)) {
	const lines = readFileSync(file, 'utf8').split(/\r?\n/);

	lines.forEach((line, index) => {
		for (const name of checkNames(line)) {
			if (promised.has(name)) {
				continue;
			}

			/*
			 * The table is read from the statement the name appears in. A fenced SQL block states one
			 * table and then the rules that hang off it, so the block's own `CREATE TABLE`/`ALTER TABLE`
			 * is the answer; elsewhere the line itself has to carry the statement.
			 */
			const window = [line];

			for (let back = index; back >= 0 && back > index - 40; back -= 1) {
				window.unshift(lines[back]);

				if (statementTables(lines[back]).size > 0) {
					break;
				}
			}

			const stated = [...statementTables(window.join('\n'))];
			const byName = [...tables.keys()]
				.filter((table) => name.startsWith(`CHK_${table}_`) || name.startsWith(`CHK_${table}`))
				.sort((a, b) => b.length - a.length);

			promised.set(name, {
				doc: basename(file),
				line: index + 1,
				table: stated.find((table) => tables.has(table)) ?? byName[0] ?? stated[0] ?? undefined
			});
		}
	});
}

/*
|--------------------------------------------------------------------------
| The promises that cannot be kept yet, and why
|--------------------------------------------------------------------------
|
| Each entry names the column (or the table) the rule is about and which no migration declares yet, so
| the reason is checkable rather than asserted: a `why` that has stopped being true is reported as a
| stale entry, and the wave that makes it true has to move the promise into a migration.
*/
const DEFERRED = [
	{
		name: 'CHK_operation_status_terminal',
		table: 'operation',
		column: 'lockedAt',
		why: 'the lease is still inside `operation.state`; §3.14 moves it to the `lockedAt`/`lockedBy`/`leaseExpiresAt` columns, and the rule belongs to those columns'
	}
];

const deferredByName = new Map(DEFERRED.map((entry) => [entry.name, entry]));

/*
|--------------------------------------------------------------------------
| The comparison
|--------------------------------------------------------------------------
*/
const gaps = [];
const deferred = [];
const stale = [];

for (const [name, promise] of [...promised].sort(([a], [b]) => a.localeCompare(b))) {
	if (inForce.has(name)) {
		continue;
	}

	const entry = deferredByName.get(name);

	if (entry) {
		// The reason has to still be true: a column that has arrived means the promise can be kept, and
		// the entry has to leave this list in the same change that keeps it.
		const columns = tables.get(entry.table)?.columns;
		const arrived = columns ? columns.has(entry.column) : false;

		if (arrived) {
			stale.push(entry);
		} else {
			deferred.push({ name, ...promise, why: entry.why });
		}

		continue;
	}

	const tableExists = promise.table ? tables.has(promise.table) : false;

	(tableExists ? gaps : deferred).push({
		name,
		...promise,
		why: promise.table ? undefined : 'no migration creates the table the promise names'
	});
}

console.log(`constraint parity check: ${migrations.length} migration file(s), ${tables.size} table(s), ${inForce.size} check constraint(s) in force.`);
console.log(`constraint parity check: ${promised.size} check constraint(s) promised by the specification.`);

if (deferred.length) {
	console.log(`\nDeferred (${deferred.length}) — promised, and not creatable yet:`);

	for (const entry of deferred) {
		console.log(`  · ${entry.name}  (${entry.doc}:${entry.line}${entry.table ? `, table ${entry.table}` : ''})`);
		console.log(`      ${entry.why}`);
	}
}

if (stale.length) {
	console.log(`\nSTALE (${stale.length}) — the reason for deferring these has stopped being true:`);

	for (const entry of stale) {
		console.log(`  ✗ ${entry.name} — ${entry.table}.${entry.column} now exists, so the rule can be created;`);
		console.log('      move it out of DEFERRED and into a migration.');
	}
}

if (gaps.length || stale.length) {
	if (gaps.length) {
		console.log(`\nGAPS (${gaps.length}) — promised for a table that exists, and created by no migration:`);

		for (const entry of gaps) {
			console.log(`  ✗ ${entry.name}  (${entry.doc}:${entry.line}, table ${entry.table})`);
		}
	}

	console.log('\nconstraint parity check: FAILED');
	process.exit(1);
}

console.log(
	'\nconstraint parity check: OK — every promised rule whose table exists is created by a migration, and every deferral still has its reason.'
);

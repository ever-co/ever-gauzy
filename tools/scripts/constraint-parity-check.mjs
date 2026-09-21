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
 * The script also reads every unique index the migrations create and fails on a tuple that names a
 * nullable column with nothing to fold it and nothing to exempt it — the section below the promise
 * comparison says why, and that half runs whether or not the specification is present, because it needs
 * nothing but the migrations.
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

/*
|--------------------------------------------------------------------------
| A unique index that enforces nothing
|--------------------------------------------------------------------------
|
| The second half of this gate. A `CHECK` that no migration creates is a rule that holds nowhere, and the
| first half is what stops one being written; a **unique index whose tuple contains a nullable column** is
| a rule that reads as though it held and does not, which is worse, because the statement is right there
| in the migration and a reviewer's eye passes over it.
|
| Two shapes of that, both of which were in this repository and neither of which anything caught:
|
|   - **The MySQL soft-delete tuple.** Postgres and SQLite write "unique among the rows that are not
|     deleted" as `CREATE UNIQUE INDEX … WHERE "deletedAt" IS NULL`. MySQL has no partial index, and the
|     obvious-looking substitute is to put `deletedAt` into the tuple instead. It enforces nothing at all:
|     a unique index in MySQL (and MariaDB) exempts **every** tuple that contains a `NULL`, and `deletedAt`
|     is `NULL` on precisely the live rows the rule is about. Seventy-two such indexes were accepted into
|     one branch, and every one of them accepted duplicate live rows in silence.
|   - **The nullable scope column, on every dialect.** `organizationId`, `channelId`, `customerId` are
|     nullable, and no SQL dialect compares two `NULL`s equal, so `("organizationId", "key")` does not fire
|     for a row that has no organization — on Postgres and SQLite because the two rows differ, on MySQL for
|     the same exemption rule as above. `UQ_idempotency_org_scope_key` is the worst of them: the retry lock
|     of the whole API disappears for any caller with no organization.
|
| What the gate accepts, in place of a bare nullable column:
|
|   - the column folded — `COALESCE("organizationId", '00000000-…')` on Postgres and SQLite, a stored
|     generated column on MySQL, which is what a dialect with no expression index has instead;
|   - a predicate that names the column — `WHERE "externalId" IS NOT NULL` — because a `NULL` is then meant
|     to exempt the row, and the exemption is stated in the SQL rather than happening by accident. The
|     predicate may be written on any dialect's copy of the index: MySQL's own `NULL` rule is exactly that
|     predicate, which is why its branch leaves such a column raw;
|   - a comment carrying `null-exempt: <column>` (or `null-exempt: <table>.<column>`), for the cases where
|     the exemption is a judgement about the domain rather than something the SQL can state. It has to be
|     written out, so the next reader knows the bare column was read and kept rather than missed.
|
| `RULE_FROM` below is the boundary: the rule is held against the migrations of this programme and not
| against the ones that were applied to production years ago, which cannot be rewritten in any case.
|
| What this half does **not** read, so that a green run is not mistaken for more than it is: a migration
| that builds its SQL from a table of definitions rather than writing the statement out —
| `AlterCoreTablesForExtensions1791000000095` is the one — is invisible to the scan, because there is no
| `CREATE UNIQUE INDEX` for it to match. Its tuples are reviewed by hand, and a second file written that
| way would need this scan taught the shape.
*/

/**
 * The migration timestamp this rule starts at.
 *
 * Every migration before it has been applied in production and cannot be rewritten, and the pattern that
 * dominates them is not this defect: TypeORM's generated `REL_…` index on a nullable one-to-one column,
 * where a null means "no relation" and the exemption is correct. The rule therefore starts with the set
 * that introduced the defect it is about, and the boundary is stated as a number rather than left to a
 * list of five hundred names that nobody would read.
 */
const RULE_FROM = 1791000000000;

/** Whether a migration file is one the rule applies to, read from the timestamp its name carries. */
function underRule(file) {
	const stamp = basename(file).match(/^(\d{13,})-/);

	return stamp ? Number(stamp[1]) >= RULE_FROM : false;
}

/** The body of each `<dialect>UpQueryRunner` method, keyed by dialect. */
function dialectBodies(source) {
	const bodies = new Map();

	for (const dialect of ['postgres', 'sqlite', 'mysql']) {
		const start = source.search(new RegExp(`async ${dialect}UpQueryRunner\\(`));

		if (start === -1) {
			continue;
		}

		const rest = source.slice(start + 10);
		const next = rest.search(/\n\t(?:public )?async \w+QueryRunner\(/);

		bodies.set(dialect, rest.slice(0, next === -1 ? rest.length : next));
	}

	return bodies;
}

/** The index of the `)` that closes the `(` at `open`. */
function closing(text, open) {
	let depth = 0;

	for (let i = open; i < text.length; i += 1) {
		if (text[i] === '(') {
			depth += 1;
		} else if (text[i] === ')') {
			depth -= 1;

			if (depth === 0) {
				return i;
			}
		}
	}

	return -1;
}

/** A comma-separated list split on its top-level commas. */
function topLevel(text) {
	const parts = [];
	let depth = 0;
	let current = '';

	for (const character of text) {
		if (character === '(') {
			depth += 1;
		} else if (character === ')') {
			depth -= 1;
		}

		if (character === ',' && depth === 0) {
			parts.push(current);
			current = '';
		} else {
			current += character;
		}
	}

	parts.push(current);

	return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * Every column a `CREATE TABLE` (or an `ALTER TABLE … ADD`) in this text declares, and whether the
 * declaration says `NOT NULL`.
 *
 * A **generated** column is recorded as not nullable whatever its declaration says. It is the substitute
 * for a partial index on a dialect that has none — `deletedKey`, `organizationKey`, `isDefaultKey` — and
 * `isDefaultKey` is deliberately nullable, because on MySQL a null key part is what exempts the row.
 * Flagging the fix as the defect would be the one way to make this gate useless.
 */
function declaredColumns(text, quoted) {
	const declared = new Map();
	const add = (table, column, nullable) => {
		if (!declared.has(table)) {
			declared.set(table, new Map());
		}

		declared.get(table).set(column, nullable);
	};

	const create = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${quoted}([A-Za-z0-9_]+)${quoted}\\s*\\(`, 'g');

	for (const match of text.matchAll(create)) {
		const open = match.index + match[0].length - 1;
		const close = closing(text, open);

		if (close === -1) {
			continue;
		}

		for (const part of topLevel(text.slice(open + 1, close))) {
			const column = part.match(new RegExp(`^${quoted}([A-Za-z0-9_]+)${quoted}\\s+(.*)$`, 's'));

			if (!column) {
				continue;
			}

			const generated = /GENERATED\s+ALWAYS\s+AS/i.test(column[2]);

			add(match[1], column[1], !generated && !/\bNOT NULL\b/i.test(column[2]));
		}
	}

	const alter = new RegExp(
		`ALTER TABLE ${quoted}([A-Za-z0-9_]+)${quoted}\\s+ADD\\s+(?:COLUMN\\s+)?${quoted}([A-Za-z0-9_]+)${quoted}\\s+([^\`"\\n]*)`,
		'g'
	);

	for (const match of text.matchAll(alter)) {
		const generated = /GENERATED\s+ALWAYS\s+AS/i.test(match[3]);

		add(match[1], match[2], !generated && !/\bNOT NULL\b/i.test(match[3]));
	}

	return declared;
}

/**
 * Every unique index a dialect body creates, in the two shapes the migrations of this repository use:
 * the standalone `CREATE UNIQUE INDEX`, and the `UNIQUE INDEX` declared inside a `CREATE TABLE` body,
 * which is how MySQL tables usually carry theirs.
 */
function uniqueIndexes(body, quoted) {
	const found = [];
	const statement = new RegExp(
		`CREATE UNIQUE INDEX (?:IF NOT EXISTS )?${quoted}([A-Za-z0-9_]+)${quoted} ON ${quoted}([A-Za-z0-9_]+)${quoted}\\s*\\(`,
		'g'
	);

	for (const match of body.matchAll(statement)) {
		const open = match.index + match[0].length - 1;
		const close = closing(body, open);

		if (close === -1) {
			continue;
		}

		const lineEnd = body.indexOf('\n', close);
		const tail = body.slice(close + 1, lineEnd === -1 ? body.length : lineEnd);

		found.push({
			name: match[1],
			table: match[2],
			tuple: body.slice(open + 1, close),
			predicate: (tail.match(/\bWHERE\s+([\s\S]*?)(?:`|$)/) ?? [])[1] ?? ''
		});
	}

	const create = new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${quoted}([A-Za-z0-9_]+)${quoted}\\s*\\(`, 'g');

	for (const match of body.matchAll(create)) {
		const open = match.index + match[0].length - 1;
		const close = closing(body, open);

		if (close === -1) {
			continue;
		}

		for (const part of topLevel(body.slice(open + 1, close))) {
			const inline = part.match(
				new RegExp(`^(?:CONSTRAINT\\s+${quoted}([A-Za-z0-9_]+)${quoted}\\s+)?UNIQUE(?:\\s+(?:INDEX|KEY))?\\s*(?:${quoted}([A-Za-z0-9_]+)${quoted})?\\s*\\(([^)]*)\\)`, 'i')
			);

			if (inline) {
				found.push({
					name: inline[1] ?? inline[2] ?? '(anonymous)',
					table: match[1],
					tuple: inline[3],
					predicate: ''
				});
			}
		}
	}

	return found;
}

/**
 * The tuple members of an index, one per top-level comma.
 *
 * A member is *folded* when it is wrapped in `COALESCE` or `IFNULL`, and *bare* when it is a quoted
 * column, with or without the key-part prefix length MySQL needs for a long `varchar`.
 */
function tupleMembers(tuple, quoted) {
	return topLevel(tuple).map((part) => {
		if (/^\s*(?:COALESCE|IFNULL)\s*\(/i.test(part)) {
			return { folded: true, column: (part.match(new RegExp(`${quoted}([A-Za-z0-9_]+)${quoted}`)) ?? [])[1] };
		}

		const bare = part.match(new RegExp(`^${quoted}([A-Za-z0-9_]+)${quoted}(?:\\(\\d+\\))?$`));

		return bare ? { folded: false, column: bare[1] } : { folded: true, column: undefined };
	});
}

/*
|--------------------------------------------------------------------------
| The scan
|--------------------------------------------------------------------------
*/
const QUOTED = { postgres: '"', sqlite: '"', mysql: '\\\\`' };
const unguarded = [];

for (const file of migrationFiles(join(ROOT, 'packages')).filter(underRule)) {
	const source = readFileSync(file, 'utf8');
	const bodies = dialectBodies(source);

	if (bodies.size === 0) {
		continue;
	}

	// A name the file itself exempts, written out so the bare column reads as a decision.
	const exempted = new Set([...source.matchAll(/null-exempt:\s*([A-Za-z0-9_.]+)/g)].map((match) => match[1]));

	// Every predicate any dialect writes for an index name, so that `WHERE "x" IS NOT NULL` on the
	// Postgres copy is read as the exemption the MySQL copy relies on.
	const asserted = new Map();
	const indexes = [];

	for (const [dialect, body] of bodies) {
		for (const index of uniqueIndexes(body, QUOTED[dialect])) {
			indexes.push({ ...index, dialect });

			for (const match of index.predicate.matchAll(/["`]?([A-Za-z0-9_]+)["`]?\s+IS NOT NULL/g)) {
				if (!asserted.has(index.name)) {
					asserted.set(index.name, new Set());
				}

				asserted.get(index.name).add(match[1]);
			}
		}
	}

	const columns = new Map();

	for (const [dialect, body] of bodies) {
		for (const [table, declared] of declaredColumns(body, QUOTED[dialect])) {
			if (!columns.has(table)) {
				columns.set(table, new Map());
			}

			for (const [column, nullable] of declared) {
				// A column the file declares nullable on any dialect is nullable for this purpose.
				columns.get(table).set(column, (columns.get(table).get(column) ?? false) || nullable);
			}
		}
	}

	for (const index of indexes) {
		const declared = columns.get(index.table);

		if (!declared) {
			continue;
		}

		for (const member of tupleMembers(index.tuple, QUOTED[index.dialect])) {
			if (member.folded || !member.column || declared.get(member.column) !== true) {
				continue;
			}

			if (asserted.get(index.name)?.has(member.column)) {
				continue;
			}

			if (exempted.has(member.column) || exempted.has(`${index.table}.${member.column}`)) {
				continue;
			}

			unguarded.push({
				file: file.slice(ROOT.length + 1),
				dialect: index.dialect,
				name: index.name,
				table: index.table,
				column: member.column
			});
		}
	}
}

console.log(
	`constraint parity check: ${unguarded.length === 0 ? 'no' : unguarded.length} unique index tuple(s) name a nullable column without a fold, a predicate or a stated exemption.`
);

if (unguarded.length) {
	console.log('\nUNGUARDED (%d) — a unique index that does not fire for the rows it is about:', unguarded.length);

	for (const entry of unguarded) {
		console.log(`  ✗ ${entry.name} (${entry.dialect}) — ${entry.table}.${entry.column} is nullable and bare`);
		console.log(`      ${entry.file}`);
	}

	console.log(
		'\n      Fold it — COALESCE/IFNULL on Postgres and SQLite, a stored generated column on MySQL — or'
	);
	console.log('      state the exemption: a predicate that names the column, or a `null-exempt: <column>` comment.');
	console.log('\nconstraint parity check: FAILED');
	process.exit(1);
}

if (!existsSync(DOCS)) {
	console.log(`constraint parity check: the specification is not at ${DOCS}; nothing else to compare against.`);
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
| the reason is checkable rather than asserted. The list is **empty**: every rule the specification
| promises is created by a migration. It stays because the mechanism is the point — a promise that cannot
| be kept yet has to be named here rather than left to look like a gap forever, and an entry whose reason
| has stopped being true (its column has arrived, or a migration now creates the rule) is reported as
| stale so the wave that lands it has to move the name out of this list.
*/
const DEFERRED = [];

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
	const entry = deferredByName.get(name);

	/*
	 * A deferred promise that is now in force is a *stale entry*, and it is reported as one: the list of
	 * deferrals is a statement about the specification's own gaps, and an entry left behind after the gap
	 * closed reads as a gap that is still open. The check runs before the "already in force" short-circuit
	 * for exactly that reason.
	 */
	if (entry && inForce.has(name)) {
		stale.push({ ...entry, why: 'the promise is now created by a migration' });

		continue;
	}

	if (inForce.has(name)) {
		continue;
	}

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

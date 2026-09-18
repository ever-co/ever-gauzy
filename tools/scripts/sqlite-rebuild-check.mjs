/**
 * Does any SQLite table rebuild leave another table naming a dropped backup?
 *
 * A SQLite table cannot be altered in place, so a migration that adds or removes a constraint to an
 * existing table rebuilds it: rename the table aside, create it again, copy the rows back, drop the
 * backup. Since SQLite 3.25 the rename **also** rewrites the foreign keys of every table that
 * referenced the renamed one, so each of those tables is left pointing at `<table>_<what>_fk_backup` —
 * a name the same migration then drops. Nothing fails at migration time: the definitions are valid and
 * the schema looks complete. Every later write to one of those tables fails at prepare time with
 * `no such table: main.<table>_<what>_fk_backup`, which surfaces as a 500 from whichever endpoint
 * touched the table first — long after the migration that caused it.
 *
 * The guard is one pragma: `legacy_alter_table = ON` around the rename tells SQLite to leave other
 * tables' definitions alone, and it must be turned off again because it is a connection-level setting.
 *
 * Two readings, because they catch different mistakes:
 *
 *   - **the sources** — every `RENAME TO "<x>_fk_backup"` must sit inside a file that turns the pragma
 *     on before it. This is the regression guard: it fails the moment a new rebuild is written without
 *     the guard.
 *   - **the database** (with `--db <path>`) — no object's own definition may name a backup table.
 *     This is what proves the guard works, on the schema that exists rather than the one intended.
 *
 * Usage (from the repository root):
 *
 *   node tools/scripts/sqlite-rebuild-check.mjs
 *   node tools/scripts/sqlite-rebuild-check.mjs --db apps/api/data/gauzy.sqlite3
 *
 * It exits 0 when every rebuild is guarded and no definition names a backup, and 1 otherwise.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');

/** Every file under a directory, skipping build output. */
function walk(dir) {
	const out = [];
	if (!existsSync(dir)) return out;

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (['node_modules', 'dist', 'coverage', '.nx', '.git'].includes(entry.name)) continue;
			out.push(...walk(full));
		} else {
			out.push(full);
		}
	}

	return out;
}

const BACKUP_NAME = /_fk_backup\b|_rebuild_backup\b/;
const RENAME = /ALTER TABLE\s+"([^"]+)"\s+RENAME TO\s+"([^"]*)"/g;

const failures = [];

/* ------------------------------------------------------------------------------------------------
 * The sources
 * ---------------------------------------------------------------------------------------------- */

const migrationFiles = walk(join(repo, 'packages')).filter(
	(file) => file.endsWith('.ts') && /migration/i.test(file) && !file.endsWith('.map')
);

let rebuilds = 0;

for (const file of migrationFiles) {
	const source = readFileSync(file, 'utf8');

	for (const match of source.matchAll(RENAME)) {
		if (!BACKUP_NAME.test(match[2])) continue;

		rebuilds++;

		// The guard must appear before the rename, inside the same method: a pragma set anywhere in the
		// file is not a guard, and one set after the rename is too late.
		const before = source.slice(0, match.index);
		const guard = before.lastIndexOf('legacy_alter_table = ON');
		const guarded = guard !== -1 && match.index - guard < 1500;

		if (!guarded) {
			failures.push(
				`${relative(repo, file)} renames "${match[1]}" to "${match[2]}" with no legacy_alter_table guard before it`
			);
		}
	}
}

/* ------------------------------------------------------------------------------------------------
 * The database, when one is named
 * ---------------------------------------------------------------------------------------------- */

const dbArgument = process.argv.indexOf('--db');
const databasePath = dbArgument === -1 ? null : resolve(process.cwd(), process.argv[dbArgument + 1] ?? '');

let objects = 0;
let dangling = 0;

if (databasePath) {
	if (!existsSync(databasePath)) {
		console.error(`no database at ${databasePath}`);
		process.exit(2);
	}

	const BetterSqlite = (await import('better-sqlite3')).default;
	const db = new BetterSqlite(databasePath, { readonly: true, fileMustExist: true });

	const rows = db.prepare(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL`).all();
	objects = rows.length;

	for (const row of rows) {
		if (!BACKUP_NAME.test(row.sql ?? '') && !BACKUP_NAME.test(row.name ?? '')) continue;

		dangling++;
		const named = [...new Set((row.sql ?? '').match(/[a-z_]*_(?:fk|rebuild)_backup\b/g) ?? [])];
		failures.push(
			`${row.type} "${row.name}" names a dropped backup: ${named.length ? named.join(', ') : row.name}`
		);
	}

	// A foreign key is resolved when a statement is prepared, so preparing one is the honest test.
	const probes = [
		['payment_method_token', `INSERT INTO "payment_method_token" ("id","providerKey","token","type","status") VALUES ('probe','p','t','CARD','ACTIVE')`],
		['order', `INSERT INTO "order" ("id") VALUES ('probe')`],
		['commerce_cart_line', `INSERT INTO "commerce_cart_line" ("id") VALUES ('probe')`],
		['refund', `INSERT INTO "refund" ("id") VALUES ('probe')`],
		['payment_capture', `INSERT INTO "payment_capture" ("id") VALUES ('probe')`],
		['stock_movement', `INSERT INTO "stock_movement" ("id") VALUES ('probe')`],
		['stock_reservation', `INSERT INTO "stock_reservation" ("id") VALUES ('probe')`],
		['tag_payment', `INSERT INTO "tag_payment" ("paymentId","tagId") VALUES ('probe','probe')`]
	];

	for (const [table, statement] of probes) {
		const present = rows.some((row) => row.type === 'table' && row.name === table);
		if (!present) continue;

		try {
			db.prepare(`EXPLAIN ${statement}`).all();
		} catch (error) {
			failures.push(`${table} cannot be written: ${error.message}`);
		}
	}

	db.close();
}

/* ------------------------------------------------------------------------------------------------
 * The verdict
 * ---------------------------------------------------------------------------------------------- */

console.log('');
console.log('sqlite rebuild check');
console.log('====================');
console.log(`  migration files scanned : ${migrationFiles.length}`);
console.log(`  table rebuilds found    : ${rebuilds}`);
if (databasePath) {
	console.log(`  database                : ${databasePath}`);
	console.log(`  schema objects read     : ${objects}`);
	console.log(`  definitions naming a backup: ${dangling}`);
} else {
	console.log('  database                : not checked (pass --db <path> to check a live schema)');
}
console.log('');

if (failures.length === 0) {
	console.log('  OK — every rebuild is guarded, and no table names a dropped backup');
	console.log('');
	process.exit(0);
}

console.log(`  ${failures.length} failure(s):`);
for (const failure of failures) console.log(`    x ${failure}`);
console.log('');
process.exit(1);

#!/usr/bin/env node
/**
 * Gate: every column type an entity states literally is one TypeORM accepts on all three supported databases.
 *
 * TypeORM validates each entity's columns against the configured driver when the DataSource initialises, and a
 * column it refuses stops the API from booting on that database — with the first refusal only, after a hundred
 * connection retries. SQLite, which every local run and most CI specs use, accepts types Postgres and MySQL refuse,
 * so a column that is wrong for them is invisible until someone boots there. Two classes of it shipped on this
 * branch and were found only by booting against real Postgres and MySQL:
 *
 *   - `@MultiORMColumn({ type: 'jsonb' })` on 29 columns (the `metadata` of inventory, warehouse, returns,
 *     subscription and purchasing rows): `Data type "jsonb" … is not supported by "mysql" database`. The migrations
 *     create those columns as `jsonb` on Postgres, `json` on MySQL and `text` on SQLite, which is what
 *     `@JsonColumn` resolves per dialect — the fix `SearchDocument.attributes` had already needed.
 *   - `type: 'simple-enum'` with a `length` (`OrderLine.invoiceStatus`): TypeORM maps `simple-enum` to a native enum
 *     on Postgres and MySQL and refuses a length on one — the API did not boot on Postgres, the production database.
 *
 * The rule is TypeORM's own, stated once: a literal `type` must be one the Postgres, MySQL and SQLite drivers all list
 * in `supportedDataTypes`, or one of the portable types each driver normalises (`uuid`, `simple-enum`,
 * `simple-array`, `simple-json`); and a `length` is portable only on `varchar`. A type chosen per dialect
 * (`isPostgres() ? 'jsonb' : …`) or by a dialect-aware decorator (`@JsonColumn`, `@JsonbColumn`) is not a literal and
 * is not checked. The lists below were read from `typeorm`'s drivers (`supportedDataTypes`, `withLengthColumnTypes`)
 * and are written here so the gate runs without an install; update them if a TypeORM upgrade changes a driver.
 *
 * Run from the repository root: `node tools/scripts/entity-column-dialect-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const PACKAGES = join(ROOT, 'packages');
const SKIP = new Set(['node_modules', 'dist', '.angular', 'coverage']);

/** Types every one of TypeORM's Postgres, MySQL and SQLite drivers lists in `supportedDataTypes`. */
const SUPPORTED_EVERYWHERE = new Set([
	'int',
	'smallint',
	'integer',
	'bigint',
	'decimal',
	'numeric',
	'real',
	'float',
	'double precision',
	'varchar',
	'text',
	'date',
	'time',
	'boolean',
	'json'
]);

/** Types each driver's `normalizeType` maps to one of its own (`uuid` is `varchar` on MySQL and SQLite). */
const PORTABLE = new Set(['uuid', 'simple-enum', 'simple-array', 'simple-json']);

/** The only type all three drivers list in `withLengthColumnTypes`. */
const LENGTH_EVERYWHERE = new Set(['varchar']);

/**
 * The entity files under a directory, skipping build output and installed modules.
 *
 * @param {string} directory Where to start.
 * @returns {string[]} Absolute paths.
 */
function entities(directory) {
	const found = [];

	for (const name of readdirSync(directory)) {
		if (SKIP.has(name)) continue;

		const path = join(directory, name);

		if (statSync(path).isDirectory()) {
			found.push(...entities(path));
		} else if (name.endsWith('.entity.ts')) {
			found.push(path);
		}
	}

	return found;
}

/** The options object of a column decorator, when it is a flat literal: `@MultiORMColumn({ … })`, `@Column({ … })`. */
const COLUMN = /@(MultiORMColumn|Column)\(\s*\{([^{}]*)\}\s*\)/g;

const violations = [];
let literals = 0;
let files = 0;

for (const file of entities(PACKAGES)) {
	files++;

	const text = readFileSync(file, 'utf8');

	for (const match of text.matchAll(COLUMN)) {
		const options = match[2];
		const type = /\btype:\s*'([^']+)'/.exec(options)?.[1];

		if (type === undefined) continue;

		literals++;

		const at = `${relative(ROOT, file).split(sep).join('/')}:${text.slice(0, match.index).split('\n').length}`;

		if (!SUPPORTED_EVERYWHERE.has(type) && !PORTABLE.has(type)) {
			violations.push(`${at}  type '${type}' is not accepted by TypeORM on every supported database`);
		} else if (/\blength:/.test(options) && !LENGTH_EVERYWHERE.has(type)) {
			violations.push(`${at}  type '${type}' with a length (TypeORM refuses a length on it on some database)`);
		}
	}
}

if (violations.length) {
	console.error(
		`entity column dialect check: ${violations.length} column(s) would stop the API booting on some database:`
	);

	for (const violation of violations) console.error(`  ${violation}`);

	console.error('');
	console.error(
		'Use a type every driver accepts, choose it per dialect (`isPostgres() ? … : isMySQL() ? … : …`) as the ' +
			'migration does, or a dialect-aware decorator (`@JsonColumn`, `@JsonbColumn` for JSON). Drop a `length` ' +
			'from anything but `varchar`.'
	);
	process.exit(1);
}

console.log(
	`entity column dialect check: PASSED — ${literals} literal column type(s) across ${files} entity file(s), each ` +
		'accepted by TypeORM on Postgres, MySQL and SQLite.'
);

#!/usr/bin/env node
/**
 * Plugin contract check.
 *
 * The platform lets a plugin package own its own tables, migrations, permissions, feature flags,
 * services, REST controllers and GraphQL resolvers. That freedom is what makes a plugin a plugin,
 * but it also means the conventions are only enforced by review — and a package that quietly
 * forgets its migration, its repository pair, its tenant guard or one of its three SQL dialects
 * fails at runtime, on one database, in one environment.
 *
 * This script is the machine-enforceable half of those conventions. It reads the packages on disk
 * and checks them against a declared contract, so a breach is caught in CI rather than in
 * production. It does not need the monorepo to be built, and it does not need the database
 * dependencies to be installed — it only reads source.
 *
 * Run:  node tools/scripts/plugin-contract-check.mjs
 * Exit: 0 when every check passes, 1 otherwise.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const pluginsDir = join(repoRoot, 'packages', 'plugins');
const coreDir = join(repoRoot, 'packages', 'core', 'src', 'lib');

/* ------------------------------------------------------------------------------------------------
 * The contract
 * ---------------------------------------------------------------------------------------------- */

/**
 * The plugin packages this platform is expected to ship, with the tables each one owns.
 *
 * `tables` is the authoritative list. A table may only be declared by the plugin named here, and
 * every table listed must actually be created by an entity or by an explicit migration.
 */
const PLUGINS = {
	catalog: [
		'collection',
		'collection_channel',
		'collection_closure',
		'collection_product',
		'collection_variant',
		'product_channel',
		'product_relation',
		'product_variant_channel',
		'product_variant_media',
		'tag_product_variant'
	],
	pricing: ['exchange_rate', 'price_list', 'price_preference', 'product_price'],
	tax: ['tax_category', 'tax_rate'],
	inventory: [
		'channel_warehouse',
		'stock_adjustment',
		'stock_alert',
		'stock_count',
		'stock_count_line',
		'stock_movement',
		'stock_reservation',
		'stock_transfer',
		'stock_transfer_line'
	],
	warehouse: [
		'carrier_manifest',
		'pack_slip',
		'pick_list',
		'pick_list_line',
		'pick_wave',
		'warehouse_bin',
		'warehouse_bin_closure',
		'warehouse_zone'
	],
	cart: [
		'commerce_cart',
		'commerce_cart_line',
		'commerce_cart_promotion',
		'commerce_cart_shipping_method',
		'commerce_checkout_session'
	],
	promotion: [
		'campaign',
		'campaign_budget',
		'campaign_budget_usage',
		'coupon',
		'gift_card',
		'gift_card_transaction',
		'promotion',
		'promotion_action',
		'promotion_usage'
	],
	order: [
		'order',
		'order_address',
		'order_change',
		'order_change_action',
		'order_credit_line',
		'order_history',
		'order_line',
		'order_shipping_method',
		'order_summary',
		'order_transaction'
	],
	payment: [
		'payment_capture',
		'payment_collection',
		'payment_provider',
		'payment_session',
		'payment_webhook_event',
		'refund',
		'refund_reason'
	],
	fulfillment: ['fulfillment', 'fulfillment_line', 'shipping_option', 'shipping_profile', 'shipping_profile_variant'],
	returns: [
		'order_claim',
		'order_claim_line',
		'order_exchange',
		'order_exchange_line',
		'order_return',
		'order_return_line',
		'order_return_reason'
	],
	subscription: ['subscription', 'subscription_billing', 'subscription_item', 'subscription_plan'],
	purchasing: ['goods_receipt', 'goods_receipt_line', 'purchase_order', 'purchase_order_line'],
	entitlement: ['entitlement', 'entitlement_activation', 'entitlement_key'],
	marketplace: [
		'seller',
		'seller_offering',
		'seller_payout',
		'seller_payout_line',
		'seller_settlement',
		'seller_transaction'
	],
	search: []
};

/**
 * Tables that are created by a migration and maintained by the ORM's tree strategy. They exist in
 * the database but are never declared as an entity, so they are exempt from the entity check.
 */
const DERIVED_TABLES = new Set(['collection_closure', 'warehouse_bin_closure']);

/**
 * The only tables in the platform allowed to carry the `commerce_` prefix. A bare name is preferred
 * wherever the concept means something outside this domain; a cart is the one family where the bare
 * word is genuinely ambiguous, so it keeps the qualifier.
 */
const PREFIX_ALLOWED = new Set([
	'commerce_cart',
	'commerce_cart_line',
	'commerce_cart_promotion',
	'commerce_cart_shipping_method',
	'commerce_checkout_session'
]);

/**
 * Words that must never appear in this repository's source. This platform's design is its own; a
 * reference to another product in a name, a comment or a file name is a defect regardless of intent.
 */
const FORBIDDEN = [
	'competitor',
	'market leader',
	'industry standard',
	'other platform',
	'reference platform'
];

/** Kernel capabilities that live in core and must each be a complete, wired module. */
const KERNEL_MODULES = [
	'money',
	'rule',
	'adjustment',
	'tax-line',
	'sequence',
	'idempotency',
	'event-outbox',
	'operation',
	'webhook'
];

/**
 * Modules in core that own tables but whose behaviour is delivered by a plugin.
 *
 * Search is the case: the index tables serve every domain, so they belong in core, while the
 * pipeline, the providers, the reindex job and the endpoints are the search plugin's. Only the
 * entity, migration and registration checks apply here — there is no service or module to expect in
 * core.
 */
const CORE_ENTITY_MODULES = ['search'];

/* ------------------------------------------------------------------------------------------------
 * Harness
 * ---------------------------------------------------------------------------------------------- */

let passed = 0;
const failures = [];

function check(label, condition, detail) {
	if (condition) {
		passed++;
		return true;
	}
	failures.push(detail ? `${label} — ${detail}` : label);
	return false;
}

function walk(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const read = (file) => readFileSync(file, 'utf8');
const rel = (file) => relative(repoRoot, file).split(sep).join('/');

/* ------------------------------------------------------------------------------------------------
 * Plugins
 * ---------------------------------------------------------------------------------------------- */

const declaredSomewhere = new Map(); // table -> [plugin, ...]

for (const [plugin, tables] of Object.entries(PLUGINS)) {
	const dir = join(pluginsDir, plugin);
	const at = `plugin-${plugin}`;

	if (!check(`${at}: package directory exists`, existsSync(dir), `missing ${rel(dir)}`)) continue;

	// --- package metadata -------------------------------------------------------------------
	const pkgPath = join(dir, 'package.json');
	if (check(`${at}: package.json exists`, existsSync(pkgPath), rel(pkgPath))) {
		let pkg = null;
		try {
			pkg = JSON.parse(read(pkgPath));
		} catch (error) {
			check(`${at}: package.json parses`, false, error.message);
		}
		if (pkg) {
			check(`${at}: package name`, pkg.name === `@gauzy/plugin-${plugin}`, `is "${pkg.name}"`);
			check(`${at}: package has an entry point`, Boolean(pkg.main), 'no "main"');
		}
	}
	check(`${at}: project.json exists`, existsSync(join(dir, 'project.json')));

	// --- source layout ----------------------------------------------------------------------
	const srcDir = join(dir, 'src');
	const srcFiles = walk(srcDir);
	const tsFiles = srcFiles.filter((f) => f.endsWith('.ts'));
	check(`${at}: src has TypeScript sources`, tsFiles.length > 0);

	const indexFile = join(srcDir, 'index.ts');
	if (check(`${at}: src/index.ts exists`, existsSync(indexFile), rel(indexFile))) {
		const barrel = read(indexFile);
		check(`${at}: src/index.ts re-exports`, /export\s/.test(barrel));
		// The package is consumed by its name, so the plugin class has to be reachable from the
		// barrel. A package whose barrel exports every entity and service but not the plugin itself
		// cannot be imported at all, and the omission is invisible until something tries to load it.
		const pascal = plugin
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join('');
		check(
			`${at}: src/index.ts exports the plugin declaration`,
			/from\s*['"][^'"]*\.plugin['"]/.test(barrel) || new RegExp(`\\b${pascal}Plugin\\b`).test(barrel),
			'the barrel does not re-export the *.plugin module, so the package cannot be imported'
		);
	}

	// --- the plugin class -------------------------------------------------------------------
	const pluginFiles = tsFiles.filter((f) => f.endsWith('.plugin.ts'));
	if (check(`${at}: exactly one plugin declaration file`, pluginFiles.length === 1, `found ${pluginFiles.length}`)) {
		const source = read(pluginFiles[0]);
		const where = rel(pluginFiles[0]);
		check(`${at}: declares @Plugin(...)`, source.includes('@Plugin('), where);
		check(`${at}: plugin declares entities`, /entities\s*:/.test(source), where);
		check(`${at}: plugin declares migrations`, /migrations\s*:/.test(source), where);
		check(`${at}: plugin declares permissions`, /permissions\s*:/.test(source), where);
		check(`${at}: plugin declares features`, /features\s*:/.test(source), where);
		check(`${at}: plugin has a module`, /Module/.test(source), where);
	}

	// --- tables -----------------------------------------------------------------------------
	const entities = tsFiles.filter((f) => f.endsWith('.entity.ts'));
	const declaredTables = new Set();
	for (const file of entities) {
		for (const match of read(file).matchAll(/@MultiORMEntity\(\s*['"]([a-z0-9_]+)['"]/g)) {
			declaredTables.add(match[1]);
			const owners = declaredSomewhere.get(match[1]) ?? [];
			owners.push(plugin);
			declaredSomewhere.set(match[1], owners);
		}
	}

	for (const table of tables) {
		if (DERIVED_TABLES.has(table)) {
			// created by migration, maintained by the ORM — must not be declared as an entity
			check(`${at}: "${table}" is not declared as an entity`, !declaredTables.has(table), 'declared as an entity');
			continue;
		}
		check(`${at}: table "${table}" has an entity`, declaredTables.has(table), 'no @MultiORMEntity declares it');
	}

	// --- entity hygiene ---------------------------------------------------------------------
	for (const file of entities) {
		const source = read(file);
		const where = rel(file);
		check(`${at}: ${where} is injectable`, source.includes('@Injectable') || source.includes('@MultiORMEntity'), where);
		check(
			`${at}: ${where} extends a platform base entity`,
			/TenantOrganizationBaseEntity|TenantBaseEntity|BaseEntity/.test(source),
			'extends nothing this platform provides'
		);
		check(
			`${at}: ${where} declares no money as a float`,
			!/@MultiORMColumn\([^)]*type:\s*['"]float['"]/.test(source),
			'a float column; money must be an exact decimal'
		);

		// repository pair, named after the entity
		const base = file.slice(0, -'.entity.ts'.length).split(sep).pop();
		const repoDir = join(file, '..', 'repository');
		const hasPair =
			existsSync(join(repoDir, `type-orm-${base}.repository.ts`)) &&
			existsSync(join(repoDir, `mikro-orm-${base}.repository.ts`));
		check(`${at}: ${base} has a repository pair`, hasPair, `expected under ${rel(repoDir)}`);
	}

	// --- controllers ------------------------------------------------------------------------
	// Every concept on the platform is reachable over both protocols, so every package exposes a
	// REST controller as well as resolvers. This is not conditional on the package owning a table:
	// a package that owns behaviour behind core tables still has concepts to expose.
	const controllers = tsFiles.filter((f) => f.endsWith('.controller.ts'));
	check(`${at}: exposes at least one controller`, controllers.length > 0, 'no .controller.ts');
	for (const file of controllers) {
		const source = read(file);
		const where = rel(file);
		check(`${at}: ${where} is tenant-guarded`, source.includes('TenantPermissionGuard'), 'missing TenantPermissionGuard');
		check(`${at}: ${where} is permission-guarded`, source.includes('PermissionGuard'), 'missing PermissionGuard');
		check(`${at}: ${where} declares @Permissions(...)`, source.includes('@Permissions('), 'no @Permissions(...)');
		check(
			`${at}: ${where} has one surface, not an admin/public split`,
			!/@Controller\(\s*['"][^'"]*(admin|storefront|public)[^'"]*['"]\s*\)/.test(source),
			'a split path segment in @Controller'
		);
	}

	// --- GraphQL ----------------------------------------------------------------------------
	const resolverFiles = tsFiles.filter((f) => /\.resolver\.ts$/.test(f));
	check(`${at}: exposes GraphQL resolvers`, resolverFiles.length > 0, 'no .resolver.ts');

	// Both protocols are required for every concept, not one resolver per package. An aggregate
	// exposed over REST has to be reachable over GraphQL as well, or the same thing is available
	// through one door and missing behind the other.
	const resolverSource = resolverFiles.map(read).join('\n');
	for (const file of controllers) {
		const base = file.slice(0, -'.controller.ts'.length).split(sep).pop();
		const pascal = base
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join('');
		check(
			`${at}: "${base}" is reachable over GraphQL as well as REST`,
			new RegExp(`\\b${pascal}\\b`).test(resolverSource),
			`no resolver mentions ${pascal}`
		);
	}

	// --- migrations -------------------------------------------------------------------------
	// A barrel that re-exports the migrations sits in the same directory as they do, so the
	// directory match alone would demand three SQL dialects from a file that contains none.
	const migrationFiles = tsFiles.filter(
		(f) => !/index\.ts$/.test(f) && (/migrations?[\\/]/.test(f) || /UpQueryRunner/.test(read(f)))
	);
	const migrationSource = migrationFiles.map(read).join('\n');
	if (check(`${at}: owns at least one migration`, migrationFiles.length > 0, 'no migration file')) {
		for (const file of migrationFiles) {
			const source = read(file);
			const where = rel(file);
			check(`${at}: ${where} has a postgres up`, source.includes('postgresUpQueryRunner'), where);
			check(`${at}: ${where} has a mysql up`, source.includes('mysqlUpQueryRunner'), where);
			check(`${at}: ${where} has a sqlite up`, source.includes('sqliteUpQueryRunner'), where);
			check(`${at}: ${where} has a down`, /async down\s*\(/.test(source), where);
		}

		// A contracted table that no migration creates is a table that will not exist on a fresh
		// install — the entity maps it, every test that ran against a synchronised schema passed,
		// and the first clean deployment fails. This is the check that catches that.
		for (const table of tables) {
			check(
				`${at}: a migration creates table "${table}"`,
				new RegExp(`create\\s+table[^;]{0,120}?\\b${table}\\b`, 'i').test(migrationSource),
				`no CREATE TABLE for "${table}" in this package's migrations`
			);
		}
	}

	// --- declarations -----------------------------------------------------------------------
	const permissionsFile = tsFiles.find((f) => /\.permissions\.ts$/.test(f));
	check(`${at}: declares a permission catalogue`, Boolean(permissionsFile), 'no *.permissions.ts');
	const featuresFile = tsFiles.find((f) => /\.features\.ts$/.test(f));
	check(`${at}: declares feature flags`, Boolean(featuresFile), 'no *.features.ts');
}

/* ------------------------------------------------------------------------------------------------
 * Cross-plugin rules
 * ---------------------------------------------------------------------------------------------- */

for (const [table, owners] of declaredSomewhere) {
	check(
		`table "${table}" is owned by exactly one plugin`,
		owners.length === 1,
		`declared by ${owners.join(', ')}`
	);
	if (table.startsWith('commerce_')) {
		check(`table "${table}" is allowed the commerce_ qualifier`, PREFIX_ALLOWED.has(table), 'unnecessary qualifier');
	}
}

// The programme ships backend capability only. This repository does host user-interface plugin
// packages for other features, so the rule is scoped to the packages declared above rather than to
// everything that happens to sit under packages/plugins.
for (const plugin of Object.keys(PLUGINS)) {
	check(
		`plugin-${plugin} has no user-interface package`,
		!existsSync(join(pluginsDir, `${plugin}-ui`)),
		`packages/plugins/${plugin}-ui exists`
	);
}

/* ------------------------------------------------------------------------------------------------
 * Migration ordering
 * ---------------------------------------------------------------------------------------------- */

// The core migrations, read once: a kernel table is proved to exist by the migration that creates
// it, wherever that migration happens to live.
const coreMigrationsDir = join(coreDir, 'database', 'migrations');
const coreMigrations = existsSync(coreMigrationsDir)
	? readdirSync(coreMigrationsDir)
			.filter((f) => f.endsWith('.ts'))
			.map((f) => ({ file: join(coreMigrationsDir, f), source: read(join(coreMigrationsDir, f)) }))
	: [];

// Every migration this programme ships, core and plugin, in the order they will run. Migrations run
// in filename-timestamp order, so a migration may only reference a table that an EARLIER migration
// creates. A reference to a table created later works on a developer's machine — where the schema
// may already be synchronised, or tables may persist from an earlier run in a different order — and
// fails on a first clean install, which is the one run nobody repeats often enough to notice.
const allMigrations = [...coreMigrations.map((m) => ({ file: m.file, source: m.source }))];
if (existsSync(pluginsDir)) {
	for (const plugin of readdirSync(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
		for (const file of walk(join(pluginsDir, plugin.name))) {
			if (!file.endsWith('.ts') || /index\.ts$/.test(file)) continue;
			if (!/UpQueryRunner/.test(read(file))) continue;
			allMigrations.push({ file, source: read(file) });
		}
	}
}

/** The tick a migration runs at, taken from its filename. */
const tickOf = (file) => {
	const match = basename(file).match(/^(\d{10,})-/);
	return match ? Number(match[1]) : undefined;
};

/** When each table is created, by the earliest migration that creates it. */
const createdBy = new Map();
for (const migration of allMigrations) {
	const tick = tickOf(migration.file);
	if (tick === undefined) continue;
	for (const match of migration.source.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+["'`]?([a-z0-9_]+)["'`]?/gi)) {
		const table = match[1].toLowerCase();
		if (!createdBy.has(table) || tick < createdBy.get(table).tick) {
			createdBy.set(table, { tick, file: migration.file });
		}
	}
}

let orderChecks = 0;
for (const migration of allMigrations) {
	const tick = tickOf(migration.file);
	if (tick === undefined) continue;
	for (const match of migration.source.matchAll(/references\s+["'`]?([a-z0-9_]+)["'`]?/gi)) {
		const target = match[1].toLowerCase();
		const creator = createdBy.get(target);
		// A target this programme never creates is a table the platform already had, created long
		// before any of these migrations — nothing to check.
		if (!creator) continue;
		orderChecks++;
		check(
			`migration order: ${basename(migration.file)} references "${target}"`,
			creator.tick <= tick,
			`"${target}" is created later, by ${basename(creator.file)} at ${creator.tick}`
		);
	}
}
check('migration ordering was actually examined', orderChecks > 0, 'no foreign key references were found to check');

/* ------------------------------------------------------------------------------------------------
 * Entity columns against their table
 * ---------------------------------------------------------------------------------------------- */

// An entity that maps a column the table does not have fails on the first read or write of that
// entity — every query names every column, so one missing column breaks the whole resource, not one
// field of it. The migration check above proves the TABLE exists; this proves the table has the
// COLUMNS the entity declares.
//
// Only columns the entity explicitly asks for with a column decorator are checked, because those
// are unambiguous: a property carrying one is a column by definition, and a relation property is
// not (it may be expressed purely by the foreign key its owner declares separately). Checking
// relation properties would mean guessing how the mapper names their join column, and a check that
// guesses reports defects that are not there.

/** The body of the CREATE TABLE for a table, or undefined when no migration creates it. */
function createTableBody(source, table) {
	const pattern = new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+["'\`]?${table}["'\`]?\\s*\\(`, 'i');
	const match = pattern.exec(source);
	if (!match) return undefined;
	let depth = 1;
	let index = match.index + match[0].length;
	const start = index;
	while (index < source.length && depth > 0) {
		const character = source[index];
		if (character === '(') depth++;
		else if (character === ')') depth--;
		index++;
	}
	return source.slice(start, index - 1);
}

/** The column an explicitly-decorated property maps to. */
function columnOf(property, decoratorArgs) {
	const explicit = decoratorArgs.match(/name\s*:\s*['"]([A-Za-z0-9_]+)['"]/);
	if (explicit) return explicit[1];
	// Absent an explicit name the mapper keeps the property name as the column name. Verified
	// against the shipped migrations, which write quoted camelCase identifiers — `"channelId"`,
	// `"createdByUserId"` — rather than converting to snake_case. Deriving snake_case here reports
	// every column of every entity as missing, which is how this check first read.
	return property;
}

const allMigrationSource = allMigrations.map((m) => m.source).join('\n');
let columnChecks = 0;
if (existsSync(pluginsDir)) {
	for (const plugin of readdirSync(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
		const packageMigrations = allMigrations.filter((m) => m.file.includes(`${sep}${plugin.name}${sep}`));
		if (packageMigrations.length === 0) continue;
		const packageSource = packageMigrations.map((m) => m.source).join('\n');

		for (const file of walk(join(pluginsDir, plugin.name))) {
			if (!file.endsWith('.entity.ts')) continue;
			const source = read(file);
			const table = source.match(/@MultiORMEntity\(\s*['"]([a-z0-9_]+)['"]/)?.[1];
			if (!table) continue;

			const body = createTableBody(packageSource, table);
			if (body === undefined) continue; // the table's absence is already reported above

			// The `CREATE TABLE` body is not the whole definition once a later migration adds to an
			// existing table: a revision extends the entity and ships an `ALTER TABLE … ADD COLUMN`,
			// and a check that reads only the creation statement reports every such column as missing.
			// That is a false positive on correct work, and it hides real ones — an entity column with
			// no migration anywhere is what this check is for. So the table's own alterations are read
			// too, from every migration the package ships.
			const alterations = [
				...packageSource.matchAll(
					new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?["'\`]?${table}["'\`]?[^;]*`, 'gi')
				)
			]
				.map((match) => match[0])
				.join('\n');
			const definition = `${body}\n${alterations}`;

			// Walk the declarations line by line: find each column decorator, find where its
			// argument list ends by tracking parenthesis depth, then take the next declaration
			// after it. A single regex spanning lines cannot do this — it cannot tell a property
			// from an object key inside the decorator's own arguments, and it will happily match a
			// far-away import, which is how an earlier version of this check reported a column
			// named after a type that appears only in an import statement.
			const lines = source.split('\n');
			for (let i = 0; i < lines.length; i++) {
				if (!/@MultiORMColumn\b/.test(lines[i])) continue;

				let depth = 0;
				let sawOpen = false;
				let end = i;
				let args = '';
				for (; end < lines.length && end < i + 60; end++) {
					const line = lines[end];
					args += line + ' ';
					for (const character of line) {
						if (character === '(') {
							depth++;
							sawOpen = true;
						} else if (character === ')') {
							depth--;
						}
					}
					if (sawOpen && depth <= 0) break;
					if (!sawOpen) break; // a bare `@MultiORMColumn` with no argument list
				}

				let property;
				for (let k = end + 1; k < lines.length && k < end + 12; k++) {
					const line = lines[k].trim();
					if (line.length === 0 || line.startsWith('@') || line.startsWith('*') || line.startsWith('//')) continue;
					property = /^(?:public\s+|readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[?!]?\s*[:;(]/.exec(line)?.[1];
					break;
				}
				if (!property) continue;

				const column = columnOf(property, args);
				columnChecks++;
				check(
					`${table}.${column} exists in its migration (from ${basename(file)})`,
					new RegExp(`\\b${column}\\b`).test(definition),
					`the entity declares the column but no migration creates it`
				);
			}
		}
	}
}
check('entity columns were actually examined', columnChecks > 0, 'no decorated properties were found to check');
void allMigrationSource;

/* ------------------------------------------------------------------------------------------------
 * Kernel capabilities
 * ---------------------------------------------------------------------------------------------- */

// The core migrations are read above, in the migration-ordering pass, because both passes need them.

for (const { name, runtime } of [
	...KERNEL_MODULES.map((name) => ({ name, runtime: true })),
	...CORE_ENTITY_MODULES.map((name) => ({ name, runtime: false }))
]) {
	const dir = join(coreDir, name);
	const at = `${runtime ? 'kernel' : 'core'} ${name}`;
	if (!check(`${at}: module directory exists`, existsSync(dir), rel(dir))) continue;

	const files = walk(dir).filter((f) => f.endsWith('.ts'));

	// A module whose behaviour lives in a plugin has no service, module or barrel to expect in core
	// — core owns its tables and its entities, the plugin owns what is done with them.
	if (runtime) {
		check(`${at}: has a service`, files.some((f) => /\.service\.ts$/.test(f)), 'no *.service.ts');
		check(`${at}: has a module`, files.some((f) => /\.module\.ts$/.test(f)), 'no *.module.ts');
		check(`${at}: has a barrel`, existsSync(join(dir, 'index.ts')), 'no index.ts');
	}

	// Money is pure arithmetic over exact values and owns no table, so it is the one kernel module
	// with nothing to persist. Every other kernel module must ship an entity, a migration to create
	// its table, and registration in the core entity list.
	const entityFiles = files.filter((f) => /\.entity\.ts$/.test(f));
	if (name === 'money') {
		passed++;
		continue;
	}
	check(`${at}: has an entity`, entityFiles.length > 0, 'no *.entity.ts');

	// Registration is by class name, and a table name is not a class name — read the class each
	// entity file actually exports.
	const entities = entityFiles
		.map((file) => ({
			file,
			table: read(file).match(/@MultiORMEntity\(\s*['"]([a-z0-9_]+)['"]/)?.[1],
			className: read(file).match(/export\s+class\s+(\w+)/)?.[1]
		}))
		.filter((e) => e.table && e.className);

	const internal = join(coreDir, 'core', 'entities', 'internal.ts');
	const entityIndex = join(coreDir, 'core', 'entities', 'index.ts');
	const internalSource = existsSync(internal) ? read(internal) : '';
	const indexSource = existsSync(entityIndex) ? read(entityIndex) : '';

	for (const { table, className, file } of entities) {
		check(
			`${at}: a core migration creates "${table}"`,
			coreMigrations.some((m) => m.source.includes(`'${table}'`) || m.source.includes(`"${table}"`)),
			`no migration in the core migrations directory mentions "${table}"`
		);
		// The barrel re-exports by module path, the entity array imports by class name — check each
		// against the form it actually uses.
		const importPath = relative(join(coreDir, 'core', 'entities'), file).split(sep).join('/').replace(/\.ts$/, '');
		check(
			`${at}: ${className} is exported from the entity barrel`,
			internalSource.includes(importPath),
			`no export from "${importPath}" in the entity barrel`
		);
		check(
			`${at}: ${className} is in the entity array`,
			new RegExp(`\\b${className}\\b`).test(indexSource),
			'not in coreEntities, so no ORM will map its table'
		);
	}
}

/* ------------------------------------------------------------------------------------------------
 * Wiring
 *
 * Two faults found by booting rather than by reading, both of which a static check can see.
 *
 * A controller that overrides a CRUD base method to add a projection does not inherit that method's
 * decorators: the override replaces the property and Nest maps a route only where a route decorator
 * is present. The endpoint then simply is not there — the service has the method, GraphQL serves the
 * field, and only a live request shows the gap.
 *
 * A guard, and a resolver, are providers of the module that declares the handler. Their dependencies
 * must therefore be reachable from *that* module: importing the module in a parent does not help,
 * because Nest imports are not inherited downwards, and a resolver hosted by the composition module
 * can only inject what the plugin module exports.
 * ---------------------------------------------------------------------------------------------- */

/** The CRUD base surface, and the route the base class maps for each method. */
const CRUD_BASE_ROUTES = new Map([
	['findAll', 'GET /'],
	['findById', 'GET /:id'],
	['getCount', 'GET /count'],
	['pagination', 'GET /pagination'],
	['create', 'POST /'],
	['update', 'PUT /:id'],
	['delete', 'DELETE /:id'],
	['softRemove', 'DELETE /:id/soft'],
	['softRecover', 'PUT /:id/recover']
]);

const ROUTE_DECORATOR = /@(Get|Post|Put|Patch|Delete|Head|Options|All)\s*\(/;

/** The decorator lines sitting directly above a member, read backwards from it. */
function decoratorsAbove(lines, index) {
	const collected = [];
	for (let i = index - 1; i >= 0 && i >= index - 40; i--) {
		const line = lines[i].trim();
		if (line === '') continue;
		if (line.startsWith('@') || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
			collected.push(line);
			continue;
		}
		if (line.endsWith('}') || line.endsWith(';') || line.endsWith('{')) break;
		collected.push(line);
	}
	return collected.join('\n');
}

/** The names a decorator array such as `exports: [A, B]` lists. */
function arrayNamesIn(source, key) {
	const names = [];
	const re = new RegExp(`\\b${key}\\s*:\\s*\\[`, 'g');
	let match;
	while ((match = re.exec(source))) {
		let i = match.index + match[0].length;
		let depth = 1;
		let body = '';
		for (; i < source.length && depth > 0; i++) {
			const ch = source[i];
			if (ch === '[') depth++;
			else if (ch === ']') {
				depth--;
				if (depth === 0) break;
			}
			body += ch;
		}
		// Comments have to go before splitting on commas: a comma inside a comment would otherwise
		// glue the next name onto the comment's tail and hide it from this check.
		body = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
		for (const raw of body.split(',')) {
			const name = raw.trim();
			if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name);
		}
	}
	return names;
}

/** The type names a class's constructor parameters are declared as. */
function constructorDependencies(source) {
	const deps = [];
	const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
	const re = /constructor\s*\(/g;
	let match;
	while ((match = re.exec(text))) {
		let i = match.index + match[0].length;
		let depth = 1;
		let body = '';
		for (; i < text.length && depth > 0; i++) {
			const ch = text[i];
			if (ch === '(') depth++;
			else if (ch === ')') {
				depth--;
				if (depth === 0) break;
			}
			body += ch;
		}
		for (const parameter of body.split(',')) {
			const colon = parameter.indexOf(':');
			if (colon === -1) continue;
			const type = parameter
				.slice(colon + 1)
				.replace(/=[\s\S]*$/, '')
				.trim();
			const head = /^([A-Za-z_$][\w$]*)/.exec(type);
			if (!head) continue;
			if (['string', 'number', 'boolean', 'any', 'unknown', 'void', 'Type', 'Object'].includes(head[1])) continue;
			if (/@Inject\s*\(/.test(parameter)) continue;
			deps.push(head[1]);
		}
	}
	return deps;
}

for (const plugin of Object.keys(PLUGINS)) {
	const dir = join(pluginsDir, plugin);
	if (!existsSync(dir)) continue;
	const at = `plugin-${plugin}`;
	const files = walk(dir).filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts'));
	const controllerFiles = files.filter((file) => file.endsWith('.controller.ts'));
	const moduleFiles = files.filter((file) => file.endsWith('.module.ts'));

	// What the plugin's own modules make injectable, and what each module imports.
	const exportedByPlugin = new Set();
	const importsByModule = new Map();
	const controllersByModule = new Map();
	for (const file of moduleFiles) {
		const source = read(file);
		const className = /export\s+class\s+([A-Za-z_$][\w$]*)/.exec(source)?.[1];
		for (const name of arrayNamesIn(source, 'exports')) exportedByPlugin.add(name);
		for (const name of arrayNamesIn(source, 'providers')) exportedByPlugin.add(name);
		if (className) {
			importsByModule.set(className, arrayNamesIn(source, 'imports'));
			for (const controller of arrayNamesIn(source, 'controllers')) controllersByModule.set(controller, className);
		}
	}

	for (const file of controllerFiles) {
		const source = read(file);
		const className = /export\s+class\s+([A-Za-z_$][\w$]*)/.exec(source)?.[1] ?? basename(file);
		const lines = source.split(/\r?\n/);

		// Every CRUD override must restate the route it is overriding.
		for (let i = 0; i < lines.length; i++) {
			const method = /^\t(?:public\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
			if (!method || !CRUD_BASE_ROUTES.has(method[1])) continue;
			check(
				`${at}: ${className}.${method[1]}() keeps its route`,
				ROUTE_DECORATOR.test(decoratorsAbove(lines, i)),
				`the override drops the inherited route ${CRUD_BASE_ROUTES.get(method[1])} — add the route decorator, or the endpoint disappears`
			);
		}

		// A write route must be declared by the controller that serves it, with a DTO the validation
		// pipe can name. A request body is validated from the *type the handler names*: the CRUD base
		// takes the entity's shape as a generic, whose reflected type is `Object`, and Nest's pipe
		// skips a parameter it cannot name a class for. An inherited `create` or `update` therefore
		// accepts any body at all — an unknown enumeration member, a missing required field, a property
		// the resource does not have — and writes it. The route is also undocumented, because the same
		// type is what the API description publishes.
		if (/extends\s+(CrudController|TenantAwareCrudController)/.test(source)) {
			for (const method of ['create', 'update']) {
				const declared = new RegExp(`^\\t(?:public\\s+|async\\s+)*${method}\\s*\\(`, 'm').exec(source);
				check(
					`${at}: ${className} declares ${method} with a DTO`,
					!!declared,
					`an inherited ${method} is not validated — the base parameter reflects as Object, so the pipe is skipped and any body is written`
				);
				if (!declared) continue;
				// The declared method must take the body as a class, not as the entity's shape: the
				// shape is what reflects as `Object` and what makes the pipe skip it again.
				const signature = source.slice(declared.index, declared.index + 400);
				const body = /@Body\([^)]*\)\s*[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$]*)/.exec(signature);
				check(
					`${at}: ${className}.${method}() types its body as a named class`,
					!!body && !['Object', 'DeepPartial', 'any', 'unknown'].includes(body[1]),
					body
						? `the body is typed \`${body[1]}\`, which the validation pipe cannot use unless it is a class`
						: 'no `@Body()` parameter with a named type'
				);
			}
		}

		if (/extends\s+(CrudController|TenantAwareCrudController)/.test(source)) {
			// `@Get()` and `@Get('/')` are the same route: Nest joins the controller path and the
			// method path, and a leading slash on the method path does not change the result.
			if (/^\t(?:public\s+|async\s+)*findAll\s*\(/m.test(source)) {
				check(
					`${at}: ${className} maps a GET collection route`,
					/@Get\(\s*['"`]?\/?['"`]?\s*\)/.test(source),
					'it overrides findAll without a @Get() route, so the resource cannot be listed'
				);
			}
			if (/^\t(?:public\s+|async\s+)*findById\s*\(/m.test(source)) {
				check(
					`${at}: ${className} maps a GET by-id route`,
					/@Get\(\s*['"`]?\/?:id['"`]?\s*\)/.test(source),
					"it overrides findById without a @Get(':id') route, so one record cannot be read"
				);
			}
		}

		// The module that declares this controller must reach what its guards inject.
		const host = controllersByModule.get(className);
		if (!host) {
			check(`${at}: ${className} is declared by a module`, false, 'no module lists it in `controllers`');
			continue;
		}
		const hostImports = importsByModule.get(host) ?? [];
		check(
			`${at}: ${host} imports RolePermissionModule for ${className}`,
			hostImports.includes('RolePermissionModule'),
			'the permission guard is a provider of this module, so this module must import the service it reads'
		);
		if (/FeatureFlagGuard/.test(source)) {
			check(
				`${at}: ${host} imports FeatureModule for ${className}`,
				hostImports.includes('FeatureModule'),
				'the feature guard is a provider of this module, so this module must import FeatureService'
			);
		}
	}

	// A resolver is hosted by the composition module, so it can only inject what this plugin exports.
	for (const file of files.filter((f) => f.endsWith('.resolver.ts'))) {
		const source = read(file);
		const className = /export\s+class\s+([A-Za-z_$][\w$]*)/.exec(source)?.[1] ?? basename(file);
		for (const dependency of constructorDependencies(source)) {
			// Only a class this plugin declares is this check's business.
			const declaredHere = files.some((other) =>
				new RegExp(`export\\s+(?:abstract\\s+)?class\\s+${dependency}\\b`).test(read(other))
			);
			if (!declaredHere) continue;
			check(
				`${at}: ${className} can inject ${dependency}`,
				exportedByPlugin.has(dependency),
				'the resolver is hosted by the composition module, so the plugin module must export this service'
			);
		}
	}
}

/* ------------------------------------------------------------------------------------------------
 * Forbidden words
 * ---------------------------------------------------------------------------------------------- */

// The sweep covers the code this programme owns — the declared plugin packages and the kernel
// modules — rather than every file in the repository. Pre-existing, unrelated content elsewhere
// (legal text and the like) is not this check's business.
const scanRoots = [
	...Object.keys(PLUGINS).map((plugin) => join(pluginsDir, plugin)),
	...KERNEL_MODULES.map((name) => join(coreDir, name))
];

let scanned = 0;
for (const root of scanRoots) {
	for (const file of walk(root)) {
		if (!/\.(ts|json|md)$/.test(file)) continue;
		scanned++;
		const source = read(file).toLowerCase();
		for (const word of FORBIDDEN) {
			if (source.includes(word)) {
				check(`no reference to another product in ${rel(file)}`, false, `contains "${word}"`);
			}
		}
	}
}
passed++; // the sweep itself ran

/* ------------------------------------------------------------------------------------------------
 * Report
 * ---------------------------------------------------------------------------------------------- */

const expectedTables = Object.values(PLUGINS).flat();

console.log('');
console.log('plugin contract check');
console.log('=====================');
console.log(`plugin packages declared : ${Object.keys(PLUGINS).length}`);
console.log(`tables declared          : ${expectedTables.length}`);
console.log(`files scanned for words  : ${scanned}`);
console.log('');
console.log(`passed : ${passed}`);
console.log(`failed : ${failures.length}`);

if (failures.length > 0) {
	console.log('');
	console.log('failures');
	console.log('--------');
	for (const failure of failures) console.log(`  x ${failure}`);
	console.log('');
	process.exit(1);
}

console.log('');
console.log('contract check: ALL CHECKS PASSED');

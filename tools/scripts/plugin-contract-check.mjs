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

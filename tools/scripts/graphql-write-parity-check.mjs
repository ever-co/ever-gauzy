#!/usr/bin/env node
/**
 * Gate: every CRUD resource that serves the soft-delete/recover pair must answer it over GraphQL.
 *
 * `17-graphql-api-specification.md` §3.1 requires capability parity between the two protocols, and names this
 * pair explicitly — *"one mutation per REST write route, including the `DELETE /:id/soft` and `PUT /:id/recover`
 * routes inherited from `CrudController<T>`"* — while §3.4, the list of capabilities deliberately left out of
 * GraphQL, does not mention it.
 *
 * A controller inherits both routes the moment it extends `CrudController<T>`, whether or not it declares them,
 * and most of this tree's controllers **override** them purely to attach a permission. So a resource can serve a
 * gated withdraw/restore pair over REST while no resolver declares either field, and nothing in the routine says
 * so: `nx test <project>` passes, the build passes, the API boots, and the composed schema is a schema — a field
 * that was never declared fails nothing. That is how the plugin tree came to serve the pair on ninety-six
 * controllers with **zero** resolvers declaring either field, found only by an audit rather than by a gate.
 *
 * The check is deliberately narrow rather than clever. It does not try to match every REST route to a field by
 * name — that heuristic reports hundreds of false positives, because child resources are managed through their
 * parents and pivots through purpose-named fields. It checks the one relation the specification states exactly and
 * the naming convention states exactly: a `CrudController<T>` that overrides `softRemove` or `softRecover` must
 * have `softDelete<T>` and `recover<T>` somewhere in its unit's resolvers.
 *
 * **The baseline below is the work the gate found, not an exemption from the rule.** It is a measured list, and a
 * wave that delivers a resource's pair deletes that resource's row — the same shape as the `withDeleted`
 * baselines, which shrank the same way. A new resource arriving without its pair has no row and fails.
 *
 * Run from the repository root: `node tools/scripts/graphql-write-parity-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Where a unit is a directory holding one domain's controllers and resolvers. */
const ROOTS = [
	{ label: 'plugins', directory: join(ROOT, 'packages', 'plugins') },
	{ label: 'core', directory: join(ROOT, 'packages', 'core', 'src', 'lib') }
];

/**
 * Resources that serve the pair and answer neither field over GraphQL, by unit.
 *
 * Each entry is `{ unit: [resources] }`, and every unit here is a wave that has not landed yet — the plugin tree
 * implements the pair for four of its ninety-six CRUD controllers so far (`Seller`, `PriceList`, `Promotion` and
 * `PurchaseOrder`). The list is the backlog, and it is expected to shrink to nothing.
 */
const OUTSTANDING = {

};

/** Every file under a directory whose name ends with a suffix, skipping build output. */
function walk(directory, suffix, found = []) {
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === 'dist') continue;

		const path = join(directory, entry);

		if (statSync(path).isDirectory()) {
			walk(path, suffix, found);
		} else if (entry.endsWith(suffix)) {
			found.push(path);
		}
	}

	return found;
}

/** The directory names under a root, which are the units. */
function unitsOf(directory) {
	return readdirSync(directory).filter((entry) => {
		try {
			return statSync(join(directory, entry)).isDirectory() && !['node_modules', 'dist'].includes(entry);
		} catch {
			return false;
		}
	});
}

/** The root fields a resolver declares, in either the string or the code-first form. */
function declaredFields(file) {
	const source = readFileSync(file, 'utf8');
	const names = new Set();

	for (const match of source.matchAll(/@(?:Query|Mutation)\(\s*'([^']+)'/g)) {
		names.add(match[1]);
	}

	for (const match of source.matchAll(/@(?:Query|Mutation)\([\s\S]{0,240}?name:\s*'([^']+)'/g)) {
		names.add(match[1]);
	}

	return names;
}

const failures = [];
const checked = { units: 0, resources: 0, answered: 0, outstanding: 0 };

for (const root of ROOTS) {
	for (const unit of unitsOf(root.directory)) {
		const directory = join(root.directory, unit);
		const resolvers = walk(directory, '.resolver.ts');

		// A unit with no GraphQL surface contributes no field and cannot answer the pair; the specification's
		// coverage table is scoped to the domains that have one.
		if (resolvers.length === 0) continue;

		checked.units += 1;

		const fields = new Set();
		for (const resolver of resolvers) {
			for (const field of declaredFields(resolver)) fields.add(field);
		}

		for (const controller of walk(directory, '.controller.ts')) {
			const source = readFileSync(controller, 'utf8');

			if (!/extends\s+(?:\w+)?CrudController</.test(source)) continue;

			// Only the controllers that state one of the two routes are in scope: an override is how a
			// controller says it means to gate the pair, and the pair is what this gate holds to parity.
			if (!/async\s+soft(?:Remove|Recover)\s*[(<]/.test(source)) continue;

			const resource = source.match(/export class (\w+?)Controller/)?.[1];
			if (!resource) continue;

			checked.resources += 1;

			const softDelete = `softDelete${resource}`;
			// The act has two names in this repository and both are correct. §10's table gives
			// `PUT /<resource>/:id/recover` the field name `restore<Type>`, while a hundred and eleven of the
			// delivered fields spell it `recover<Type>`; `restoreSeller` is the one that follows the table.
			// A gate that accepted only one spelling would fail the other, so it accepts either — the
			// divergence between the table and the surface is recorded in the specification, not settled here.
			const recovered = [`recover${resource}`, `restore${resource}`].find((name) => fields.has(name)) ?? null;

			if (fields.has(softDelete) && recovered) {
				checked.answered += 1;
				continue;
			}

			const listed = OUTSTANDING[`${root.label}/${unit}`]?.includes(resource) ?? false;
			const missing = [!fields.has(softDelete) ? softDelete : null, recovered ? null : `recover${resource}`].filter(Boolean);

			if (listed) {
				checked.outstanding += 1;
				continue;
			}

			failures.push(
				`${relative(ROOT, controller).replace(/\\/g, '/')} serves the soft-delete/recover pair, and ` +
					`${relative(ROOT, resolvers[0]).replace(/\\/g, '/').split('/').slice(0, -1).join('/')} declares ` +
					`neither ${missing.join(' nor ')}`
			);
		}
	}
}

// A baseline row for a resource that now answers the pair is a row that has been delivered, and leaving it
// would let the gate stop checking a resource that no longer needs the entry.
const stale = [];

for (const [unit, resources] of Object.entries(OUTSTANDING)) {
	const directory = ROOTS.map((root) => join(root.directory, unit.split('/').slice(1).join('/')))
		.find((candidate) => {
			try {
				return statSync(candidate).isDirectory();
			} catch {
				return false;
			}
		});

	if (!directory) {
		stale.push(`${unit} names a unit that no longer exists`);
		continue;
	}

	const fields = new Set();
	for (const resolver of walk(directory, '.resolver.ts')) {
		for (const field of declaredFields(resolver)) fields.add(field);
	}

	for (const resource of resources) {
		const recovered = [`recover${resource}`, `restore${resource}`].some((name) => fields.has(name));

		if (fields.has(`softDelete${resource}`) && recovered) {
			stale.push(`${unit}: ${resource} now answers the pair, so its baseline row is delivered`);
		}
	}
}

if (failures.length > 0) {
	console.error('FAILED — CRUD resources serving the soft-delete/recover pair without a GraphQL counterpart:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('§3.1 requires one mutation per REST write route, including the pair `CrudController<T>`');
	console.error('contributes. Add `softDelete<Resource>` and `recover<Resource>` beside the resource’s other');
	console.error('mutations, each calling the service method its route calls and stating its route’s permission —');
	console.error('or add the resource to OUTSTANDING in this file, which is the backlog, not an exemption.');
	process.exit(1);
}

if (stale.length > 0) {
	console.error('FAILED — the baseline in this file no longer matches the tree:');
	for (const entry of stale) console.error(`  ${entry}`);
	console.error('');
	console.error('Delete the delivered rows so the backlog stays a measurement.');
	process.exit(1);
}

console.log(
	`PASSED — ${checked.resources} CRUD resource(s) across ${checked.units} unit(s): ${checked.answered} answer the ` +
		`soft-delete/recover pair over GraphQL and ${checked.outstanding} are listed in this file as outstanding.`
);

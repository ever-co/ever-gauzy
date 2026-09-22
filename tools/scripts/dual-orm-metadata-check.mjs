#!/usr/bin/env node
/**
 * Gate: every entity must be one MikroORM can build metadata for.
 *
 * This workspace is dual-ORM — `DB_ORM=typeorm` (the default) and `DB_ORM=mikro-orm` — and entity metadata is
 * written once for both. TypeORM is the permissive one, so a mapping it accepts can be one MikroORM refuses
 * outright, and the refusal is a **boot failure**, not a runtime error: `MetadataError` is raised during
 * discovery and the application never starts. Nothing on the default path can see that, so the only way to keep
 * the two in step is to check the shapes MikroORM rejects, statically.
 *
 * Each check below is one that was found by actually starting the API on `DB_ORM=mikro-orm` and reading the
 * error, and each reports the first offender only — MikroORM stops at the first — so a scan is what turns
 * one-at-a-time discovery into a list:
 *
 *   1. **A column that duplicates a relation's field name.** An entity may declare a foreign key twice (a
 *      relation property and a scalar beside it); TypeORM maps both to one column, MikroORM refuses
 *      (`Duplicate fieldNames are not allowed`). The kernel's `relationId: true` says the scalar *is* the
 *      relation's column. Nine were found this way, six of them in this programme's own plugins.
 *   2. **A relation pair whose two sides disagree about cardinality.** `CampaignBudget.campaign` was declared
 *      many-to-one while `Campaign.budget` was one-to-one and the table carried a UNIQUE index on the foreign
 *      key — so the entity contradicted both its inverse side and its own migration.
 *   3. **A one-to-one whose owning side is stated only for TypeORM.** TypeORM reads ownership from
 *      `@JoinColumn()`; MikroORM needs `owner: true` (the kernel turns it into the join column and gives the
 *      other side `mappedBy`). Without it both sides look like owners and the metadata is refused.
 *
 * Run from the repository root: `node tools/scripts/dual-orm-metadata-check.mjs`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SEARCH = [join(ROOT, 'packages', 'plugins'), join(ROOT, 'packages', 'core', 'src', 'lib')];
const BASE_ENTITIES = join(ROOT, 'packages', 'core', 'src', 'lib', 'core', 'entities');

/**
 * Every `.entity.ts` under the searched roots, excluding build output, suites and test fixtures.
 *
 * A fixture is not mapped by the application's `MikroOrmModule`, so a defect in one cannot stop a boot; including
 * them would report findings nobody can act on and dilute the gate.
 */
function entityFiles(directory, found = []) {
	for (const entry of readdirSync(directory)) {
		if (entry === 'node_modules' || entry === 'dist') continue;

		const full = join(directory, entry);

		if (statSync(full).isDirectory()) {
			if (entry === 'testing' || entry === 'fixtures') continue;
			entityFiles(full, found);
		} else if (entry.endsWith('.entity.ts') && !entry.endsWith('.spec.ts')) {
			found.push(full);
		}
	}

	return found;
}

/** The index of the `)` closing the call opened at `open`, skipping string literals. */
function closingParen(text, open) {
	let depth = 0;
	let quote = null;

	for (let index = open; index < text.length; index++) {
		const character = text[index];

		if (quote) {
			if (character === '\\') index++;
			else if (character === quote) quote = null;
			continue;
		}

		if (character === "'" || character === '"' || character === '`') {
			quote = character;
			continue;
		}

		if (character === '(') depth++;
		else if (character === ')') {
			depth--;
			if (depth === 0) return index;
		}
	}

	return -1;
}

/**
 * Each class member's decorator text and the property name it declares.
 *
 * Read **forward** with parentheses tracked, because a decorator may span lines and contain nested parentheses
 * (`@MultiORMManyToOne(() => Warehouse, { … })`). Reading backwards from the property cannot tell a decorator's
 * closing line from unrelated code, and the first draft of this check did exactly that — it reported zero
 * collisions in a file that has one. Comments are stripped first: a `/** … *\/` line inside a decorator has no
 * parentheses and would otherwise be counted as one.
 */
function members(source) {
	const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
	const found = [];
	let decorators = '';
	let depth = 0;

	for (const line of stripped.split('\n')) {
		if (depth > 0 || /^[ \t]*@[\w.]/.test(line)) {
			decorators += line + '\n';
			depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
			continue;
		}

		const property = /^[ \t]+(?:readonly[ \t]+)?(\w+)[?]?\s*[:;]/.exec(line);

		if (property) found.push({ decorators, name: property[1] });

		decorators = '';
		depth = 0;
	}

	return found;
}

/** The arguments written inside a decorator's own parentheses. */
function decoratorArguments(text, name) {
	const at = text.indexOf(`@${name}`);
	if (at === -1) return '';

	const open = text.indexOf('(', at);
	if (open === -1) return '';

	const close = closingParen(text, open);

	return close === -1 ? '' : text.slice(open + 1, close);
}

/** What a file declares, as the three checks need it. */
function read(file) {
	const source = readFileSync(file, 'utf8');
	const entity = /export\s+(?:abstract\s+)?class\s+(\w+)/.exec(source)?.[1] ?? null;
	const declaration = /export\s+(?:abstract\s+)?class\s+\w+(?:\s+extends\s+([\w<>, ]+?))?\s*(?:implements|\{)/.exec(source);
	const parent = declaration?.[1] ? declaration[1].split('<')[0].trim() : null;

	return { source, entity, parent, members: members(source) };
}

const files = SEARCH.flatMap((directory) => entityFiles(directory));

/**
 * The relations each base entity declares, so an entity that *inherits* a relation can be told apart from one
 * that has none. Resolved through the `extends` chain rather than assumed: attributing every base relation to
 * every entity reported `TenantSetting.organizationId`, in a class whose own comment says the table keeps "a
 * tenant id and **no** organization id".
 */
const baseClasses = new Map();

for (const entry of readdirSync(BASE_ENTITIES)) {
	if (!entry.endsWith('.ts') || entry.endsWith('.spec.ts')) continue;

	const { entity, parent, members: list } = read(join(BASE_ENTITIES, entry));

	if (!entity) continue;

	const relations = new Set();

	for (const member of list) {
		if (/@MultiORM(?:ManyToOne|OneToOne|ManyToMany|OneToMany)\s*\(/.test(member.decorators)) {
			relations.add(member.name);
		}
	}

	baseClasses.set(entity, { parent, relations });
}

/** Every relation name an entity inherits, walking its `extends` chain to the root. */
function inheritedRelations(name, seen = new Set()) {
	if (!name || seen.has(name)) return new Set();
	seen.add(name);

	const base = baseClasses.get(name);
	if (!base) return new Set();

	return new Set([...base.relations, ...inheritedRelations(base.parent, seen)]);
}

const failures = [];
const checked = { files: 0, relations: 0, columns: 0 };
const relations = new Map();

for (const file of files) {
	const path = relative(ROOT, file).split('\\').join('/');
	const { source, entity, parent, members: list } = read(file);

	if (!entity) continue;

	checked.files++;

	const declaresRelation = new Set();
	const declaresColumn = new Map();

	for (const member of list) {
		const relation = /@MultiORM(ManyToOne|OneToOne|OneToMany|ManyToMany)\s*\(/.exec(member.decorators);

		if (relation) {
			declaresRelation.add(member.name);
			checked.relations++;

			const args = decoratorArguments(member.decorators, `MultiORM${relation[1]}`);

			relations.set(`${entity}.${member.name}`, {
				entity,
				property: member.name,
				kind: relation[1],
				target: /\(\s*\)\s*=>\s*(\w+)/.exec(args)?.[1] ?? null,
				inverse: /\(\s*\w+\s*\)\s*=>\s*\w+\.(\w+)/.exec(args)?.[1] ?? null,
				path,
				owns: /@JoinColumn\s*\(/.test(member.decorators),
				statesOwner: /owner\s*:\s*(?:true|false)/.test(member.decorators)
			});
		}

		if (/@MultiORMColumn\s*\(/.test(member.decorators)) {
			checked.columns++;

			const options = decoratorArguments(member.decorators, 'MultiORMColumn');

			declaresColumn.set(member.name, {
				relationId: /relationId\s*:\s*true/.test(options),
				line: source.slice(0, source.indexOf(member.decorators)).split('\n').length
			});
		}
	}

	// 1. A column that duplicates a relation's field name.
	const inherited = inheritedRelations(parent);

	for (const [name, options] of declaresColumn) {
		if (options.relationId) continue;

		const owner = name.endsWith('Id') ? name.slice(0, -2) : null;

		if (!owner || !(declaresRelation.has(owner) || inherited.has(owner))) continue;

		failures.push(
			`${path} -> \`${name}\` duplicates the field name of the relation \`${owner}\`; ` +
				`add \`relationId: true\` (and \`@RelationId\`) so MikroORM does not create a second column for it`
		);
	}
}

// 2. A relation pair whose two sides disagree about cardinality.
const PAIRS_WITH = {
	ManyToOne: new Set(['OneToMany']),
	OneToMany: new Set(['ManyToOne']),
	OneToOne: new Set(['OneToOne']),
	ManyToMany: new Set(['ManyToMany'])
};

const compared = new Set();

for (const [key, relation] of relations) {
	if (!relation.inverse || !relation.target) continue;

	const other = relations.get(`${relation.target}.${relation.inverse}`);

	if (!other) continue;

	const pair = [key, `${other.entity}.${other.property}`].sort().join(' | ');

	if (compared.has(pair)) continue;
	compared.add(pair);

	if (!PAIRS_WITH[relation.kind]?.has(other.kind)) {
		failures.push(
			`${relation.path} -> ${relation.entity}.${relation.property} is \`${relation.kind}\` and ` +
				`${other.entity}.${other.property} is \`${other.kind}\`; the two sides of one relation must agree, ` +
				`and the table's own index is what settles which is right`
		);
	}
}

// 3. A one-to-one whose owning side is stated only for TypeORM.
for (const [, relation] of relations) {
	if (relation.kind !== 'OneToOne' || !relation.owns || relation.statesOwner) continue;

	failures.push(
		`${relation.path} -> ${relation.entity}.${relation.property} carries \`@JoinColumn()\` but states no ` +
			`\`owner\`, so MikroORM reads both sides as owning ones; add \`owner: true\``
	);
}

if (failures.length > 0) {
	console.error('FAILED — entity mappings MikroORM cannot build metadata for:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('Each of these stops the application from booting under `DB_ORM=mikro-orm`. TypeORM accepts');
	console.error('them, which is why nothing else in this repository reports them.');
	process.exit(1);
}

console.log(
	`PASSED — ${checked.files} entity file(s): ${checked.columns} column(s) and ${checked.relations} relation(s) ` +
		`are mapped in the shapes both ORMs accept (no duplicated field names across ${compared.size} compared ` +
		`relation pair(s), no cardinality disagreements, and every one-to-one states its owner).`
);

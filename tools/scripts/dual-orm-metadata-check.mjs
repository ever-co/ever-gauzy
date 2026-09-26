#!/usr/bin/env node
/**
 * Gate: every entity must be one MikroORM can build metadata for, and that maps every column it declares.
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
 *   4. **A relation id no relation owns.** `relationId: true` says a scalar is the mirror of a relation's
 *      foreign key, and the kernel maps it `persist: false` on MikroORM (`column.helper.ts`) — right when a
 *      kernel many-to-one, or the owning side of a kernel one-to-one, owns that column there, and a silent
 *      data defect when nothing does: the column is left out of every INSERT and every SELECT, so the value
 *      is dropped on write and read back empty. MikroORM builds that metadata without complaint, so unlike
 *      the three above this one does not stop a boot; it was found in review instead —
 *      `ProductCategory.parentId` sat beside TypeORM's `@TreeParent`, which MikroORM never sees, and every
 *      category written under `DB_ORM=mikro-orm` was stored as a root (fixed in af3ca1588b). Two shapes
 *      produce it besides a column with no relation at all: a relation declared only with TypeORM's own
 *      decorators, and a kernel relation whose column is named only by TypeORM's `@JoinColumn({ name })`,
 *      which the MikroORM side never reads — it joins on `<property>Id` unless `joinColumn` names another.
 *      This check runs against a positive and a negative control on every run (see {@link RULE_4_CONTROLS}),
 *      so a parser change that stops it seeing either shape fails the gate instead of passing it.
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

/** A source without its comments — see {@link members} for why they go first. */
function withoutComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
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
	const stripped = withoutComments(source);
	const found = [];
	let decorators = '';
	let depth = 0;

	for (const line of stripped.split('\n')) {
		if (depth > 0 || /^[ \t]*@[\w.]/.test(line)) {
			decorators += line + '\n';
			depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
			continue;
		}

		// `!` as well as `?`: a definite-assignment member (`organizationTeam!: IOrganizationTeam;`) is a
		// member too, and reading past it dropped the relation it declares from every check below.
		const property = /^[ \t]+(?:readonly[ \t]+)?(\w+)[?!]?\s*[:;]/.exec(line);

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

/** An exported class declaration: its name, and the class it extends when it extends one. */
const CLASS_DECLARATION = /export\s+(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+([\w<>, ]+?))?\s*(?:implements|\{)/g;

/**
 * Every exported class a source declares, each with the members written inside its own body.
 *
 * A file can hold several: `base.entity.ts` holds the whole `Model` → `SoftDeletableBaseEntity` →
 * `AccessTimestamps` → `BaseEntityActionByUser` → `BaseEntity` chain. Read as one class, every member of that
 * file was filed under `Model` and `BaseEntity` was not known at all, so no entity inherited `createdByUser`,
 * `updatedByUser` or `deletedByUser` — which check 4 needs, because an entity may restate their ids.
 */
function classesIn(source) {
	const text = withoutComments(source);
	const declarations = [...text.matchAll(CLASS_DECLARATION)];

	return declarations.map((declaration, index) => ({
		name: declaration[1],
		parent: declaration[2] ? declaration[2].split('<')[0].trim() : null,
		members: members(text.slice(declaration.index, declarations[index + 1]?.index ?? text.length))
	}));
}

/** What a file declares, as the checks need it. */
function read(file) {
	const source = readFileSync(file, 'utf8');
	const entity = /export\s+(?:abstract\s+)?class\s+(\w+)/.exec(source)?.[1] ?? null;
	const declaration = /export\s+(?:abstract\s+)?class\s+\w+(?:\s+extends\s+([\w<>, ]+?))?\s*(?:implements|\{)/.exec(source);
	const parent = declaration?.[1] ? declaration[1].split('<')[0].trim() : null;

	return { source, entity, parent, members: members(source) };
}

/**
 * The relation a member declares through a kernel decorator, or null when it declares none.
 *
 * `column` is the foreign-key column the relation owns **on MikroORM**, the ORM a relation id depends on,
 * because that is where `relationId: true` becomes `persist: false`. The kernel names it `<property>Id` unless
 * the options name another with `joinColumn` (`mapManyToOneArgsForMikroORM`, and the one-to-one mapper for an
 * owning side). TypeORM's `@JoinColumn({ name })` is never read there, so it is kept apart as `typeOrmColumn`,
 * only to say in a finding what to change. Only a many-to-one, or a one-to-one on its owning side, owns a
 * column at all; a one-to-one with `@JoinColumn()` and no `owner` counts as owning one here, because check 3
 * already reports it and one finding per defect is enough.
 */
function relationOf(member) {
	const kind = /@MultiORM(ManyToOne|OneToOne|OneToMany|ManyToMany)\s*\(/.exec(member.decorators)?.[1];

	if (!kind) return null;

	const args = decoratorArguments(member.decorators, `MultiORM${kind}`);
	const owns = /@JoinColumn\s*\(/.test(member.decorators);

	return {
		kind,
		property: member.name,
		target: /\(\s*\)\s*=>\s*(\w+)/.exec(args)?.[1] ?? null,
		inverse: /\(\s*\w+\s*\)\s*=>\s*\w+\.(\w+)/.exec(args)?.[1] ?? null,
		owns,
		statesOwner: /owner\s*:\s*(?:true|false)/.test(member.decorators),
		column: /joinColumn\s*:\s*['"`](\w+)['"`]/.exec(args)?.[1] ?? `${member.name}Id`,
		ownsColumn: kind === 'ManyToOne' || (kind === 'OneToOne' && (owns || /owner\s*:\s*true/.test(member.decorators))),
		typeOrmColumn: /@JoinColumn\s*\(\s*\{[^}]*\bname\s*:\s*['"`](\w+)['"`]/.exec(member.decorators)?.[1] ?? null
	};
}

/** The kernel relations and the columns a list of members declares, each keyed by property name. */
function mappingOf(list) {
	const relationsHere = new Map();
	const columns = new Map();

	for (const member of list) {
		const relation = relationOf(member);

		if (relation) relationsHere.set(member.name, relation);

		if (/@MultiORMColumn\s*\(/.test(member.decorators)) {
			const options = decoratorArguments(member.decorators, 'MultiORMColumn');

			columns.set(member.name, { relationId: /relationId\s*:\s*true/.test(options) });
		}
	}

	return { relationsHere, columns };
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

	for (const declared of classesIn(readFileSync(join(BASE_ENTITIES, entry), 'utf8'))) {
		baseClasses.set(declared.name, { parent: declared.parent, relations: mappingOf(declared.members).relationsHere });
	}
}

/** Every relation an entity inherits, keyed by property name, walking its `extends` chain to the root. */
function inheritedRelations(name, seen = new Set()) {
	if (!name || seen.has(name)) return new Map();
	seen.add(name);

	const base = baseClasses.get(name);
	if (!base) return new Map();

	return new Map([...inheritedRelations(base.parent, seen), ...base.relations]);
}

/**
 * 4. The relation ids of one entity that no relation owns on MikroORM.
 *
 * @param relationsHere The kernel relations the entity declares itself.
 * @param inherited The kernel relations it inherits.
 * @param columns Its columns.
 * @returns One entry per unowned relation id, with the relation that names the column for TypeORM alone when
 * there is one — the case whose fix is a `joinColumn` rather than a new relation.
 */
function unownedRelationIds(relationsHere, inherited, columns) {
	const all = [...inherited.values(), ...relationsHere.values()].filter((relation) => relation.ownsColumn);
	const owned = new Set(all.map((relation) => relation.column));
	const found = [];

	for (const [name, options] of columns) {
		if (!options.relationId || owned.has(name)) continue;

		found.push({ name, namedForTypeOrm: all.find((relation) => relation.typeOrmColumn === name) ?? null });
	}

	return found;
}

/**
 * The fixtures check 4 is run against on every run, before it is trusted with the tree.
 *
 * The negative control's relation ids are all owned: by a kernel many-to-one under its default column, by one
 * whose column is named with `joinColumn`, by the owning side of a kernel one-to-one (written with a `!`, as
 * `OrganizationTeamEmployee` writes its relations), and by relations inherited from
 * `TenantOrganizationBaseEntity` and — three classes further up, in `base.entity.ts` — from
 * `BaseEntityActionByUser`. The positive control holds one of each shape the check exists for, the first being
 * `ProductCategory.parentId` exactly as it stood before af3ca1588b. A control that reports anything other than
 * what it expects fails the gate: a check that has gone blind would otherwise pass every entity it reads.
 */
const RULE_4_CONTROLS = [
	{
		name: 'negative control',
		expected: [],
		source: `
export class OwnedRelationIds extends TenantOrganizationBaseEntity {
	@MultiORMManyToOne(() => Warehouse, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	warehouse?: Warehouse;

	@RelationId((it: OwnedRelationIds) => it.warehouse)
	@MultiORMColumn({ nullable: true, relationId: true })
	warehouseId?: ID;

	@MultiORMManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', joinColumn: 'approvedByUserId' })
	@JoinColumn({ name: 'approvedByUserId' })
	approvedBy?: User;

	@RelationId((it: OwnedRelationIds) => it.approvedBy)
	@MultiORMColumn({ nullable: true, relationId: true })
	approvedByUserId?: ID;

	@MultiORMOneToOne(() => Profile, { owner: true, nullable: true })
	@JoinColumn()
	profile!: Profile;

	@RelationId((it: OwnedRelationIds) => it.profile)
	@MultiORMColumn({ nullable: true, relationId: true })
	profileId?: ID;

	@RelationId((it: OwnedRelationIds) => it.organization)
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationId?: ID;

	@RelationId((it: OwnedRelationIds) => it.createdByUser)
	@MultiORMColumn({ nullable: true, relationId: true })
	createdByUserId?: ID;

	@MultiORMColumn({ type: 'uuid', nullable: true })
	parentId?: ID;
}
`
	},
	{
		name: 'positive control',
		expected: ['approvedByUserId', 'orderId', 'parentId', 'profileId'],
		source: `
export class UnownedRelationIds extends TenantOrganizationBaseEntity {
	@RelationId((it: UnownedRelationIds) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	parentId?: ID;

	@TreeParent({ onDelete: 'SET NULL' })
	@JoinColumn()
	parent?: UnownedRelationIds;

	@MultiORMManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'approvedByUserId' })
	approvedBy?: User;

	@RelationId((it: UnownedRelationIds) => it.approvedBy)
	@MultiORMColumn({ nullable: true, relationId: true })
	approvedByUserId?: ID;

	@MultiORMColumn({ relationId: true })
	orderId: ID;

	@MultiORMOneToOne(() => Profile, (it) => it.account)
	profile?: Profile;

	@MultiORMColumn({ nullable: true, relationId: true })
	profileId?: ID;
}
`
	}
];

const failures = [];
const checked = { files: 0, relations: 0, columns: 0, relationIds: 0 };
const relations = new Map();

for (const control of RULE_4_CONTROLS) {
	const [declared] = classesIn(control.source);
	const { relationsHere, columns } = mappingOf(declared.members);
	const found = unownedRelationIds(relationsHere, inheritedRelations(declared.parent), columns)
		.map((unowned) => unowned.name)
		.sort();

	if (found.join(', ') !== [...control.expected].sort().join(', ')) {
		failures.push(
			`tools/scripts/dual-orm-metadata-check.mjs -> check 4's ${control.name} reported ` +
				`[${found.join(', ')}] where it expects [${control.expected.join(', ')}]; the check itself is ` +
				`broken, so what it says about the tree cannot be trusted`
		);
	}
}

for (const file of files) {
	const path = relative(ROOT, file).split('\\').join('/');
	const { entity, parent, members: list } = read(file);

	if (!entity) continue;

	checked.files++;

	const { relationsHere, columns } = mappingOf(list);

	for (const relation of relationsHere.values()) {
		checked.relations++;
		relations.set(`${entity}.${relation.property}`, { ...relation, entity, path });
	}

	checked.columns += columns.size;

	// 1. A column that duplicates a relation's field name.
	const inherited = inheritedRelations(parent);

	for (const [name, options] of columns) {
		if (options.relationId) continue;

		const owner = name.endsWith('Id') ? name.slice(0, -2) : null;

		if (!owner || !(relationsHere.has(owner) || inherited.has(owner))) continue;

		failures.push(
			`${path} -> \`${name}\` duplicates the field name of the relation \`${owner}\`; ` +
				`add \`relationId: true\` (and \`@RelationId\`) so MikroORM does not create a second column for it`
		);
	}

	// 4. A relation id no relation owns.
	for (const [, options] of columns) {
		if (options.relationId) checked.relationIds++;
	}

	for (const { name, namedForTypeOrm } of unownedRelationIds(relationsHere, inherited, columns)) {
		const fix = namedForTypeOrm
			? `\`${namedForTypeOrm.property}\` names it only in TypeORM's \`@JoinColumn({ name })\`, which MikroORM ` +
				`never reads — there it joins on \`${namedForTypeOrm.column}\`; add \`joinColumn: '${name}'\` to the ` +
				`relation's options`
			: `declare the relation with \`@MultiORMManyToOne\` (or an owning \`@MultiORMOneToOne\`), or drop ` +
				`\`relationId: true\` so the column is persisted`;

		failures.push(
			`${path} -> ${entity}.${name} is \`relationId: true\` and no relation owns it on MikroORM, which maps ` +
				`it \`persist: false\` with nothing behind it: the value is dropped on every write and reads back ` +
				`empty. ${fix}`
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
	console.error('FAILED — entity mappings MikroORM cannot build metadata for, or builds without the column:');
	for (const failure of failures) console.error(`  ${failure}`);
	console.error('');
	console.error('Checks 1-3 stop the application from booting under `DB_ORM=mikro-orm`; check 4 lets it boot and');
	console.error('loses the column on every write. TypeORM accepts all of them, which is why nothing else in this');
	console.error('repository reports them.');
	process.exit(1);
}

console.log(
	`PASSED — ${checked.files} entity file(s): ${checked.columns} column(s) and ${checked.relations} relation(s) ` +
		`are mapped in the shapes both ORMs accept (no duplicated field names across ${compared.size} compared ` +
		`relation pair(s), no cardinality disagreements, every one-to-one states its owner, and each of the ` +
		`${checked.relationIds} relation id(s) is owned by a relation MikroORM maps; check 4's controls held).`
);

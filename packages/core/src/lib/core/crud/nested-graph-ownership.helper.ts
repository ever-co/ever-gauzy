// cspell:ignore reparents
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager, EntityMetadata } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { ID } from '@gauzy/contracts';

/**
 * How many levels of nested objects below the root are walked. Real payloads nest two or three
 * levels deep (invoice → items, integration setting → tied entities); a payload that would still
 * persist rows below this depth is refused (400), because nothing down there can be checked.
 */
export const GRAPH_CHECK_MAX_DEPTH = 5;

interface IGraphNode {
	metadata: EntityMetadata;
	entity: Record<string, any>;
	depth: number;
}

interface IGraphRef {
	relation: RelationMetadata;
	node: IGraphNode;
	/** The nested object, or the primitive id TypeORM treats as a foreign key. */
	value: unknown;
	/** Position in the relation array, or -1 for a single-valued relation. */
	index: number;
	id: ID | undefined;
}

interface IStoredRow {
	tenantId: ID | null;
	parentId?: ID | null;
}

const isPlainValue = (value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number';

/**
 * The key a loaded row is stored and looked up under.
 *
 * Postgres `uuid` columns always render lower case and MySQL's default collation is case
 * insensitive, so `AAAA-…` in the payload SELECTs the row stored as `aaaa-…`. Keying the lookup by
 * the raw string would then miss the row, skip the ownership check and let the very payload this
 * helper exists to refuse reach `save()`, which resolves the id case-insensitively again
 * (GHSA-jh6m-9fxr-rx3c). Ids are uuids here — {@link isTenantScoped} requires a single `id` primary
 * key — so folding the case cannot merge two different rows.
 */
const rowKey = (id: ID | number): string => String(id).toLowerCase();

const isObject = (value: unknown): value is Record<string, any> =>
	!!value && typeof value === 'object' && !(value instanceof Date) && typeof (value as any).then !== 'function';

/**
 * TypeORM rewrites the CHILD row of these relations to point at the parent, cascade or not
 * (OneToManySubjectBuilder / OneToOneInverseSideSubjectBuilder), so referencing a row here is a write.
 */
const reparentsTarget = (relation: RelationMetadata): boolean => relation.isOneToMany || relation.isOneToOneNotOwner;

const cascadesInto = (relation: RelationMetadata): boolean => relation.isCascadeInsert || relation.isCascadeUpdate;

/** Only rows with a single `id` primary key and a `tenantId` column can be checked (and need to be). */
const isTenantScoped = (metadata: EntityMetadata): boolean =>
	metadata.primaryColumns.length === 1 &&
	metadata.primaryColumns[0].propertyName === 'id' &&
	metadata.hasColumnWithPropertyPath('tenantId');

/**
 * Refuses a persistence payload whose NESTED objects or ids reach rows of another tenant.
 *
 * `assertNotForeignRow` only checks the root id. TypeORM's save() resolves every nested object by
 * primary key alone: cascaded relations are UPDATEd in place, one-to-many children are re-parented
 * even without cascade, and owner / many-to-many relations store whatever id they are given. A body
 * such as `{ invoiceItems: [{ id: <another tenant's item>, price: 1 }] }` on the caller's OWN invoice
 * therefore overwrote and claimed the other tenant's row (GHSA-jh6m-9fxr-rx3c).
 *
 * The walk follows the TypeORM relation metadata, one level at a time, with one SELECT per relation
 * per level (soft-deleted rows included, since save() reaches those too):
 *
 * - A row of ANOTHER tenant is refused through any relation.
 * - A row with a NULL tenant (global languages, system issue types / priorities, global tags):
 *   - may be LINKED (owner many-to-one / one-to-one, many-to-many), as today; when the relation
 *     cascades and the payload carries fields beyond `id`, the object is reduced to `{ id }` so the
 *     global row is linked but never written;
 *   - may not be re-parented (one-to-many / inverse one-to-one) unless it already belongs to this
 *     parent — adopting it would be a write into a row no tenant owns.
 * - Objects persisted through a cascade are recursed into (visited set, and a payload that would
 *   persist below {@link GRAPH_CHECK_MAX_DEPTH} is refused rather than left unchecked) and stamped
 *   with the caller's tenant (a nested `tenantId` would otherwise place — or move — the row into
 *   another tenant). An EXISTING `User` is reduced to `{ id }`: it is linked, never written.
 *
 * Nested objects are only replaced (with a copy) when fields have to be removed; tenant stamping is
 * done in place so the caller still sees ids TypeORM generates on save.
 *
 * @param manager - The TypeORM entity manager used for the lookups.
 * @param metadata - Metadata of the root entity.
 * @param entities - The root payloads about to be persisted.
 * @param tenantId - The caller's tenant; without one nothing can be judged and nothing is checked.
 */
export async function assertGraphNotForeign(
	manager: EntityManager,
	metadata: EntityMetadata | undefined,
	entities: unknown[],
	tenantId: ID | null | undefined
): Promise<void> {
	if (!tenantId || !manager || !metadata?.relations) {
		return;
	}

	const visited = new WeakSet<object>();
	let level: IGraphNode[] = [];
	for (const entity of entities ?? []) {
		if (isObject(entity) && !visited.has(entity)) {
			visited.add(entity);
			level.push({ metadata, entity, depth: 0 });
		}
	}

	while (level.length) {
		const next: IGraphNode[] = [];

		for (const [relation, refs] of collectReferences(level)) {
			next.push(...(await walkRelation(manager, relation, refs, tenantId, visited)));
		}

		level = next;
	}
}

/**
 * Checks every reference carried by ONE relation (one batched lookup) and returns the nodes the next
 * level has to walk.
 *
 * @param manager - The TypeORM entity manager used for the lookup.
 * @param relation - The relation the references were collected from.
 * @param refs - The nested objects / ids that relation carries at this level.
 * @param tenantId - The caller's tenant.
 * @param visited - Objects already queued, so a cyclic payload is walked once.
 */
async function walkRelation(
	manager: EntityManager,
	relation: RelationMetadata,
	refs: IGraphRef[],
	tenantId: ID,
	visited: WeakSet<object>
): Promise<IGraphNode[]> {
	const target = relation.inverseEntityMetadata;
	const scoped = isTenantScoped(target);
	const rows = scoped ? await loadStoredRows(manager, relation, refs) : new Map<string, IStoredRow>();
	const next: IGraphNode[] = [];

	for (const ref of refs) {
		const row = ref.id !== undefined ? rows.get(rowKey(ref.id)) : undefined;
		const persisted = resolveReference(ref, row, scoped, tenantId);
		const depth = ref.node.depth + 1;

		if (!persisted || visited.has(persisted)) {
			continue;
		}

		if (depth >= GRAPH_CHECK_MAX_DEPTH) {
			// Nothing below this level is walked, so nothing may be persisted below it either: save()
			// would cascade (or re-parent) those rows with no ownership check at all.
			if (hasRelationPayload(target, persisted)) {
				throw new BadRequestException(
					`Nested payload in "${relation.propertyPath}" is deeper than ${GRAPH_CHECK_MAX_DEPTH} levels`
				);
			}
			continue;
		}

		visited.add(persisted);
		next.push({ metadata: target, entity: persisted, depth });
	}

	return next;
}

/**
 * Applies the ownership rules to ONE reference and returns the object the walk should descend into
 * — `undefined` when the reference is only a link (nothing of it is persisted) or had to be reduced
 * to one. Throws when the reference may not be persisted at all.
 *
 * @param ref - The nested object / id and the relation that carries it.
 * @param row - The stored row it names, when it names one.
 * @param scoped - Whether the target entity is tenant scoped (see {@link isTenantScoped}).
 * @param tenantId - The caller's tenant.
 */
function resolveReference(
	ref: IGraphRef,
	row: IStoredRow | undefined,
	scoped: boolean,
	tenantId: ID
): Record<string, any> | undefined {
	const { relation } = ref;

	if (row) {
		const rowTenantId = row.tenantId ?? null;

		if (rowTenantId !== null && rowKey(rowTenantId) !== rowKey(tenantId)) {
			throw new ForbiddenException('A related record belongs to another tenant');
		}

		if (rowTenantId === null && !isGlobalRowWritable(ref, row)) {
			// Keep the link to the global row, but never write into it.
			replaceValue(ref, { id: ref.id });
			return undefined;
		}
	}

	if (!cascadesInto(relation) || !isObject(ref.value)) {
		return undefined;
	}

	// An EXISTING user is LINKED through another entity's cascade, never written into. Removing only
	// the credential columns still left `user: { id, firstName }` renaming any account of the tenant —
	// a tenant check alone cannot stop that, since the victim is a legitimate member of the caller's
	// tenant (GHSA-jh6m-9fxr-rx3c). A NEW user inserted through a cascade (candidate sign-up) is not
	// reduced and keeps every field.
	if (row && relation.inverseEntityMetadata.name === 'User') {
		if (hasFieldsBeyondId(ref.value)) {
			replaceValue(ref, { id: ref.id });
		}
		return undefined;
	}

	const persisted = ref.value;

	if (scoped && (!row || row.tenantId != null || 'tenantId' in persisted || 'tenant' in persisted)) {
		stampTenant(persisted, tenantId);
	}

	return persisted;
}

/**
 * Rules for a stored row that belongs to NO tenant (global languages, system issue types and
 * priorities, global tags): it may be linked, but re-parenting it is a write into a row no tenant
 * owns — refused unless it already hangs off this very parent.
 *
 * @returns false when a cascading payload has to be reduced to a plain link.
 */
function isGlobalRowWritable(ref: IGraphRef, row: IStoredRow): boolean {
	const { relation } = ref;

	if (reparentsTarget(relation)) {
		const parentId = ref.node.entity?.id;
		if (!parentId || row.parentId == null || rowKey(row.parentId) !== rowKey(parentId)) {
			throw new ForbiddenException('A related record is not owned by this tenant');
		}
		return true;
	}

	return !(cascadesInto(relation) && isObject(ref.value) && hasFieldsBeyondId(ref.value));
}

/**
 * Groups every nested object / id of the given nodes by the relation that carries it.
 */
function collectReferences(level: IGraphNode[]): Map<RelationMetadata, IGraphRef[]> {
	const refsByRelation = new Map<RelationMetadata, IGraphRef[]>();

	for (const node of level) {
		for (const relation of node.metadata.relations) {
			const raw = node.entity[relation.propertyName];
			// Nothing to check, or a MikroORM Collection of loaded entities rather than request data.
			if (raw === undefined || raw === null || typeof raw.getItems === 'function') {
				continue;
			}
			const values: unknown[] = Array.isArray(raw) ? raw : [raw];
			values.forEach((value, index) => {
				let id: ID | undefined;
				if (isPlainValue(value)) {
					id = value as ID;
				} else if (isObject(value)) {
					id = isPlainValue(value.id) ? (value.id as ID) : undefined;
				} else {
					return;
				}
				const refs = refsByRelation.get(relation) ?? [];
				refs.push({ relation, node, value, index: Array.isArray(raw) ? index : -1, id });
				refsByRelation.set(relation, refs);
			});
		}
	}

	return refsByRelation;
}

/**
 * Loads `{ id, tenantId }` — plus the parent foreign key for re-parenting relations — of every row the
 * refs name, in one query.
 */
async function loadStoredRows(
	manager: EntityManager,
	relation: RelationMetadata,
	refs: IGraphRef[]
): Promise<Map<string, IStoredRow>> {
	const ids = [...new Set(refs.map((ref) => ref.id).filter((id) => id !== undefined && id !== ''))];
	const rows = new Map<string, IStoredRow>();
	if (!ids.length) {
		return rows;
	}

	const target = relation.inverseEntityMetadata;
	const inverse = relation.inverseRelation;
	const selectsParent = reparentsTarget(relation) && inverse?.joinColumns?.length === 1;

	try {
		const query = manager
			.getRepository(target.target)
			.createQueryBuilder('graph_row')
			.withDeleted()
			.select('graph_row.id', 'id')
			.addSelect('graph_row.tenantId', 'tenantId');
		if (selectsParent) {
			query.addSelect(`graph_row.${inverse.propertyPath}`, 'parentId');
		}
		const raw: Array<{ id: ID; tenantId: ID | null; parentId?: ID | null }> = await query
			.whereInIds(ids)
			.getRawMany();

		for (const row of raw) {
			rows.set(rowKey(row.id), { tenantId: row.tenantId ?? null, parentId: row.parentId ?? null });
		}
	} catch {
		// An id the database cannot even parse (e.g. not a UUID) cannot be proven harmless. The driver
		// error itself is deliberately not surfaced: it would echo the query back to the caller.
		throw new BadRequestException(`Invalid reference in "${relation.propertyPath}"`);
	}

	return rows;
}

function hasFieldsBeyondId(value: Record<string, any>): boolean {
	return Object.keys(value).some((key) => key !== 'id' && value[key] !== undefined);
}

/**
 * Whether the object carries request data for any relation of its entity — i.e. whether persisting
 * it would reach further rows. A loaded MikroORM Collection is not request data (see
 * {@link collectReferences}).
 */
function hasRelationPayload(metadata: EntityMetadata, entity: Record<string, any>): boolean {
	return metadata.relations.some((relation) => {
		const raw = entity[relation.propertyName];
		return raw !== undefined && raw !== null && typeof raw.getItems !== 'function';
	});
}

function stampTenant(value: Record<string, any>, tenantId: ID): void {
	value.tenantId = tenantId;
	if ('tenant' in value) {
		value.tenant = { id: tenantId };
	}
}

/** Swaps the nested value on its parent, without mutating the original object or array. */
function replaceValue(ref: IGraphRef, replacement: unknown): void {
	const { entity } = ref.node;
	const property = ref.relation.propertyName;
	if (ref.index >= 0) {
		const copy = [...entity[property]];
		copy[ref.index] = replacement;
		entity[property] = copy;
	} else {
		entity[property] = replacement;
	}
}

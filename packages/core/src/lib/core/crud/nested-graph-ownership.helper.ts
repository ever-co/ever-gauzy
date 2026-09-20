import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager, EntityMetadata } from 'typeorm';
import { RelationMetadata } from 'typeorm/metadata/RelationMetadata';
import { ID } from '@gauzy/contracts';

/**
 * How many levels of nested objects below the root are followed. Real payloads nest two or three
 * levels deep (invoice → items, integration setting → tied entities); anything deeper is still
 * checked up to this depth and not persisted any differently by the check.
 */
export const GRAPH_CHECK_MAX_DEPTH = 5;

/**
 * Columns of an EXISTING user that a cascade from another entity must never write. `Candidate.user`
 * cascades, so a nested `user: { id, hash }` rewrote any account's password — even a super admin's
 * of the same tenant, which a tenant check alone cannot stop (GHSA-jh6m-9fxr-rx3c). A new user
 * inserted through a cascade (candidate sign-up) keeps them.
 */
export const CASCADE_PROTECTED_USER_FIELDS: readonly string[] = Object.freeze([
	'hash',
	'refreshToken',
	'code',
	'codeExpireAt',
	'emailToken',
	'emailVerifiedAt',
	'email',
	'username',
	'thirdPartyId',
	'role',
	'roleId'
]);

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
 * - Objects persisted through a cascade are recursed into (bounded depth, visited set), stamped with
 *   the caller's tenant (a nested `tenantId` would otherwise place — or move — the row into another
 *   tenant), and, for an existing User, stripped of {@link CASCADE_PROTECTED_USER_FIELDS}.
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
		const refsByRelation = collectReferences(level);
		const next: IGraphNode[] = [];

		for (const [relation, refs] of refsByRelation) {
			const target = relation.inverseEntityMetadata;
			const scoped = isTenantScoped(target);
			const rows = scoped ? await loadStoredRows(manager, relation, refs) : new Map<string, IStoredRow>();

			for (const ref of refs) {
				const row = ref.id !== undefined ? rows.get(rowKey(ref.id)) : undefined;

				if (row) {
					const rowTenantId = row.tenantId ?? null;
					if (rowTenantId !== null && rowKey(rowTenantId) !== rowKey(tenantId)) {
						throw new ForbiddenException('A related record belongs to another tenant');
					}
					if (rowTenantId === null) {
						if (reparentsTarget(relation)) {
							const parentId = ref.node.entity?.id;
							if (!parentId || row.parentId == null || rowKey(row.parentId) !== rowKey(parentId)) {
								throw new ForbiddenException('A related record is not owned by this tenant');
							}
						} else if (cascadesInto(relation) && isObject(ref.value) && hasFieldsBeyondId(ref.value)) {
							// Keep the link to the global row, but never write into it.
							replaceValue(ref, { id: ref.id });
							continue;
						}
					}
				}

				if (!cascadesInto(relation) || !isObject(ref.value)) {
					continue;
				}

				let persisted = ref.value;
				if (row && target.name === 'User') {
					persisted = withoutFields(persisted, CASCADE_PROTECTED_USER_FIELDS);
					if (persisted !== ref.value) {
						replaceValue(ref, persisted);
					}
				}

				if (scoped && (!row || row.tenantId != null || 'tenantId' in persisted || 'tenant' in persisted)) {
					stampTenant(persisted, tenantId);
				}

				if (ref.node.depth + 1 < GRAPH_CHECK_MAX_DEPTH && !visited.has(persisted)) {
					visited.add(persisted);
					next.push({ metadata: target, entity: persisted, depth: ref.node.depth + 1 });
				}
			}
		}

		level = next;
	}
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
	} catch (error) {
		// An id the database cannot even parse (e.g. not a UUID) cannot be proven harmless.
		throw new BadRequestException(`Invalid reference in "${relation.propertyPath}"`);
	}

	return rows;
}

function hasFieldsBeyondId(value: Record<string, any>): boolean {
	return Object.keys(value).some((key) => key !== 'id' && value[key] !== undefined);
}

/** Returns a copy without the given fields, or the object itself when it carries none of them. */
function withoutFields(value: Record<string, any>, fields: readonly string[]): Record<string, any> {
	if (!fields.some((field) => field in value)) {
		return value;
	}
	const copy = { ...value };
	for (const field of fields) {
		delete copy[field];
	}
	return copy;
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

import { EntityMetadata, EntityProperty, ReferenceKind, Utils, wrap } from '@mikro-orm/core';

/**
 * How a MikroORM mapping carries one of the columns a tenant-aware statement is scoped by (`tenantId`,
 * `employeeId`).
 *
 * **Why the tenant-aware base cannot ask TypeORM.** `MultiORMColumn` and the relation decorators apply only
 * the active ORM's decorator, so under `DB_ORM=mikro-orm` TypeORM is handed a skeleton of every entity —
 * the base entity's raw TypeORM columns and nothing else. Asked whether an entity has a `tenantId` column,
 * TypeORM therefore answers "no" for every entity there is, and the tenant-aware base used to take that
 * answer and add no tenant condition to any read, update, delete or soft-delete on that ORM. The question
 * has to be put to the metadata of the ORM that runs the statement.
 *
 * **What the platform's mapping looks like to MikroORM.** `TenantBaseEntity` declares the `tenant` relation
 * and, beside it, a `tenantId` property marked `relationId: true`, which `parseMikroOrmColumnOptions` turns
 * into `persist: false`. Under the naming strategy the platform configures (`EntityCaseNamingStrategy`), the
 * relation's join column and that property name the same physical column, `tenantId`. MikroORM therefore
 * never writes the property — the relation does — but it filters on it, in `find`, `count`, `nativeUpdate`
 * and `nativeDelete` alike, because the property's field name is the column. That is established against a
 * real store in `tenant-aware-crud.service.scope-per-orm.spec.ts`, not assumed here.
 *
 * A property that is neither persisted nor the mirror of a relation's column names no column at all: a
 * statement predicated on it would reach for a column that does not exist. It is answered as absent, which
 * is what TypeORM's `hasColumnWithPropertyPath` answers for a property it has no column for.
 */
export interface IMikroOrmScopeColumn {
	/** The scalar property a `where` or an `UPDATE` names: the persisted property, or the relation's mirror. */
	property: string;

	/** The owning relation that reads and writes the same column, when the mapping has one. */
	relation?: string;

	/**
	 * What a `fields` list must name for a load to hydrate the column. A `persist: false` mirror is not
	 * selected by name — `fields: ['id', 'tenantId']` loads the row with the tenant left unset — so for a
	 * mirror it is the owning relation, whose foreign key the load then reads.
	 */
	hydratedBy: string;
}

/** The relation kinds whose owning side holds a foreign-key column on this entity's table. */
const OWNS_A_COLUMN = (property: EntityProperty): boolean =>
	property.kind === ReferenceKind.MANY_TO_ONE || (property.kind === ReferenceKind.ONE_TO_ONE && !!property.owner);

/**
 * Whether two properties are mapped onto exactly the same columns.
 *
 * @param left The field names of one property.
 * @param right The field names of the other.
 */
function sameColumns(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
	return !!left?.length && left.length === right?.length && left.every((field, index) => field === right[index]);
}

/**
 * Reads how the given MikroORM metadata carries a scope column.
 *
 * @param meta The entity's MikroORM metadata.
 * @param property The scalar property the scoping names (`tenantId`, `employeeId`).
 * @returns The mapping, or `null` when the entity has no such column.
 */
export function resolveMikroOrmScopeColumn(
	meta: EntityMetadata | undefined,
	property: string
): IMikroOrmScopeColumn | null {
	const scalar = meta?.properties?.[property];
	if (!scalar || scalar.kind !== ReferenceKind.SCALAR) {
		return null;
	}

	const owner = Object.values(meta.properties).find(
		(candidate) => OWNS_A_COLUMN(candidate) && sameColumns(candidate.fieldNames, scalar.fieldNames)
	);

	if (scalar.persist === false) {
		// A relation-id mirror names a column only because the relation beside it writes one.
		return owner ? { property, relation: owner.name, hydratedBy: owner.name } : null;
	}

	return { property, relation: owner?.name, hydratedBy: property };
}

/**
 * Reads a scope column's value off an entity MikroORM loaded with {@link IMikroOrmScopeColumn.hydratedBy}
 * among its fields.
 *
 * @param entity The loaded entity, or nothing.
 * @param column The mapping the entity was loaded through.
 * @returns The column's value, or `undefined` when there is no entity.
 */
export function readMikroOrmScopeColumn(entity: unknown, column: IMikroOrmScopeColumn): unknown {
	if (!entity || typeof entity !== 'object') {
		return undefined;
	}

	const row = entity as Record<string, unknown>;
	const reference = column.relation ? (row[column.relation] as { id?: unknown } | null | undefined) : undefined;

	return row[column.property] ?? reference?.id;
}

/**
 * The payload MikroORM's `em.create()` needs for a row the caller described by relation-id mirrors.
 *
 * **Why.** The platform writes a foreign key the TypeORM way, by its mirror — `{ userId }`, `{ organizationContactId }`
 * — and under MikroORM the mirror is `persist: false`: the owning relation beside it writes the column. `nativeUpdate`,
 * `upsert` and `assign()` on a loaded entity write a mirror-only payload correctly, but `em.create()` does not: the
 * relation stays unset, so a required foreign key fails the flush (`Value for Token.user is required, 'undefined'
 * found` — every MikroORM login, whose refresh token is created with `{ userId }`), and a nullable one is silently
 * written as `NULL`. Measured against MikroORM 6.6 on SQLite in `crud.service.mikro-orm-insert.spec.ts`.
 *
 * **What it does.** For each mirror the payload states (`null` included) whose owning relation it does not state,
 * the relation is given the same value — the primary key, which `em.create()` turns into a reference to the
 * existing row, exactly as it does for the `{ id }` the tenant-aware base stamps. The mirror is kept, so the new
 * entity carries it as TypeORM's does. A payload that states the relation, or no mirror, is returned as it is.
 *
 * Only for `em.create()`: handed both keys, `nativeUpdate` and `upsert` name the relation as a column of its own
 * and the statement is refused.
 *
 * **Embedded objects** — a plugin's custom fields, `customFields: { repositoryId }` — are read the same way against
 * the embeddable's properties. There `assign()` onto a loaded entity does NOT write a mirror-only payload: measured,
 * `customFields: { repositoryId }` left `organization_project.repositoryId` NULL through `create()`, `save()` and
 * `em.assign()` alike (the GitHub integration links a repository exactly so). With `embeddedOnly`, only embedded
 * objects are stated, which is what the `assign()` paths need: at the entity's own level a mirror-only payload is
 * already written there.
 *
 * @param meta The entity's MikroORM metadata.
 * @param data The payload.
 * @param options `embeddedOnly`: leave the entity's own level as it is.
 * @returns The payload with the relations its mirrors describe, or the payload itself when there are none.
 */
export function stateRelationsFromMirrors<D extends object>(
	meta: EntityMetadata | undefined,
	data: D,
	options: { embeddedOnly?: boolean } = {}
): D {
	if (!meta?.properties || !data || typeof data !== 'object') {
		return data;
	}

	return (stateMirrorsAt(meta.properties as PropertyMap, data as Record<string, unknown>, !options.embeddedOnly) ??
		data) as D;
}

/** The properties one level of a payload is read against: an entity's, or an embeddable's (`embeddedProps`). */
type PropertyMap = Record<string, EntityProperty>;

/** Whether a payload value is a plain object MikroORM reads as an embeddable's data. */
const isEmbeddedData = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value) && !Utils.isEntity(value);

/**
 * {@link stateRelationsFromMirrors} at one level: the properties are keyed by the names the payload uses (an
 * embeddable's by its own property names).
 *
 * @returns A copy with the stated relations, or `undefined` when nothing had to be stated.
 */
function stateMirrorsAt(
	properties: PropertyMap,
	payload: Record<string, unknown>,
	atThisLevel: boolean
): Record<string, unknown> | undefined {
	let stated: Record<string, unknown> | undefined;

	for (const [name, property] of Object.entries(properties)) {
		if (property.kind === ReferenceKind.EMBEDDED) {
			const nested = payload[name];
			if (property.embeddedProps && isEmbeddedData(nested)) {
				const inner = stateMirrorsAt(property.embeddedProps as PropertyMap, nested, true);
				if (inner) {
					stated ??= { ...payload };
					stated[name] = inner;
				}
			}
			continue;
		}

		if (
			!atThisLevel ||
			property.kind !== ReferenceKind.SCALAR ||
			property.persist !== false ||
			payload[name] === undefined
		) {
			continue;
		}

		const owner = Object.entries(properties).find(
			([, candidate]) => OWNS_A_COLUMN(candidate) && sameColumns(candidate.fieldNames, property.fieldNames)
		);
		if (!owner || payload[owner[0]] !== undefined) {
			continue;
		}

		stated ??= { ...payload };
		stated[owner[0]] = payload[name];
	}

	return stated;
}

/**
 * The primary key a relation's value names: the value itself when it is a key, the `id` of a `{ id }` or of an
 * entity, `null` for `null`, and `undefined` when it names none (a new nested object).
 */
function relationKeyOf(value: unknown): unknown {
	if (value === null) return null;
	if (typeof value !== 'object') return value;
	if (Utils.isEntity(value)) {
		const key = wrap(value, true).getPrimaryKey();
		return key !== null && typeof key === 'object' ? undefined : key;
	}
	return (value as { id?: unknown }).id;
}

/**
 * The payload MikroORM's `upsert` and `nativeUpdate` accept for a row whose relation and relation-id mirror are
 * both stated.
 *
 * **Why.** Handed a plain object that names both the owning relation and its `persist: false` mirror, both
 * statements are refused, because the relation's key is written out as a column of its own
 * (`insert into token (…, user, userId) …` — `table token has no column named user`). That is exactly the shape
 * `wrap(entity).toJSON()` produces — an unpopulated relation serialises to its key, beside the mirror — so every
 * `create()` → `serialize()` → `save()` round trip failed under MikroORM (a refresh token's, among others).
 * Either key alone is written correctly. Measured against MikroORM 6.6 on SQLite in
 * `crud.service.mikro-orm-insert.spec.ts`.
 *
 * **What it does.** For each such pair the relation is dropped and the mirror kept, holding the relation's key
 * when the relation names one — the owning relation is what MikroORM writes the column from, so it wins a
 * disagreement — and the mirror's own value otherwise. A relation that names no key (a new nested object) is
 * kept and its mirror dropped instead. An entity instance is returned as it is: MikroORM reads its change set,
 * not its keys, and writes it correctly.
 *
 * @param meta The entity's MikroORM metadata.
 * @param data The payload.
 * @returns The payload with one key per column, or the payload itself when nothing was doubled.
 */
export function collapseRelationMirrors<D extends object>(meta: EntityMetadata | undefined, data: D): D {
	if (!meta?.properties || !data || typeof data !== 'object' || Utils.isEntity(data)) {
		return data;
	}

	return (collapseMirrorsAt(meta.properties as PropertyMap, data as Record<string, unknown>) ?? data) as D;
}

/**
 * {@link collapseRelationMirrors} at one level, embedded objects (a plugin's `customFields`) included.
 *
 * @returns A copy with one key per column, or `undefined` when nothing was doubled.
 */
function collapseMirrorsAt(
	properties: PropertyMap,
	payload: Record<string, unknown>
): Record<string, unknown> | undefined {
	let collapsed: Record<string, unknown> | undefined;

	for (const [name, property] of Object.entries(properties)) {
		if (property.kind === ReferenceKind.EMBEDDED) {
			const nested = payload[name];
			if (property.embeddedProps && isEmbeddedData(nested)) {
				const inner = collapseMirrorsAt(property.embeddedProps as PropertyMap, nested);
				if (inner) {
					collapsed ??= { ...payload };
					collapsed[name] = inner;
				}
			}
			continue;
		}

		if (property.kind !== ReferenceKind.SCALAR || property.persist !== false || payload[name] === undefined) {
			continue;
		}

		const owner = Object.entries(properties).find(
			([, candidate]) => OWNS_A_COLUMN(candidate) && sameColumns(candidate.fieldNames, property.fieldNames)
		);
		if (!owner || payload[owner[0]] === undefined) {
			continue;
		}

		collapsed ??= { ...payload };
		const key = relationKeyOf(payload[owner[0]]);

		if (key === undefined) {
			delete collapsed[name];
		} else {
			collapsed[name] = key;
			delete collapsed[owner[0]];
		}
	}

	return collapsed;
}

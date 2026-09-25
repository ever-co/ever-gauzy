import { EntityMetadata, EntityProperty, ReferenceKind } from '@mikro-orm/core';

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

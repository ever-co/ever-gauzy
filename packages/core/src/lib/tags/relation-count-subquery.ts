import { EntityMetadata } from 'typeorm';

/**
 * The identifier quoting of the database the SQL runs on (`DataSource.driver` satisfies it):
 * `"name"` on PostgreSQL and SQLite, `` `name` `` on MySQL.
 */
export interface IdentifierEscaper {
	escape(name: string): string;
}

/**
 * SQL for the number of rows a many-to-many relation of `parentAlias` holds, as a correlated scalar subquery:
 *
 * ```sql
 * (SELECT COUNT(DISTINCT "tag_target"."id")
 *    FROM "tag_task" "tag_junction"
 *   INNER JOIN "task" "tag_target" ON "tag_target"."id" = "tag_junction"."taskId" AND "tag_target"."deletedAt" IS NULL
 *   WHERE "tag_junction"."tagId" = "tag"."id")
 * ```
 *
 * It counts exactly what `COUNT(DISTINCT relationAlias.id)` over `leftJoin(parentAlias.relation, relationAlias)`
 * counts, without joining the relation into the outer query: TypeORM joins the junction table on the parent's
 * referenced columns, then the target table on the junction's other columns and, when the target is soft-deletable,
 * on `deletedAt IS NULL` as well (`SelectQueryBuilder.join` adds it to the ON clause of every join to such an
 * entity), so only live targets are counted. Junction rows whose target is missing or soft-deleted gave a NULL
 * target there, which `COUNT` skips; the INNER JOIN here drops them the same way.
 *
 * Joining every relation into one query, as the tags list did, makes the database build the cross product of all
 * of a tag's relation rows before it can count them; this subquery reads one relation of one row at a time.
 *
 * @param metadata - Metadata of the parent entity (e.g. `Tag`).
 * @param relationPath - Property path of the many-to-many relation, e.g. `tasks` or `customFields.labels`.
 * @param parentAlias - The alias the outer query gives the parent entity.
 * @param escaper - Quotes identifiers for the database the query runs on, usually `dataSource.driver`.
 * @throws Error when `relationPath` is not a many-to-many relation of the entity.
 */
export function manyToManyCountSubquery(
	metadata: EntityMetadata,
	relationPath: string,
	parentAlias: string,
	escaper: IdentifierEscaper
): string {
	const relation = metadata.findRelationWithPropertyPath(relationPath);
	if (!relation?.isManyToMany || !relation.junctionEntityMetadata) {
		throw new Error(`Relation "${relationPath}" is not a many-to-many relation of ${metadata.name}`);
	}

	const escape = (name: string) => escaper.escape(name);
	// Same as QueryBuilder#getTableName: a table path may carry a schema (`schema.table`)
	const table = (tablePath: string) =>
		tablePath
			.split('.')
			.map((part) => (part === '' ? part : escape(part)))
			.join('.');

	// The junction columns pointing at the parent and at the target. The owning side declares the join table, so
	// from the inverse side they are the owner's columns the other way round (as SelectQueryBuilder joins them).
	const owner = relation.isOwning ? relation : relation.inverseRelation;
	if (!owner) {
		throw new Error(`Relation "${relationPath}" of ${metadata.name} has no owning side`);
	}
	const toParent = relation.isOwning ? owner.joinColumns : owner.inverseJoinColumns;
	const toTarget = relation.isOwning ? owner.inverseJoinColumns : owner.joinColumns;
	const target = relation.inverseEntityMetadata;

	const parent = escape(parentAlias);
	const junction = escape(`${parentAlias}_junction`);
	const joined = escape(`${parentAlias}_target`);
	const column = (alias: string, name: string) => `${alias}.${escape(name)}`;

	const onTarget = toTarget.map(
		(joinColumn) =>
			`${column(joined, joinColumn.referencedColumn!.databaseName)} = ${column(junction, joinColumn.databaseName)}`
	);
	if (target.deleteDateColumn) {
		onTarget.push(`${column(joined, target.deleteDateColumn.databaseName)} IS NULL`);
	}
	const onParent = toParent.map(
		(joinColumn) =>
			`${column(junction, joinColumn.databaseName)} = ${column(parent, joinColumn.referencedColumn!.databaseName)}`
	);

	// `COUNT(DISTINCT <relation>.id)`: the target's primary column
	const [primary] = target.primaryColumns;

	return (
		`(SELECT COUNT(DISTINCT ${column(joined, primary.databaseName)})` +
		` FROM ${table(relation.junctionEntityMetadata.tablePath)} ${junction}` +
		` INNER JOIN ${table(target.tablePath)} ${joined} ON ${onTarget.join(' AND ')}` +
		` WHERE ${onParent.join(' AND ')})`
	);
}

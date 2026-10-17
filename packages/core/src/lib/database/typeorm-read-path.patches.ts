import { RelationIdAttribute } from 'typeorm/query-builder/relation-id/RelationIdAttribute';
import { RelationIdMetadataToAttributeTransformer } from 'typeorm/query-builder/relation-id/RelationIdMetadataToAttributeTransformer';
import type { RelationIdMetadata } from 'typeorm/metadata/RelationIdMetadata';
import type { EntityMetadata } from 'typeorm/metadata/EntityMetadata';
import { Broadcaster } from 'typeorm/subscriber/Broadcaster';
import { QueryBuilder } from 'typeorm/query-builder/QueryBuilder';

/**
 * Two read-path optimisations of TypeORM (1.1.2, the latest release), applied once when the database module loads.
 * Measured with a CPU profile of the API under load: about half of the API's CPU was spent inside TypeORM, a fifth
 * of it in its relation-id loader.
 *
 * 1. **Relation ids that duplicate a column are not re-derived on reads.** Every Gauzy entity inherits five
 *    `@RelationId` properties — `createdByUserId`, `updatedByUserId`, `deletedByUserId`, `tenantId`,
 *    `organizationId` — that are ALSO plain columns on the very foreign key the relation uses
 *    (`@MultiORMColumn({ relationId: true })`). TypeORM hydrates the column from the row, and then, for every
 *    `@RelationId` of the main entity and of every joined entity, runs its relation-id loader over every row
 *    (string building, de-duplication, hashing) only to write the same value again. Such a relation id is skipped
 *    when a query is built: the property still holds exactly the value the column hydrated (the loader reads that
 *    same raw column), including null and absence when the column is not selected. The metadata itself is left
 *    as it is, because TypeORM's persistence uses it after a save (it fills `tenantId` from `tenant: { id }`).
 *    Only a to-one owning relation with a single join column whose property is that join column's column
 *    qualifies; to-many relation ids, custom-field relation ids and anything with a query-builder factory are
 *    untouched.
 * 2. **`RelationIdAttribute.relation` is computed once per attribute** instead of on every access — the loader
 *    reads it for every row and join column, and each read parsed the alias path and searched the metadata again.
 *
 * 3. **`Broadcaster.isAllowedSubscriber` is memoised per (subscriber, entity).** TypeORM filters its ~105 subscribers
 *    for every entity type of every load broadcast (per row group and per relation), calling each subscriber's
 *    `listenTo()` up to four times; the answer depends only on the subscriber and the entity class.
 * 4. **`QueryBuilder.replacePropertyNamesForTheWholeQuery` is memoised per statement.** For every query TypeORM
 *    rebuilds a replacement table from the aliases' metadata and runs one global regex over the whole SQL text
 *    (3.5% of the API's CPU in the profile). The result depends only on the statement text (parameters are
 *    placeholders at that point), the aliases' entities and the driver's quoting, so a bounded cache keyed by those
 *    returns the rewritten text of a statement already seen.
 *
 * `TYPEORM_SKIP_REDUNDANT_RELATION_IDS=false` turns all of it off.
 */

/** How many rewritten statements are kept (least recently used dropped); longer statements are never kept. */
const MAX_CACHED_STATEMENTS = 2000;
const MAX_CACHED_STATEMENT_LENGTH = 64 * 1024;

let applied = false;

/** Whether a relation id only repeats a column of the same entity on the same foreign key. */
export function isColumnBackedRelationId(relationId: RelationIdMetadata): boolean {
	const relation = relationId.relation;
	if (!relation || relationId.queryBuilderFactory) {
		return false;
	}
	if (!(relation.isManyToOne || relation.isOneToOneOwner) || relation.joinColumns.length !== 1) {
		return false;
	}
	const entityMetadata: EntityMetadata = relationId.entityMetadata;
	const column = entityMetadata.findColumnWithPropertyPath(relationId.propertyName);
	return !!column && column.databaseName === relation.joinColumns[0].databaseName;
}

const columnBacked = new WeakMap<RelationIdMetadata, boolean>();

function needsLoading(relationId: RelationIdMetadata): boolean {
	let backed = columnBacked.get(relationId);
	if (backed === undefined) {
		backed = isColumnBackedRelationId(relationId);
		columnBacked.set(relationId, backed);
	}
	return !backed;
}

export function applyTypeOrmReadPathPatches(env: NodeJS.ProcessEnv = process.env): boolean {
	if (
		String(env.TYPEORM_SKIP_REDUNDANT_RELATION_IDS ?? '')
			.trim()
			.toLowerCase() === 'false'
	) {
		return false;
	}
	if (applied) {
		return true;
	}

	const transformer = RelationIdMetadataToAttributeTransformer.prototype as any;
	if (typeof transformer.transform !== 'function' || typeof transformer.metadataToAttribute !== 'function') {
		// A TypeORM whose internals differ: leave it exactly as it is.
		return false;
	}
	// Same as TypeORM's own transform(), minus the column-backed relation ids.
	transformer.transform = function transform(this: any) {
		const expressionMap = this.expressionMap;
		if (expressionMap.mainAlias) {
			for (const relationId of expressionMap.mainAlias.metadata.relationIds) {
				if (needsLoading(relationId)) {
					expressionMap.relationIdAttributes.push(
						this.metadataToAttribute(expressionMap.mainAlias.name, relationId)
					);
				}
			}
		}
		expressionMap.joinAttributes.forEach((join: any) => {
			if (!join.metadata || join.metadata.isJunction) return;
			for (const relationId of join.metadata.relationIds) {
				if (needsLoading(relationId)) {
					expressionMap.relationIdAttributes.push(this.metadataToAttribute(join.alias.name, relationId));
				}
			}
		});
	};

	const descriptor = Object.getOwnPropertyDescriptor(RelationIdAttribute.prototype, 'relation');
	if (descriptor?.get) {
		const computed = new WeakMap<object, unknown>();
		Object.defineProperty(RelationIdAttribute.prototype, 'relation', {
			configurable: true,
			enumerable: descriptor.enumerable,
			get(this: object) {
				let relation = computed.get(this);
				if (relation === undefined) {
					relation = descriptor.get.call(this);
					computed.set(this, relation);
				}
				return relation;
			}
		});
	}

	const broadcaster = Broadcaster.prototype as any;
	const isAllowedSubscriber = broadcaster.isAllowedSubscriber;
	if (typeof isAllowedSubscriber === 'function') {
		const allowed = new WeakMap<object, WeakMap<object, boolean>>();
		broadcaster.isAllowedSubscriber = function memoisedIsAllowedSubscriber(
			this: any,
			subscriber: any,
			target: any
		) {
			const cacheable =
				subscriber &&
				typeof subscriber === 'object' &&
				(typeof target === 'function' || (typeof target === 'object' && target !== null));
			if (!cacheable) {
				return isAllowedSubscriber.call(this, subscriber, target);
			}
			let byTarget = allowed.get(subscriber);
			if (!byTarget) allowed.set(subscriber, (byTarget = new WeakMap()));
			let answer = byTarget.get(target);
			if (answer === undefined) {
				answer = isAllowedSubscriber.call(this, subscriber, target);
				byTarget.set(target, answer);
			}
			return answer;
		};
	}

	const replaceNames = (QueryBuilder.prototype as any).replacePropertyNamesForTheWholeQuery;
	if (typeof replaceNames === 'function') {
		const rewritten = new Map<string, string>();
		(QueryBuilder.prototype as any).replacePropertyNamesForTheWholeQuery = function memoisedReplace(
			this: any,
			statement: string
		) {
			const map = this.expressionMap;
			if (typeof statement !== 'string' || statement.length > MAX_CACHED_STATEMENT_LENGTH || !map?.aliases) {
				return replaceNames.call(this, statement);
			}
			let key = `${map.aliasNamePrefixingEnabled ? 1 : 0}|${this.connection?.name ?? ''}|${this.connection?.options?.type ?? ''}|`;
			for (const alias of map.aliases) {
				if (alias.hasMetadata) key += `${alias.name}=${alias.metadata.name};`;
			}
			key += statement;
			const hit = rewritten.get(key);
			if (hit !== undefined) {
				// Most recently used last, so the first entry is the one to drop.
				rewritten.delete(key);
				rewritten.set(key, hit);
				return hit;
			}
			const result = replaceNames.call(this, statement);
			rewritten.set(key, result);
			if (rewritten.size > MAX_CACHED_STATEMENTS) {
				rewritten.delete(rewritten.keys().next().value as string);
			}
			return result;
		};
	}

	applied = true;
	return true;
}

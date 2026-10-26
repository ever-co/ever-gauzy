import { Reference, ReferenceKind, Utils, wrap } from '@mikro-orm/core';

/**
 * A MikroORM entity serialized as TypeORM answers it: a to-one relation the read did not load is left out.
 *
 * `CrudService.serialize()` answers `wrap(entity).toJSON()` under MikroORM, and MikroORM writes an unloaded
 * reference as its primary key (`productType: '<uuid>'`, `tenant: '<uuid>'`), where a TypeORM row simply has no
 * such member — only its `xId` column, which both ORMs answer. A client reading the relation as an object then
 * reads a string: a GraphQL selection such as `productType { name }` on a product whose type was not loaded
 * failed with a string where an object type is declared, and `row.organization.id` answered `undefined`. The
 * relation is therefore left out, at every level of what the read did load (a loaded relation's own unloaded
 * references, the items of a loaded collection). A loaded relation, a `null` relation and every other member are
 * answered as MikroORM serialized them.
 *
 * @param entity The entity MikroORM loaded.
 * @param json What `wrap(entity).toJSON()` answered for it.
 * @returns The same object, without the unloaded to-one relations.
 */
export function withoutUnloadedReferences<J>(entity: unknown, json: J): J {
	strip(entity, json, new Set());
	return json;
}

function strip(entity: unknown, json: unknown, seen: Set<unknown>): void {
	if (!entity || typeof entity !== 'object' || !json || typeof json !== 'object' || seen.has(entity)) {
		return;
	}
	if (!Utils.isEntity(entity)) {
		return;
	}
	seen.add(entity);

	const meta = wrap(entity, true).__meta;
	const row = entity as Record<string, unknown>;
	const out = json as Record<string, unknown>;

	for (const relation of meta.relations) {
		if (!(relation.name in out)) {
			continue;
		}

		const value = row[relation.name];

		if (relation.kind === ReferenceKind.MANY_TO_ONE || relation.kind === ReferenceKind.ONE_TO_ONE) {
			const target = Reference.isReference(value) ? value.unwrap() : value;
			if (!target || typeof target !== 'object') {
				continue;
			}
			if (Utils.isEntity(target) && !wrap(target, true).isInitialized()) {
				delete out[relation.name];
				continue;
			}
			strip(target, out[relation.name], seen);
			continue;
		}

		// A loaded collection: its items are serialized rows of their own.
		const items = out[relation.name];
		if (Array.isArray(items) && Utils.isCollection(value) && value.isInitialized()) {
			value.getItems(false).forEach((item, index) => strip(item, items[index], seen));
		}
	}
}

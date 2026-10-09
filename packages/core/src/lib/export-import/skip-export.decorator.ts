import { isFunction } from '@gauzy/utils';

/**
 * Reflect metadata key carrying the "never put this entity in an export archive" marker.
 */
export const SKIP_EXPORT_METADATA = 'skipExport';

/**
 * Marks an entity as **derived data** that must never leave the system in an export archive.
 *
 * Every plugin entity is otherwise registered for export automatically
 * (`RepositoriesService.createDynamicInstanceForPluginEntities()`), which is right for the records
 * a tenant authored and wrong for tables the platform can rebuild from those records. The Documents
 * knowledge tables are the motivating case: `document_chunk` holds the full extracted text of every
 * uploaded file and `document_index_state` its embeddings, so an "export my organization" archive
 * would ship a second, plain-text copy of documents whose access control lives entirely on the
 * `document` row (`02-domain-model.md` §15/§20, `08-permissions-security.md` §10.3/§11).
 *
 * The entity stays registered with the ORM — this marker only removes it from the export/import
 * repository graph. After an import the knowledge tables are rebuilt by re-indexing the imported
 * documents, which is also what keeps embeddings consistent with the current model version.
 *
 * @example
 * ```ts
 * @SkipExport()
 * @MultiORMEntity('document_chunk')
 * export class DocumentChunk extends TenantOrganizationBaseEntity {}
 * ```
 *
 * @see skipExport for the imperative form, when the entity class cannot be decorated in place.
 */
export function SkipExport(): ClassDecorator {
	return (target: Function) => {
		Reflect.defineMetadata(SKIP_EXPORT_METADATA, true, target);
	};
}

/**
 * Imperative equivalent of {@link SkipExport} — marks entity classes from outside their own file.
 *
 * Useful where the marker belongs to the plugin's composition root rather than to the entity, e.g.
 * a plugin that registers entities it does not own.
 *
 * @param entities - The entity classes to exclude from export archives.
 */
export function skipExport(...entities: Function[]): void {
	for (const entity of entities) {
		if (isFunction(entity)) {
			Reflect.defineMetadata(SKIP_EXPORT_METADATA, true, entity);
		}
	}
}

/**
 * Whether an entity carries the skip-export marker.
 *
 * 🛑 Reads OWN metadata deliberately. `Reflect.getMetadata` walks the prototype chain, so an entity
 * that merely extends a marked one would inherit the exclusion and vanish from exports silently —
 * exactly the class of quiet data loss this seam exists to prevent in the other direction.
 *
 * @param entity - The entity class to test.
 * @returns `true` when the entity must be left out of export archives.
 */
export function isExportSkipped(entity: Function): boolean {
	return isFunction(entity) && Reflect.getOwnMetadata(SKIP_EXPORT_METADATA, entity) === true;
}

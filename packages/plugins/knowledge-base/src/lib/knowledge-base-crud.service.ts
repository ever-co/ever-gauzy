import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the knowledge-base services: they keep every caller inside the platform's organization boundary.
 *
 * `TenantAwareCrudService` used to narrow the knowledge-base services to the caller's tenant only, and the routes every
 * service inherits address rows through it — `GET /:id`, the update's pre-read, the withdraw/restore pair, the
 * article's versioning, duplicate and restore — while its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no
 * read at all. A caller of one organization could therefore read, rewrite, duplicate, withdraw, restore and delete
 * another organization's knowledge bases, categories, articles, article versions and authors by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id
 * of such a row answers `affected: 0`, as for an id that names no row. The article's hand-written description queries
 * keep to the same boundary. A request with no signed-in caller (the seeder, a job) is not confined.
 */
export abstract class KnowledgeBaseCrudService<
	T extends TenantOrganizationBaseEntity
> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the knowledge-base services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

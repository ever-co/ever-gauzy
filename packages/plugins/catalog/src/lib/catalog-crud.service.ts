import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the catalog services: they keep every caller inside the platform's organization boundary.
 *
 * The catalog's own references are checked against the caller's scope (`callerScope`), but `TenantAwareCrudService`
 * used to narrow the catalog services to the caller's tenant only, and the routes every service inherits address rows
 * through it — `GET /:id`, the update's pre-read, the withdraw/restore pair — while its `delete(id)` ran
 * `DELETE … WHERE id AND tenantId` with no read at all. A caller of one organization could therefore read, rewrite,
 * withdraw, restore and delete another organization's collections, channel listings, product relations, variant media
 * and tags by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id of
 * such a row removes nothing and answers `affected: 0`, as for an id that names no row.
 */
export abstract class CatalogCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the catalog services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

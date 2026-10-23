import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the warehouse services: they keep every caller inside the platform's organization boundary.
 *
 * The warehouse's own reads and writes go through `findOneScoped`, which states the request's organization, but
 * `TenantAwareCrudService` used to narrow the warehouse services to the caller's tenant only, and the routes every
 * service inherits address rows through it — the withdraw/restore pair — while its `delete(id)` ran
 * `DELETE … WHERE id AND tenantId` with no read at all. A caller of one organization could therefore withdraw and
 * restore another organization's zones, bins, pick waves, pick lists and their lines, pack slips and carrier manifests,
 * and erase its manifests, pack slips, pick lists, pick waves and pick-list lines, by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id of
 * such a row removes nothing and answers `affected: 0`, as for an id that names no row.
 */
export abstract class WarehouseCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the warehouse services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

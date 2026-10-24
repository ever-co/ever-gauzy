import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the fulfilment services: they keep every caller inside the platform's organization boundary.
 *
 * `TenantAwareCrudService` used to narrow the fulfilment services to the caller's tenant only, and the routes every
 * service inherits address rows through it — `GET /:id`, the update's pre-read, the restore — as do the shipment
 * lifecycle writes (`ship`, `in-transit`, `deliver`, `cancel`, `label`), which then write under the organization of the
 * row they read. Its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no read at all. A caller of one organization
 * could therefore read and advance another organization's shipments, rewrite and restore its shipping options and
 * profiles, and delete them by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id
 * of such a row answers `affected: 0`, as for an id that names no row, so the GraphQL `delete*` fields answer `false`.
 */
export abstract class FulfillmentCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the fulfilment services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

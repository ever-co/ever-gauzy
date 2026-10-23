import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the purchasing services: they keep every caller inside the platform's organization boundary.
 *
 * The purchasing operations read through `findOneScoped` and state the request's organization in their removals, but
 * `TenantAwareCrudService` used to narrow the purchasing services to the caller's tenant only, and the routes every
 * service inherits address rows through it — `GET /:id` (order lines, receipt lines), the update's pre-read (receipts
 * and their lines), the restore — while its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no read at all. A
 * caller of one organization could therefore read another organization's purchase-order and receipt lines, rewrite its
 * goods receipts and their lines, and restore its purchase orders, receipts and vendor terms by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id of
 * such a row removes nothing and answers `affected: 0`, as for an id that names no row.
 */
export abstract class PurchasingCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the purchasing services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the cart services: they keep every caller inside the platform's organization boundary.
 *
 * `TenantAwareCrudService` used to narrow the cart services to the caller's tenant only, and the routes every service
 * inherits address rows through it — `GET /:id`, the update's pre-read, the withdraw/restore pair — as do the cart's
 * own operations, which read the cart by id before they write it (add and change lines, shipping, promotions, merge,
 * abandon, complete), while its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no read at all. A caller of one
 * organization could therefore read and rewrite another organization's carts, lines, promotions, shipping methods and
 * checkout sessions, merge another organization's cart into its own, and delete them by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id
 * of such a row answers `affected: 0`, as for an id that names no row, so `deleteCart` and
 * `deleteCommerceCheckoutSession` answer `false`. A request with no signed-in caller (the expiry and abandonment
 * sweeps) is not confined.
 */
export abstract class CartCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the cart services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

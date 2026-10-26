import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the subscription services: they keep every caller inside the platform's organization boundary.
 *
 * The subscription operations read through `findOneScoped` and `currentScope()`, but `TenantAwareCrudService` used to
 * narrow what every service inherits to the caller's tenant only — the withdraw/restore pair read the row by id within
 * the tenant — and its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no read at all. A caller of one
 * organization could therefore withdraw, restore and delete another organization's subscriptions, plans, items and
 * billing cycles by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id
 * of such a row answers `affected: 0`, as for an id that names no row. A request with no signed-in caller (the billing
 * run, a provider webhook) is not confined.
 */
export abstract class SubscriptionCrudService<
	T extends TenantOrganizationBaseEntity
> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the subscription services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

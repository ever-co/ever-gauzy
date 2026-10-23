import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the entitlement services: they keep every caller inside the platform's organization boundary.
 *
 * The entitlement operations read through `findOneScoped`, but `TenantAwareCrudService` used to narrow what every
 * service inherits to the caller's tenant only — the update's pre-read (activations) and the withdraw/restore pair,
 * which every removal route of this plugin reaches (no route hard-deletes a right, a key or an activation). A caller of
 * one organization could therefore rewrite another organization's activations, and withdraw and restore its
 * entitlements, keys and activations by naming their ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read of the base, and no write reaches it. A request with
 * no signed-in caller (a job) is not confined.
 */
export abstract class EntitlementCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the entitlement services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

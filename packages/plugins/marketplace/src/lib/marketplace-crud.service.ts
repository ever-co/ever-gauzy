import { TenantAwareCrudService, TenantOrganizationBaseEntity } from '@gauzy/core';

/**
 * The CRUD base of the marketplace services: they keep every caller inside the platform's organization boundary.
 *
 * The marketplace's own reads (`getSeller`, the seller-scoped lists and reads) state the request's organization, but
 * `TenantAwareCrudService` used to narrow the marketplace services to the caller's tenant only, and the routes every
 * service inherits address rows through it — the update's pre-read (payouts and settlements), the withdraw/restore
 * pair — while its `delete(id)` ran `DELETE … WHERE id AND tenantId` with no read at all. A caller of one organization
 * could therefore rewrite another organization's payouts and settlements, withdraw and restore its sellers, offerings
 * and ledger rows, and erase its sellers, seller transactions, payouts, payout lines and settlements by naming their
 * ids.
 *
 * The rule is the platform's, applied by the base (`appliesOrganizationBoundary`): a tenant admin reaches every
 * organization of the tenant; anyone else only the organization of their token, and the rows stored without one. A row
 * outside the boundary is answered as a missing row by every read, and no write or delete reaches it: a delete by id of
 * such a row removes nothing and answers `affected: 0`, the count the delete fields project for an id that names no
 * row.
 */
export abstract class MarketplaceCrudService<T extends TenantOrganizationBaseEntity> extends TenantAwareCrudService<T> {
	/**
	 * @returns True: the marketplace services keep every caller inside the organization boundary.
	 */
	protected override appliesOrganizationBoundary(): boolean {
		return true;
	}
}

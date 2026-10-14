/**
 * The scope an inventory request acts in, and the checks every domain verb runs against it.
 *
 * Every verb of this package loads its document inside the transaction that writes it, and the load is
 * what decides whose stock the write moves. A load by identifier alone made the identifier the whole
 * authorisation: a caller who knew the id of another tenant's hold, draft, transfer or count could
 * consume, apply, ship, receive, close or cancel it, and a create that named another tenant's location
 * and variant moved that tenant's level (review R2-01). Purchasing and warehouse scope every such load by
 * the request's tenant and organization; these helpers are how inventory does the same, stated once.
 *
 * **A caller with no tenant is a system caller and is not narrowed.** The reservation expiry sweep the
 * worker runs has no request, and it spans every tenant by design — exactly as the package's scoped
 * reads already treat such a caller. A request that carries a tenant but no organization is narrowed to
 * the tenant alone.
 *
 * The organization is added only when the request has one, and never as `organizationId: null`: the
 * platform's connections run with `invalidWhereValuesBehavior.null = 'sql-null'`, so a null would turn
 * "no organization stated" into "only rows that have no organization", which is a different question.
 */
import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { ProductVariant, RequestContext, Warehouse } from '@gauzy/core';
import { InventoryErrorCode, inventoryError } from './inventory.errors';

/** The tenant and organization a request acts in; either member is absent when the request states none. */
export interface IInventoryScope {
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * The tenant and organization of the current request, as `where` members.
 *
 * Spread it into a load (`{ id, ...requestScope() }`) so a document of another tenant, or of another
 * organization of the caller's tenant, is not found rather than acted on.
 *
 * @returns The scope, empty for a caller with no request.
 */
export function requestScope(): IInventoryScope {
	const tenantId = RequestContext.currentTenantId();
	const organizationId = RequestContext.currentOrganizationId();

	return {
		...(tenantId ? { tenantId } : {}),
		...(organizationId ? { organizationId } : {})
	};
}

/**
 * The tenant of the current request alone, as a `where` member.
 *
 * The ledger engine is the write path every package moves stock through — warehouse, purchasing and
 * returns as well as this one — so it holds the line every caller shares, which is the tenant.
 *
 * @returns The scope, empty for a caller with no request.
 */
export function requestTenantScope(): IInventoryScope {
	const tenantId = RequestContext.currentTenantId();

	return tenantId ? { tenantId } : {};
}

/**
 * Whether a row exists inside a scope.
 *
 * A scope with no tenant is a system caller's, for which every row is in scope, so nothing is read.
 *
 * @param manager The transaction, or the manager, the caller reads through.
 * @param entity The entity the row belongs to.
 * @param id The row.
 * @param scope The scope it has to be in.
 * @returns True when the row is in the scope.
 */
export async function existsInScope(
	manager: EntityManager,
	entity: EntityTarget<ObjectLiteral>,
	id: ID | null | undefined,
	scope: IInventoryScope
): Promise<boolean> {
	if (!scope.tenantId) {
		return true;
	}
	if (!id) {
		return false;
	}

	return (await manager.count(entity, { where: { id, ...scope } as never })) > 0;
}

/**
 * Refuses a location the caller may not stock, as one that does not exist.
 *
 * Not found rather than forbidden, so the answer for another tenant's location is the answer for an
 * identifier nobody holds and the refusal confirms nothing about it.
 *
 * @param manager The transaction, or the manager, the caller reads through.
 * @param warehouseId The location the caller named.
 * @param scope The scope it has to be in; the request's tenant and organization by default.
 * @throws NotFoundException with `STOCK_LOCATION_NOT_FOUND`.
 */
export async function assertLocationInScope(
	manager: EntityManager,
	warehouseId: ID | null | undefined,
	scope: IInventoryScope = requestScope()
): Promise<void> {
	if (!(await existsInScope(manager, Warehouse, warehouseId, scope))) {
		throw inventoryError(InventoryErrorCode.LOCATION_NOT_FOUND, 'The location does not exist.', {
			notFound: true,
			details: { warehouseId }
		});
	}
}

/**
 * Refuses a variant the caller may not stock, as one that does not exist.
 *
 * @param manager The transaction, or the manager, the caller reads through.
 * @param variantId The variant the caller named.
 * @param scope The scope it has to be in; the request's tenant and organization by default.
 * @throws NotFoundException with `STOCK_VARIANT_NOT_FOUND`.
 */
export async function assertVariantInScope(
	manager: EntityManager,
	variantId: ID | null | undefined,
	scope: IInventoryScope = requestScope()
): Promise<void> {
	if (!(await existsInScope(manager, ProductVariant, variantId, scope))) {
		throw inventoryError(InventoryErrorCode.VARIANT_NOT_FOUND, 'The product variant does not exist.', {
			notFound: true,
			details: { variantId }
		});
	}
}

import { ForbiddenException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';

/**
 * The seller scope a request runs under.
 *
 * Seller isolation is additive to tenant and organization scoping: it narrows a query that is already
 * tenant- and organization-filtered, and it can never widen one. It is attached to the request by the
 * seller access guard and is a **required first argument** of every seller-scoped service method, so
 * such a method cannot be written without one.
 */
export interface ISellerScope {
	/** The seller the caller may act as. */
	sellerId: ID;
	/** The party the caller is acting through, when the caller is the seller's own person. */
	contactId?: ID;
	/** The role the caller holds on the seller's party; the capability set it implies is applied by the guard. */
	role?: string;
	/** True when the caller reached the route through a staff marketplace permission. */
	staff: boolean;
	/** The channel the request resolved, when the resource is channel scoped. */
	channelId?: ID;
}

/**
 * Refuses a request that names a seller outside the caller's membership set.
 *
 * The refusal is explicit rather than an empty page: a seller-scoped caller that guesses another
 * seller's id learns that it guessed, instead of receiving a result set that is indistinguishable
 * from "this seller has no rows".
 *
 * @param scope The resolved scope.
 * @param sellerId The seller the request names.
 * @throws ForbiddenException when the two differ.
 */
export function assertSellerScope(scope: ISellerScope | undefined, sellerId?: ID): void {
	if (!scope) {
		throw new ForbiddenException('This credential is not valid for any seller.');
	}

	if (sellerId && scope.sellerId !== sellerId) {
		throw new ForbiddenException(`This credential is not valid for seller '${sellerId}'.`);
	}
}

/**
 * The seller predicate a seller-scoped read applies.
 *
 * Applied at the query builder rather than by filtering a page in memory, so a caller can never
 * receive a row it may not see and then have it removed. A channel-scoped resource applies the
 * channel predicate **in addition to** this one, never instead of it.
 *
 * @param queryBuilder The query being narrowed.
 * @param scope The resolved scope.
 * @param alias The alias the seller column is read through.
 * @returns The narrowed query builder.
 */
export function applySellerScope<T>(queryBuilder: T, scope: ISellerScope, alias = 'seller'): T {
	const builder = queryBuilder as unknown as {
		andWhere(clause: string, parameters?: Record<string, any>): T;
	};

	// `alias.sellerId` rather than `alias."sellerId"`: a raw fragment is passed to the driver
	// untouched, and MySQL reads the double quotes as a string literal — so every seller-scoped read
	// raised there instead of narrowing. The builder resolves the property itself and quotes it for
	// whichever dialect is configured.
	return builder.andWhere(`${alias}.sellerId = :sellerScopeId`, { sellerScopeId: scope.sellerId });
}

/**
 * The seller scope for a staff caller, who is not narrowed by membership.
 *
 * A staff caller holding a marketplace permission resolves the seller it names; the tenant and
 * organization predicates still apply, which is why this is a scope and not a bypass.
 *
 * @param sellerId The seller the request targets, when it targets one.
 * @returns The scope.
 */
export function staffSellerScope(sellerId?: ID): ISellerScope {
	return { sellerId, staff: true } as ISellerScope;
}

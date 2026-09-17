import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { ISellerScope } from './seller-scope';

/**
 * Resolves the seller a request may act as.
 *
 * The guard is a seam rather than a policy engine: it resolves the seller scope from the request and
 * attaches it, and it delegates the question "is this caller a member of this seller's party" to a
 * resolver the contact package registers. That keeps the marketplace from depending on the shape of
 * the contact-buyer pivot while still making the scope mandatory — a seller-scoped route cannot run
 * without one.
 */
export interface ISellerMembershipResolver {
	/**
	 * @param contactId The party whose membership is being asked about.
	 * @param callerContactId The caller's own party, when it has one.
	 * @returns The role the caller holds on that party, or null when it holds none.
	 */
	resolveRole(contactId: ID, callerContactId?: ID): Promise<string | null>;
}

/** The token a package registers its membership resolver under. */
export const SELLER_MEMBERSHIP_RESOLVER = 'SELLER_MEMBERSHIP_RESOLVER';

/**
 * Every marketplace permission that lets a staff caller read a seller, and the ones that let it write.
 */
const STAFF_READ_PERMISSIONS: string[] = [
	PermissionsEnum.SELLERS_VIEW,
	PermissionsEnum.SELLER_OFFERINGS_VIEW,
	PermissionsEnum.SELLER_TRANSACTIONS_VIEW,
	PermissionsEnum.SELLER_PAYOUTS_VIEW,
	PermissionsEnum.SELLER_SETTLEMENTS_VIEW,
	PermissionsEnum.SELLER_COMMISSIONS_VIEW
];

const STAFF_WRITE_PERMISSIONS: string[] = [
	PermissionsEnum.SELLERS_CREATE,
	PermissionsEnum.SELLERS_EDIT,
	PermissionsEnum.SELLERS_DELETE,
	PermissionsEnum.SELLER_OFFERINGS_EDIT,
	PermissionsEnum.SELLER_TRANSACTIONS_SETTLE,
	PermissionsEnum.SELLER_PAYOUTS_CREATE,
	PermissionsEnum.SELLER_PAYOUTS_APPROVE,
	PermissionsEnum.SELLER_PAYOUTS_CANCEL,
	PermissionsEnum.SELLER_SETTLEMENTS_EDIT,
	PermissionsEnum.SELLER_COMMISSIONS_EDIT
];

/**
 * Mounts the seller scope on the marketplace routes.
 *
 * The resolution order is: a staff caller holding a marketplace permission is allowed and the scope
 * records that it is staff; otherwise the caller must be one of the seller's own people, resolved
 * through the membership resolver, and the scope carries the role. Anything else is refused — with a
 * named seller in the message when the caller named one it does not own, and without one when it has
 * no membership at all.
 */
@Injectable()
export class SellerAccessGuard implements CanActivate {
	constructor(private readonly membershipResolver?: ISellerMembershipResolver) {}

	/**
	 * @param context The execution context.
	 * @returns True when the request may proceed.
	 * @throws ForbiddenException when the caller has no scope over the seller it named.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const sellerId = this.resolveRequestedSellerId(request);

		if (this.isStaffCaller(request)) {
			request.sellerScope = { sellerId, staff: true, channelId: this.resolveChannelId(request) } as ISellerScope;
			return true;
		}

		if (!sellerId) {
			throw new ForbiddenException('This credential is not valid for any seller.');
		}

		const contactId = RequestContext.currentUser()?.id as ID | undefined;
		const role = await this.membershipResolver?.resolveRole(sellerId, contactId);

		if (!role) {
			// A named seller the caller does not own is refused by name, so the caller learns that it
			// guessed rather than silently receiving an empty result set.
			throw new ForbiddenException(`This credential is not valid for seller '${sellerId}'.`);
		}

		request.sellerScope = {
			sellerId,
			contactId,
			role,
			staff: false,
			channelId: this.resolveChannelId(request)
		} as ISellerScope;

		return true;
	}

	/**
	 * Whether the caller reached the route through a staff marketplace permission.
	 *
	 * @param request The request.
	 * @returns True when the caller holds a marketplace permission.
	 */
	private isStaffCaller(request: any): boolean {
		const permissions = [...STAFF_READ_PERMISSIONS, ...STAFF_WRITE_PERMISSIONS];

		return permissions.some((permission) => RequestContext.hasPermission(permission as PermissionsEnum));
	}

	/**
	 * The seller the request names, in the order the platform accepts it: an explicit query parameter,
	 * the `X-Seller-Id` header, then the target row's own seller when the request carries one.
	 *
	 * @param request The request.
	 * @returns The seller id, or undefined when the request names none.
	 */
	private resolveRequestedSellerId(request: any): ID | undefined {
		return (
			(request.query?.sellerId as ID) ??
			(request.headers?.['x-seller-id'] as ID) ??
			(request.body?.sellerId as ID) ??
			(request.params?.sellerId as ID)
		);
	}

	/**
	 * The channel the request resolved, which a channel-scoped read applies **in addition** to the
	 * seller predicate.
	 *
	 * @param request The request.
	 * @returns The channel id, or undefined when the request is not channel scoped.
	 */
	private resolveChannelId(request: any): ID | undefined {
		return (request.query?.channelId as ID) ?? (request.headers?.['x-channel-id'] as ID);
	}
}

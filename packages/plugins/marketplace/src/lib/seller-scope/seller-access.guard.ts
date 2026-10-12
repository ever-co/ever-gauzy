import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { FindOptionsWhere } from 'typeorm';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
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
	 * @param contactId The party whose membership is being asked about — the seller's own party,
	 * `Seller.contactId`, never the seller row's id. The marketplace holds the participation; the
	 * party is what the contact package knows how to answer about, which is why the seller row is read
	 * here and its party handed over rather than its own identifier.
	 * @param callerUserId The caller's own platform user, which the registrar maps onto a membership of
	 * that party.
	 * @returns The role the caller holds on that party, or null when it holds none.
	 */
	resolveRole(contactId: ID, callerUserId?: ID): Promise<string | null>;
}

/** The token a package registers its membership resolver under. */
export const SELLER_MEMBERSHIP_RESOLVER = 'SELLER_MEMBERSHIP_RESOLVER';

/**
 * Every marketplace permission that lets a staff caller read a seller, and the ones that let it write.
 *
 * The two lists are the fallback the guard reaches for when the handler it is protecting declares no
 * permission of its own. They are deliberately *not* the test for a route that does declare one: see
 * `isStaffCaller`.
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
 * Mounts the seller scope on the marketplace routes and on the marketplace's GraphQL fields.
 *
 * **Membership is resolved before staffness, and that ordering is the correction.** The guard used to
 * ask "does this caller hold any marketplace permission" first and, if it did, hand back
 * `{ staff: true }` — which short-circuits `assertSellerScope` in every service. But a seller's own
 * person cannot reach a marketplace route at all without holding the route's marketplace permission,
 * because `PermissionGuard` runs before this guard and refuses anybody who does not: so the first
 * question was one every caller that got this far answered "yes" to, and the guard could never produce
 * a seller-narrowed scope for anybody. The isolation the README promises — "a seller sees its own rows
 * and nothing else" — was unreachable, not merely unused. Asking about membership first is what makes
 * it reachable: a caller the membership resolver recognises as one of the seller's own people is that
 * seller and is narrowed to it, and only a caller with no membership at all is staff.
 *
 * **Staffness is per route rather than per package.** The permission the handler itself declares is
 * what the caller has to hold to be staff *on that handler*, read from the same `PERMISSIONS_METADATA`
 * that `PermissionGuard` reads with the same precedence. Holding one of the sixteen marketplace grants
 * used to make a caller staff for all of them; now `SELLERS_VIEW` makes nobody staff on a payout route.
 * The package-wide lists above stay as the fallback for a handler that declares no permission, so a
 * route added without one is no weaker than it was.
 *
 * **Both transports reach the same object.** A GraphQL field is executed with the root, the arguments,
 * the context and the field info in the positions `switchToHttp()` reads, so asking it for a request on
 * a resolver hands back the GraphQL root — and `request.query` on it threw a `TypeError` for every
 * field. The request is therefore resolved per execution type, the seller a field names is read from
 * its arguments as well as from the query string, header, body and route parameters, and the resolved
 * scope is attached to the GraphQL context as well as to the request behind it so a resolver can read
 * it whichever the server built.
 */
@Injectable()
export class SellerAccessGuard implements CanActivate {
	/**
	 * The membership resolver is a seam a consuming package may fill, not a requirement.
	 *
	 * It is injected optionally and by token: the token is what a registrar provides, and optional
	 * because the marketplace must work in an installation that never registers one. Without the
	 * decorators Nest tries to resolve the parameter's emitted type, which for an interface is
	 * `Object`, and refuses to start the application — so the seam would be a dependency on the
	 * very package it exists to avoid depending on.
	 *
	 * The seller repository is not optional: resolving membership means handing the resolver the
	 * seller's *party*, and the party is a column of the seller row. Every module that mounts this
	 * guard already provides the repository for its own reads.
	 *
	 * @param sellerRepository The seller table, read to translate a seller into the party it hangs off.
	 * @param reflector The platform's metadata reader, used for the handler's declared permission.
	 * @param membershipResolver The seam a consuming package fills, when one does.
	 */
	constructor(
		private readonly sellerRepository: TypeOrmSellerRepository,
		private readonly reflector: Reflector,
		@Optional()
		@Inject(SELLER_MEMBERSHIP_RESOLVER)
		private readonly membershipResolver?: ISellerMembershipResolver
	) {}

	/**
	 * @param context The execution context.
	 * @returns True when the request may proceed.
	 * @throws ForbiddenException when the caller has no scope over the seller it named.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = this.requestOf(context);
		const sellerId = this.resolveRequestedSellerId(context, request);
		const channelId = this.resolveChannelId(context, request);

		const membership = await this.resolveMembership(sellerId);

		if (membership) {
			// The caller is one of this seller's own people. It is narrowed to that seller even where it
			// also holds a staff permission: acting through a seller's party is acting as that seller.
			this.attach(context, request, {
				sellerId,
				contactId: membership.contactId,
				role: membership.role,
				staff: false,
				channelId
			} as ISellerScope);

			return true;
		}

		if (this.isStaffCaller(context)) {
			this.attach(context, request, { sellerId, staff: true, channelId } as ISellerScope);

			return true;
		}

		if (!sellerId) {
			throw new ForbiddenException('This credential is not valid for any seller.');
		}

		// A named seller the caller does not own is refused by name, so the caller learns that it
		// guessed rather than silently receiving an empty result set.
		throw new ForbiddenException(`This credential is not valid for seller '${sellerId}'.`);
	}

	/**
	 * The membership the caller holds on the named seller's party, when it holds one.
	 *
	 * The resolver is asked about `Seller.contactId` — the party the seller account hangs off — and not
	 * about the seller row's own id: the seam exists so the contact package can answer "is this user one
	 * of that party's people", a question the seller's identifier is not an argument to. Asking it with
	 * the wrong identifier is indistinguishable from a caller holding no membership, which is how a
	 * genuine seller member came to be refused by name on every seller-scoped route.
	 *
	 * @param sellerId The seller the request named.
	 * @returns The role and the party it is held on, or null when there is no membership to resolve.
	 */
	private async resolveMembership(sellerId?: ID): Promise<{ role: string; contactId: ID } | null> {
		if (!sellerId || !this.membershipResolver) {
			return null;
		}

		const seller = await this.sellerRepository.findOne({
			where: {
				id: sellerId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as FindOptionsWhere<Seller>
		});

		if (!seller?.contactId) {
			return null;
		}

		const callerUserId = RequestContext.currentUser()?.id as ID | undefined;
		const role = await this.membershipResolver.resolveRole(seller.contactId, callerUserId);

		return role ? { role, contactId: seller.contactId } : null;
	}

	/**
	 * Whether the caller reached this handler through the staff permission the handler requires.
	 *
	 * @param context The execution context.
	 * @returns True when the caller holds the handler's own permission, or — for a handler that declares
	 * none — any marketplace permission.
	 */
	private isStaffCaller(context: ExecutionContext): boolean {
		const declared = this.declaredPermissions(context);
		const permissions = declared.length ? declared : [...STAFF_READ_PERMISSIONS, ...STAFF_WRITE_PERMISSIONS];

		return permissions.some((permission) => RequestContext.hasPermission(permission as PermissionsEnum));
	}

	/**
	 * The permissions the handler declares, read the way `PermissionGuard` reads them.
	 *
	 * `getAllAndOverride` is the same precedence the platform's own guard applies: a permission on the
	 * handler replaces the class's rather than adding to it, which is what makes a controller's
	 * class-level read permission the default and each write route's own permission the one that counts.
	 *
	 * @param context The execution context.
	 * @returns The declared permissions, or an empty list when the handler declares none.
	 */
	private declaredPermissions(context: ExecutionContext): string[] {
		const declared = this.reflector?.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, [
			context.getHandler(),
			context.getClass()
		]);

		return (declared ?? []).filter((permission) => Boolean(permission));
	}

	/**
	 * The request behind the handler, whichever surface it is running on.
	 *
	 * @param context The execution context.
	 * @returns The request, or undefined when the operation has none.
	 */
	private requestOf(context: ExecutionContext): any {
		if (context.getType<'http' | 'graphql' | string>() === 'graphql') {
			return this.graphqlContext(context)?.req;
		}

		try {
			return context.switchToHttp().getRequest();
		} catch {
			return undefined;
		}
	}

	/**
	 * The GraphQL execution context, when the handler is running on one.
	 *
	 * @param context The execution context.
	 * @returns The context object the server built, or undefined.
	 */
	private graphqlContext(context: ExecutionContext): any {
		try {
			return GqlExecutionContext.create(context).getContext();
		} catch {
			return undefined;
		}
	}

	/**
	 * The arguments a GraphQL field was called with, which is where a field names its seller.
	 *
	 * @param context The execution context.
	 * @returns The arguments, or an empty object for a handler that has none.
	 */
	private graphqlArgs(context: ExecutionContext): any {
		if (context.getType<'http' | 'graphql' | string>() !== 'graphql') {
			return {};
		}

		try {
			return GqlExecutionContext.create(context).getArgs() ?? {};
		} catch {
			return {};
		}
	}

	/**
	 * Attaches the resolved scope where the handler's own surface will read it back.
	 *
	 * Both places are written because a GraphQL server does not have to carry a request: the context is
	 * the object the resolver is handed, the request is the object a controller is handed, and a scope
	 * that reached only one of them is a scope half the surface silently runs without.
	 *
	 * @param context The execution context.
	 * @param request The request, when the operation has one.
	 * @param scope The resolved scope.
	 */
	private attach(context: ExecutionContext, request: any, scope: ISellerScope): void {
		if (request) {
			request.sellerScope = scope;
		}

		const gqlContext = context.getType<'http' | 'graphql' | string>() === 'graphql' ? this.graphqlContext(context) : undefined;

		if (gqlContext && gqlContext !== request) {
			gqlContext.sellerScope = scope;
		}
	}

	/**
	 * The seller the request names, in the order the platform accepts it: a GraphQL field argument, an
	 * explicit query parameter, the `X-Seller-Id` header, then the target row's own seller when the
	 * request carries one.
	 *
	 * @param context The execution context.
	 * @param request The request, when the operation has one.
	 * @returns The seller id, or undefined when the request names none.
	 */
	private resolveRequestedSellerId(context: ExecutionContext, request: any): ID | undefined {
		const args = this.graphqlArgs(context);

		return (
			(args?.sellerId as ID) ??
			(request?.query?.sellerId as ID) ??
			(request?.headers?.['x-seller-id'] as ID) ??
			(request?.body?.sellerId as ID) ??
			(request?.params?.sellerId as ID)
		);
	}

	/**
	 * The channel the request resolved, which a channel-scoped read applies **in addition** to the
	 * seller predicate.
	 *
	 * @param context The execution context.
	 * @param request The request, when the operation has one.
	 * @returns The channel id, or undefined when the request is not channel scoped.
	 */
	private resolveChannelId(context: ExecutionContext, request: any): ID | undefined {
		const args = this.graphqlArgs(context);

		return (
			(args?.channelId as ID) ??
			(request?.query?.channelId as ID) ??
			(request?.headers?.['x-channel-id'] as ID)
		);
	}
}

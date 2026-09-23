import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderClaim, OrderClaimStatus, OrderClaimType } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
import { OrderClaim } from '../../order-claim/order-claim.entity';
import { OrderClaimService } from '../../order-claim/order-claim.service';
import { OrderClaimLineService } from '../../order-claim-line/order-claim-line.service';
import { OrderClaimLine } from '../../order-claim-line/order-claim-line.entity';
import { OrderReturnService } from '../../order-return/order-return.service';

/** The request that opens a claim, as the schema declares it. */
interface IRequestOrderClaimArgs {
	orderId: ID;
	type: OrderClaimType;
	currency: string;
	lines: Array<{
		orderLineId?: ID;
		variantId?: ID;
		quantity: string;
		reason?: string;
		isAdditionalItem?: boolean;
		note?: string;
	}>;
	reason?: string;
	note?: string;
}

/** The edit of an open claim, as the schema declares it. */
interface IUpdateOrderClaimArgs {
	lines?: Array<{
		orderLineId?: ID;
		variantId?: ID;
		quantity?: string;
		reason?: string;
		isAdditionalItem?: boolean;
		note?: string;
	}>;
	reason?: string;
	note?: string;
}

/**
 * Claims over GraphQL.
 *
 * Approval answers with the refund id when the resolution settled in money, because that fact is not
 * recoverable from the claim afterwards and a client that has to reconcile a payment needs it.
 *
 * **Authorisation is the controller's, restated field by field.** The class carries what the claims
 * controller class carries — both protocol guards, the platform's feature gate and the read permission
 * its reads run under — and every field then states the permission its own route states: the two reads
 * carry `CLAIMS_VIEW`, raising a claim `CLAIMS_CREATE`, the two decisions `CLAIMS_RESOLVE`, because
 * settling a claim and refusing it are the same authority on the same row, and both halves of the
 * inherited soft-delete pair `CLAIMS_CREATE`, which is the grant the claims controller's own
 * `DELETE /order-claims/:id/soft` and `PUT /order-claims/:id/recover` overrides state. The fields that
 * resolve a claim's lines and its inbound return answer under the permission the claim is read with,
 * which is the route they are selected through.
 *
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the two permission guards — after
 * them, so a caller with no credential is refused as a credential problem before a tenant's switches are
 * consulted — and the code it reads is `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because nothing checks one string against another: a literal that
 * drifted names a code no catalogue row carries, which the guard resolves as disabled, and every field
 * here would then answer `Cannot query field <name>` for every caller with nothing red anywhere.
 */
@Resolver('OrderClaim')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ReturnsPermissions.CLAIMS_VIEW)
export class OrderClaimResolver {
	constructor(
		private readonly orderClaimService: OrderClaimService,
		private readonly orderClaimLineService: OrderClaimLineService,
		private readonly orderReturnService: OrderReturnService
	) {}

	/**
	 * Lists claims.
	 *
	 * @param filter The claim filter.
	 * @param page The page.
	 * @param withDeleted Whether retired claims are included, as the REST list route's own `withDeleted`
	 * is.
	 * @returns One page of claims.
	 */
	@Query('orderClaims')
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	async orderClaims(
		@Args('filter') filter?: { status?: OrderClaimStatus; type?: OrderClaimType; orderId?: ID; number?: string },
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.orderClaimService.findAll({
			where: {
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.type ? { type: filter.type } : {}),
				...(filter?.orderId ? { orderId: filter.orderId } : {}),
				...(filter?.number ? { number: filter.number } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one claim.
	 *
	 * @param id The claim.
	 * @returns The claim, or null when it is not the caller's.
	 */
	@Query('orderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	async orderClaim(@Args('id') id: ID): Promise<OrderClaim | null> {
		try {
			return await this.orderClaimService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Raises a claim.
	 *
	 * @param input The claim.
	 * @returns The payload.
	 */
	@Mutation('requestOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async requestOrderClaim(@Args('input') input: IRequestOrderClaimArgs) {
		try {
			return { orderClaim: await this.orderClaimService.create(input as any), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Edits an open claim: what explains it, and the line set that replaces the old one.
	 *
	 * The route it mirrors is `PUT /order-claims/:id`, and the two calls it makes are reproduced rather
	 * than collapsed: the header is written only when `reason` or `note` moved, and the line set is
	 * replaced only when one was supplied — a field that always wrote the header would touch the row's
	 * `updatedAt` for an edit that changed nothing, and one that always replaced the set would delete and
	 * rewrite every line of a claim whose body carried none. The service refuses both once the claim is
	 * decided, which is the rule the update DTO states: changing a claim after a refund was issued would
	 * leave the refund explaining a claim that no longer says what it said.
	 *
	 * @param id The claim to edit.
	 * @param input What explains the claim, and the line set that replaces the old one.
	 * @returns The payload, with the claim as the edit left it.
	 */
	@Mutation('updateOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async updateOrderClaim(@Args('id') id: ID, @Args('input') input: IUpdateOrderClaimArgs) {
		try {
			const changes = { reason: input.reason, note: input.note };

			if (changes.reason !== undefined || changes.note !== undefined) {
				await this.orderClaimService.update(id, changes as any);
			}

			if (input.lines?.length) {
				await this.orderClaimService.replaceLines(id, input.lines as any);
			}

			return { orderClaim: await this.orderClaimService.findOneDetailed(id), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Approves and settles a claim.
	 *
	 * @param id The claim.
	 * @param refundAmount The amount to refund, for a refund claim.
	 * @param note An operator note.
	 * @returns The payload.
	 */
	@Mutation('approveOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_RESOLVE)
	async approveOrderClaim(
		@Args('id') id: ID,
		@Args('refundAmount') refundAmount?: string,
		@Args('note') note?: string
	) {
		try {
			const { claim, refund } = await this.orderClaimService.approve(id, refundAmount, note);

			return { orderClaim: claim, refundId: refund?.refundId ?? null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Rejects a claim.
	 *
	 * @param id The claim.
	 * @param reason Why it was rejected.
	 * @returns The payload.
	 */
	@Mutation('rejectOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_RESOLVE)
	async rejectOrderClaim(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderClaim: await this.orderClaimService.reject(id, reason), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a claim: the caller abandons its own.
	 *
	 * Cancelling and rejecting are separate acts on the same row and the plugin grants them separately —
	 * the rejection states `CLAIMS_RESOLVE`, because deciding a complaint is a resolver's authority,
	 * while this states `CLAIMS_CREATE`, because a customer withdrawing a claim it raised is exercising
	 * the grant that let it raise one. Without this field `CANCELED` was reachable over REST and not
	 * over GraphQL, so a withdrawn claim would have been recorded as a refused one: `REJECTED` says the
	 * complaint was examined and turned down, which is a different fact about the claim and about the
	 * customer.
	 *
	 * The route it mirrors is `POST /order-claims/:id/cancel`, declared by `06-api-specification.md`
	 * §7.14, and the handler's `reason` reaches the service under the same name — `cancel(id, reason)`
	 * stores it in the row's own `reason` column.
	 *
	 * @param id The claim to cancel.
	 * @param reason Why it was cancelled.
	 * @returns The payload, with the claim as the cancellation left it.
	 */
	@Mutation('cancelOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async cancelOrderClaim(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderClaim: await this.orderClaimService.cancel(id, reason), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a claim recoverably, keeping the refund it settled and the lines it raised.
	 *
	 * The route it mirrors is `DELETE /order-claims/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. This resolver
	 * declared no deletion-shaped field at all before this one, so a claim raised over GraphQL could not
	 * be withdrawn on the protocol that raised it, while the REST controller served both routes — and
	 * withdrawing has to be recoverable here, because a claim that settled in money is the record of that
	 * money and the lines it raised are what a replacement is built from.
	 *
	 * The permission is the claims controller's own for the route — `CLAIMS_CREATE`, because the plugin
	 * declares no `CLAIMS_DELETE` and withdrawing a claim is the grant that already lets a caller raise
	 * one — and not the class-level `CLAIMS_VIEW`, which would let a reader retire a claim.
	 *
	 * The answer is the payload the claim's other mutations answer, `RequestOrderClaimPayload`, so a
	 * refusal is reported in `userErrors` rather than as a GraphQL error, as every other mutation of this
	 * resource reports it.
	 *
	 * @param id The claim to retire.
	 * @returns The payload, carrying the claim as the soft delete left it.
	 */
	@Mutation('softDeleteOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async softDeleteOrderClaim(@Args('id') id: ID) {
		try {
			return { orderClaim: await this.orderClaimService.softRemove(id), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a claim that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-claims/:id/recover`, whose override states the same
	 * `CLAIMS_CREATE` its soft-delete sibling states — a restored claim is decided again, and the refund
	 * it settled is read again beside it, which is the same write read the other way. Without this field
	 * a claim retired over GraphQL could only be brought back over REST, so one lifecycle would be
	 * completable on one protocol and not the other.
	 *
	 * @param id The claim to restore.
	 * @returns The payload, carrying the restored claim.
	 */
	@Mutation('recoverOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async recoverOrderClaim(@Args('id') id: ID) {
		try {
			return { orderClaim: await this.orderClaimService.softRecover(id), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Removes a claim destructively.
	 *
	 * `softDeleteOrderClaim` is the withdrawal this domain wants — a claim that settled in money is the
	 * record of that money, and the lines it raised are what a replacement is built from — and this field
	 * mirrors the destructive route `CrudController` inherits, which `06-api-specification.md` §2
	 * declares in the inherited route set for every entity resource §7 lists unless a row says otherwise.
	 * Both facts belong beside each other: the recoverable pair is the domain's preference and the
	 * destructive route is the framework's inheritance, and a surface that offered only the first would
	 * refuse an act REST performs. `order_claim_line` cascades from `order_claim`, so what this removes
	 * includes the lines the claim was decided on.
	 *
	 * @param id The claim to remove.
	 * @returns The payload, carrying the identifier that was removed.
	 */
	@Mutation('deleteOrderClaim')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async deleteOrderClaim(@Args('id') id: ID) {
		try {
			await this.orderClaimService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves a claim's lines.
	 *
	 * @param claim The claim being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	async lines(@Parent() claim: IOrderClaim): Promise<OrderClaimLine[]> {
		if (Array.isArray((claim as OrderClaim).lines)) {
			return (claim as OrderClaim).lines;
		}

		return await this.orderClaimLineService.findForClaim(claim.id);
	}

	/**
	 * Resolves the return created for a claim, which is the inbound half of a replacement.
	 *
	 * @param claim The claim being read.
	 * @returns The return, or null when the claim has none.
	 */
	@ResolveField('returnOfClaim')
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	async returnOfClaim(@Parent() claim: IOrderClaim) {
		if (!claim.returnId) {
			return null;
		}

		try {
			return await this.orderReturnService.findOneDetailed(claim.returnId);
		} catch (error) {
			return null;
		}
	}
}

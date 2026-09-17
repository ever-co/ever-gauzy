import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderClaim, OrderClaimStatus, OrderClaimType } from '../../returns.types';
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

/**
 * Claims over GraphQL.
 *
 * Approval answers with the refund id when the resolution settled in money, because that fact is not
 * recoverable from the claim afterwards and a client that has to reconcile a payment needs it.
 */
@Resolver('OrderClaim')
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
	 * @returns One page of claims.
	 */
	@Query('orderClaims')
	async orderClaims(
		@Args('filter') filter?: { status?: OrderClaimStatus; type?: OrderClaimType; orderId?: ID; number?: string },
		@Args('page') page?: IPageSelection
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
			order: { createdAt: 'DESC' }
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
	async requestOrderClaim(@Args('input') input: IRequestOrderClaimArgs) {
		try {
			return { orderClaim: await this.orderClaimService.create(input as any), refundId: null, userErrors: [] };
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
	async rejectOrderClaim(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderClaim: await this.orderClaimService.reject(id, reason), refundId: null, userErrors: [] };
		} catch (error) {
			return { orderClaim: null, refundId: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves a claim's lines.
	 *
	 * @param claim The claim being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
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

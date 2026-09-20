import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { Idempotent, Versioned, versionExpectationOf } from '@gauzy/core';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderReturn, IOrderReturnReceiptOutcome, OrderReturnStatus } from '../../returns.types';
import { subtractQuantities, sumQuantities, toQuantityUnits } from '../../returns.quantity';
import { OrderReturn } from '../../order-return/order-return.entity';
import { OrderReturnService } from '../../order-return/order-return.service';
import { OrderReturnLineService } from '../../order-return-line/order-return-line.service';
import { OrderReturnLine } from '../../order-return-line/order-return-line.entity';
import { OrderReturnReason } from '../../order-return-reason/order-return-reason.entity';
import { OrderReturnReasonService } from '../../order-return-reason/order-return-reason.service';

/** The request that opens a return, as the schema declares it. */
interface IRequestOrderReturnArgs {
	orderId: ID;
	lines: Array<{ orderLineId: ID; quantity: string; reasonId?: ID; restock?: boolean; warehouseId?: ID; note?: string }>;
	warehouseId?: ID;
	reasonId?: ID;
	reason?: string;
	currency: string;
	shippingOptionId?: ID;
	noNotification?: boolean;
	note?: string;
	/** The client's retry key, honoured when one is presented. */
	idempotencyKey?: string;
}

/** The receipt of a return's goods, as the schema declares it. */
interface IReceiveOrderReturnArgs {
	lines: Array<{ lineId: ID; receivedQuantity: string; damagedQuantity?: string; restock?: boolean }>;
	warehouseId?: ID;
	refund?: string;
	note?: string;
	/** The version the caller read, which the write is predicated on. */
	version?: number;
	/** The client's retry key, which this operation requires. */
	idempotencyKey?: string;
}

/** What the platform builds beside the arguments of every operation. */
interface IOperationContext {
	/** The HTTP request the operation arrived on, which is where the guard left the accepted version. */
	readonly req?: unknown;
}

/**
 * The returns domain's GraphQL root fields.
 *
 * The resolvers call the same services the REST surface calls, so a return requested over GraphQL and
 * one requested over REST obey the same ceiling check and the same lifecycle, and the two surfaces
 * cannot drift. Authorisation is unchanged: the guards run on the HTTP request that carried the
 * operation, exactly as they do for a REST call.
 *
 * Retry safety and optimistic concurrency are declared here with the same decorators the REST routes
 * carry, and under the same scope names, because a client that retries a mutation has presented the
 * same request whichever protocol carried it. One GraphQL document may select several mutations, so
 * the two conventions ride beside the operation rather than on the request: the retry key is the
 * `idempotencyKey` input member of the mutation the kernel reads it from, and the version is the
 * `version` member of the input that updates a return — or the `version` argument of a mutation that
 * only decides a status, which has no input to carry it. A declared argument the method body never
 * reads is deliberate: the schema has to accept the version so a client may state one, and the guard
 * reads it from the operation's arguments before the method runs.
 */
@Resolver('OrderReturn')
export class OrderReturnResolver {
	constructor(
		private readonly orderReturnService: OrderReturnService,
		private readonly orderReturnLineService: OrderReturnLineService,
		private readonly orderReturnReasonService: OrderReturnReasonService
	) {}

	/**
	 * Lists returns.
	 *
	 * @param filter The return filter.
	 * @param page The page.
	 * @returns One page of returns.
	 */
	@Versioned({ resource: OrderReturnService, write: false })
	@Query('orderReturns')
	async orderReturns(
		@Args('filter') filter?: { status?: OrderReturnStatus; orderId?: ID; number?: string; warehouseId?: ID },
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.orderReturnService.findAll({
			where: {
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.orderId ? { orderId: filter.orderId } : {}),
				...(filter?.number ? { number: filter.number } : {}),
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one return.
	 *
	 * @param id The return.
	 * @returns The return, or null when it is not the caller's.
	 */
	@Versioned({ resource: OrderReturnService, write: false })
	@Query('orderReturn')
	async orderReturn(@Args('id') id: ID): Promise<OrderReturn | null> {
		try {
			return await this.orderReturnService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Requests a return.
	 *
	 * @param input The request.
	 * @returns The payload, with the return or the reason it was refused.
	 */
	@Idempotent({ scope: 'return.create', required: false, resourceType: 'order_return' })
	@Versioned({ resource: OrderReturnService, required: false })
	@Mutation('requestOrderReturn')
	async requestOrderReturn(@Args('input') input: IRequestOrderReturnArgs) {
		try {
			const orderReturn = await this.orderReturnService.create({
				...input,
				lines: input.lines
			} as any);

			return { orderReturn, userErrors: [] };
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Approves a return.
	 *
	 * @param id The return.
	 * @param note An operator note.
	 * @param version The version the caller read.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('approveOrderReturn')
	async approveOrderReturn(
		@Args('id') id: ID,
		@Args('note') note?: string,
		@Args('version') version?: number,
		@Context() context?: IOperationContext
	) {
		try {
			return {
				orderReturn: await this.orderReturnService.approve(id, note, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Rejects a return.
	 *
	 * @param id The return.
	 * @param reason Why it was rejected.
	 * @param version The version the caller read.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('rejectOrderReturn')
	async rejectOrderReturn(
		@Args('id') id: ID,
		@Args('reason') reason?: string,
		@Args('version') version?: number,
		@Context() context?: IOperationContext
	) {
		try {
			return {
				orderReturn: await this.orderReturnService.reject(id, reason, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Receives returned goods.
	 *
	 * @param id The return.
	 * @param input The quantities that arrived.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload, carrying what the receipt did.
	 */
	@Idempotent({ scope: 'return.receive', required: true, resourceType: 'order_return' })
	@Versioned({ resource: OrderReturnService })
	@Mutation('receiveOrderReturn')
	async receiveOrderReturn(
		@Args('id') id: ID,
		@Args('input') input: IReceiveOrderReturnArgs,
		@Context() context?: IOperationContext
	) {
		try {
			const outcome: IOrderReturnReceiptOutcome = await this.orderReturnService.receive(
				id,
				input.lines,
				{
					warehouseId: input.warehouseId,
					refund: input.refund,
					note: input.note
				},
				versionExpectationOf(context?.req)
			);

			return {
				orderReturn: await this.orderReturnService.findOneDetailed(id),
				movementIds: outcome.movementIds,
				refundId: outcome.refund?.refundId ?? null,
				refundAmount: outcome.refund?.amount ?? null,
				receivedQuantity: outcome.receivedQuantity,
				outstandingQuantity: outcome.outstandingQuantity,
				userErrors: []
			};
		} catch (error) {
			return {
				orderReturn: null,
				movementIds: [],
				refundId: null,
				refundAmount: null,
				receivedQuantity: '0',
				outstandingQuantity: '0',
				userErrors: [toUserError(error)]
			};
		}
	}

	/**
	 * Cancels a return.
	 *
	 * @param id The return.
	 * @param reason Why it was cancelled.
	 * @param version The version the caller read.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('cancelOrderReturn')
	async cancelOrderReturn(
		@Args('id') id: ID,
		@Args('reason') reason?: string,
		@Args('version') version?: number,
		@Context() context?: IOperationContext
	) {
		try {
			return {
				orderReturn: await this.orderReturnService.cancel(id, reason, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Closes a fully received return.
	 *
	 * @param id The return.
	 * @param version The version the caller read.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('closeOrderReturn')
	async closeOrderReturn(
		@Args('id') id: ID,
		@Args('version') version?: number,
		@Context() context?: IOperationContext
	) {
		try {
			return {
				orderReturn: await this.orderReturnService.close(id, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves a return's lines.
	 *
	 * @param orderReturn The return being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	async lines(@Parent() orderReturn: IOrderReturn): Promise<OrderReturnLine[]> {
		if (Array.isArray((orderReturn as OrderReturn).lines)) {
			return (orderReturn as OrderReturn).lines;
		}

		return await this.orderReturnLineService.findForReturn(orderReturn.id);
	}

	/**
	 * Resolves the governed reason the return was filed under.
	 *
	 * Resolved from the cause rather than stored on the return: a return that carries a reason id whose
	 * row has been deactivated still has to answer what it was filed under.
	 *
	 * @param orderReturn The return being read.
	 * @returns The reason, or null when the return has none.
	 */
	@ResolveField('reasonCode')
	async reasonCode(@Parent() orderReturn: IOrderReturn): Promise<OrderReturnReason | null> {
		if (!orderReturn.reasonId) {
			return null;
		}

		try {
			return await this.orderReturnReasonService.findOneScoped(orderReturn.reasonId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Resolves the quantity still expected back.
	 *
	 * @param orderReturn The return being read.
	 * @returns The outstanding quantity as an exact decimal string.
	 */
	@ResolveField('outstandingQuantity')
	async outstandingQuantity(@Parent() orderReturn: IOrderReturn): Promise<string> {
		const lines = await this.lines(orderReturn);
		let outstanding = '0';

		for (const line of lines) {
			const settled = sumQuantities([line.receivedQuantity, line.damagedQuantity]);

			if (toQuantityUnits(settled) < toQuantityUnits(line.quantity)) {
				outstanding = sumQuantities([outstanding, subtractQuantities(line.quantity, settled)]);
			}
		}

		return outstanding;
	}
}

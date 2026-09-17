import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderReturn, IOrderReturnReceiptOutcome, OrderReturnStatus } from '../../returns.types';
import { subtractQuantities, sumQuantities, toQuantityUnits } from '../../returns.quantity';
import { OrderReturn } from '../../order-return/order-return.entity';
import { OrderReturnService } from '../../order-return/order-return.service';
import { OrderReturnLineService } from '../../order-return-line/order-return-line.service';
import { OrderReturnLine } from '../../order-return-line/order-return-line.entity';

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
}

/** The receipt of a return's goods, as the schema declares it. */
interface IReceiveOrderReturnArgs {
	lines: Array<{ lineId: ID; receivedQuantity: string; damagedQuantity?: string; restock?: boolean }>;
	warehouseId?: ID;
	refund?: string;
	note?: string;
}

/**
 * The returns domain's GraphQL root fields.
 *
 * The resolvers call the same services the REST surface calls, so a return requested over GraphQL and
 * one requested over REST obey the same ceiling check and the same lifecycle, and the two surfaces
 * cannot drift. Authorisation is unchanged: the guards run on the HTTP request that carried the
 * operation, exactly as they do for a REST call.
 */
@Resolver('OrderReturn')
export class OrderReturnResolver {
	constructor(
		private readonly orderReturnService: OrderReturnService,
		private readonly orderReturnLineService: OrderReturnLineService
	) {}

	/**
	 * Lists returns.
	 *
	 * @param filter The return filter.
	 * @param page The page.
	 * @returns One page of returns.
	 */
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
	 * @returns The payload.
	 */
	@Mutation('approveOrderReturn')
	async approveOrderReturn(@Args('id') id: ID, @Args('note') note?: string) {
		try {
			return { orderReturn: await this.orderReturnService.approve(id, note), userErrors: [] };
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Rejects a return.
	 *
	 * @param id The return.
	 * @param reason Why it was rejected.
	 * @returns The payload.
	 */
	@Mutation('rejectOrderReturn')
	async rejectOrderReturn(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderReturn: await this.orderReturnService.reject(id, reason), userErrors: [] };
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Receives returned goods.
	 *
	 * @param id The return.
	 * @param input The quantities that arrived.
	 * @returns The payload, carrying what the receipt did.
	 */
	@Mutation('receiveOrderReturn')
	async receiveOrderReturn(@Args('id') id: ID, @Args('input') input: IReceiveOrderReturnArgs) {
		try {
			const outcome: IOrderReturnReceiptOutcome = await this.orderReturnService.receive(id, input.lines, {
				warehouseId: input.warehouseId,
				refund: input.refund,
				note: input.note
			});

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
	 * @returns The payload.
	 */
	@Mutation('cancelOrderReturn')
	async cancelOrderReturn(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderReturn: await this.orderReturnService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Closes a fully received return.
	 *
	 * @param id The return.
	 * @returns The payload.
	 */
	@Mutation('closeOrderReturn')
	async closeOrderReturn(@Args('id') id: ID) {
		try {
			return { orderReturn: await this.orderReturnService.close(id), userErrors: [] };
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

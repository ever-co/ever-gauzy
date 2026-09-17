import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderExchange, OrderExchangeStatus } from '../../returns.types';
import { OrderExchange } from '../../order-exchange/order-exchange.entity';
import { OrderExchangeService } from '../../order-exchange/order-exchange.service';
import { OrderExchangeLineService } from '../../order-exchange-line/order-exchange-line.service';
import { OrderExchangeLine } from '../../order-exchange-line/order-exchange-line.entity';
import { OrderReturnService } from '../../order-return/order-return.service';

/** The request that opens an exchange, as the schema declares it. */
interface IRequestOrderExchangeArgs {
	orderId: ID;
	currency: string;
	lines: Array<{ orderLineId?: ID; variantId: ID; quantity: string; unitPrice?: string; note?: string }>;
	returnId?: ID;
	allowBackorder?: boolean;
	note?: string;
}

/**
 * Exchanges over GraphQL.
 *
 * `differenceDue` is read from the row and never recomputed on the way out: it was priced once, at
 * approval, from the snapshotted replacement prices and the order's own prices, and the customer was
 * charged that number. Recomputing it on read would let a later repricing change what somebody
 * already paid.
 */
@Resolver('OrderExchange')
export class OrderExchangeResolver {
	constructor(
		private readonly orderExchangeService: OrderExchangeService,
		private readonly orderExchangeLineService: OrderExchangeLineService,
		private readonly orderReturnService: OrderReturnService
	) {}

	/**
	 * Lists exchanges.
	 *
	 * @param filter The exchange filter.
	 * @param page The page.
	 * @returns One page of exchanges.
	 */
	@Query('orderExchanges')
	async orderExchanges(
		@Args('filter') filter?: { status?: OrderExchangeStatus; orderId?: ID; number?: string },
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.orderExchangeService.findAll({
			where: {
				...(filter?.status ? { status: filter.status } : {}),
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
	 * Reads one exchange.
	 *
	 * @param id The exchange.
	 * @returns The exchange, or null when it is not the caller's.
	 */
	@Query('orderExchange')
	async orderExchange(@Args('id') id: ID): Promise<OrderExchange | null> {
		try {
			return await this.orderExchangeService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Requests an exchange.
	 *
	 * @param input The exchange.
	 * @returns The payload.
	 */
	@Mutation('requestOrderExchange')
	async requestOrderExchange(@Args('input') input: IRequestOrderExchangeArgs) {
		try {
			return { orderExchange: await this.orderExchangeService.create(input as any), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Approves an exchange and prices the difference.
	 *
	 * @param id The exchange.
	 * @param settleDifference Whether the difference should be settled against the payment collection.
	 * @param note An operator note.
	 * @returns The payload.
	 */
	@Mutation('approveOrderExchange')
	async approveOrderExchange(
		@Args('id') id: ID,
		@Args('settleDifference') settleDifference?: boolean,
		@Args('note') note?: string
	) {
		try {
			return { orderExchange: await this.orderExchangeService.approve(id, note), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Rejects an exchange.
	 *
	 * @param id The exchange.
	 * @param reason Why it was rejected.
	 * @returns The payload.
	 */
	@Mutation('rejectOrderExchange')
	async rejectOrderExchange(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderExchange: await this.orderExchangeService.reject(id, reason), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves an exchange's outbound lines.
	 *
	 * @param exchange The exchange being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	async lines(@Parent() exchange: IOrderExchange): Promise<OrderExchangeLine[]> {
		if (Array.isArray((exchange as OrderExchange).lines)) {
			return (exchange as OrderExchange).lines;
		}

		return await this.orderExchangeLineService.findForExchange(exchange.id);
	}

	/**
	 * Resolves the inbound return of an exchange.
	 *
	 * @param exchange The exchange being read.
	 * @returns The return, or null when the inbound half does not exist yet.
	 */
	@ResolveField('returnOfExchange')
	async inboundReturn(@Parent() exchange: IOrderExchange) {
		if (!exchange.returnId) {
			return null;
		}

		try {
			return await this.orderReturnService.findOneDetailed(exchange.returnId);
		} catch (error) {
			return null;
		}
	}
}

import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { Money } from '@gauzy/core';
import { IOrderExchangeLine } from '../../returns.types';
import { OrderExchangeLine } from '../../order-exchange-line/order-exchange-line.entity';
import { OrderExchangeLineService } from '../../order-exchange-line/order-exchange-line.service';

/**
 * Outbound exchange lines over GraphQL.
 *
 * The line total is resolved from the snapshotted unit price rather than read from anywhere else, so
 * the value a client displays is the same value `differenceDue` was computed from — through the
 * platform money layer, so the multiplication is exact.
 */
@Resolver('OrderExchangeLine')
export class OrderExchangeLineResolver {
	constructor(private readonly orderExchangeLineService: OrderExchangeLineService) {}

	/**
	 * Lists the outbound lines of an exchange.
	 *
	 * @param exchangeId The exchange.
	 * @returns The lines.
	 */
	@Query('orderExchangeLines')
	async orderExchangeLines(@Args('exchangeId') exchangeId: ID): Promise<OrderExchangeLine[]> {
		return await this.orderExchangeLineService.findForExchange(exchangeId);
	}

	/**
	 * Resolves the value of one line.
	 *
	 * @param line The line being read.
	 * @param currency The currency the exchange is in.
	 * @returns The line total as an exact decimal string.
	 */
	@ResolveField('lineTotal')
	async lineTotal(@Parent() line: IOrderExchangeLine, @Args('currency') currency?: string): Promise<string> {
		const resolved = currency ?? 'USD';

		return Money.of(line.unitPrice ?? '0', resolved).multiply(line.quantity ?? '0').round().toStorageString();
	}
}

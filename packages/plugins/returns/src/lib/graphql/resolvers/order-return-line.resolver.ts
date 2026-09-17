import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { IOrderReturnLine } from '../../returns.types';
import { subtractQuantities, sumQuantities, toQuantityUnits } from '../../returns.quantity';
import { OrderReturnLine } from '../../order-return-line/order-return-line.entity';
import { OrderReturnLineService } from '../../order-return-line/order-return-line.service';

/**
 * Return lines over GraphQL.
 *
 * The list field is qualified (`orderReturnLines`) rather than named `orderReturnLine` alone, because
 * a line is meaningful only in the context of the return it belongs to, and the fields that need
 * arithmetic — what is still expected back — are resolved here rather than stored, so a line can
 * never disagree with its own quantities.
 */
@Resolver('OrderReturnLine')
export class OrderReturnLineResolver {
	constructor(private readonly orderReturnLineService: OrderReturnLineService) {}

	/**
	 * Lists the lines of a return.
	 *
	 * @param returnId The return.
	 * @returns The lines.
	 */
	@Query('orderReturnLines')
	async orderReturnLines(@Args('returnId') returnId: ID): Promise<OrderReturnLine[]> {
		return await this.orderReturnLineService.findForReturn(returnId);
	}

	/**
	 * Resolves the quantity still expected back on a line.
	 *
	 * @param line The line being read.
	 * @returns The outstanding quantity as an exact decimal string.
	 */
	@ResolveField('outstandingQuantity')
	async outstandingQuantity(@Parent() line: IOrderReturnLine): Promise<string> {
		const settled = sumQuantities([line.receivedQuantity, line.damagedQuantity]);

		return toQuantityUnits(settled) >= toQuantityUnits(line.quantity) ? '0' : subtractQuantities(line.quantity, settled);
	}
}

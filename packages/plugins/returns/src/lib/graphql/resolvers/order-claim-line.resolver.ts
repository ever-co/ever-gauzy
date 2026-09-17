import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { IOrderClaimLine } from '../../returns.types';
import { OrderClaimLine } from '../../order-claim-line/order-claim-line.entity';
import { OrderClaimLineService } from '../../order-claim-line/order-claim-line.service';

/**
 * Claim lines over GraphQL.
 *
 * The list field is qualified by the claim it belongs to, because a line has no meaning on its own —
 * it is an answer to a question the claim asked.
 */
@Resolver('OrderClaimLine')
export class OrderClaimLineResolver {
	constructor(private readonly orderClaimLineService: OrderClaimLineService) {}

	/**
	 * Lists the lines of a claim.
	 *
	 * @param claimId The claim.
	 * @returns The lines.
	 */
	@Query('orderClaimLines')
	async orderClaimLines(@Args('claimId') claimId: ID): Promise<OrderClaimLine[]> {
		return await this.orderClaimLineService.findForClaim(claimId);
	}

	/**
	 * Resolves whether a line is an additional item.
	 *
	 * The flag is derived from what the line names whenever it was not stored, so a line read from an
	 * older row still answers the question the resolution depends on.
	 *
	 * @param line The line being read.
	 * @returns True when the line asks for an item that was never on the order.
	 */
	@ResolveField('isAdditionalItem')
	async isAdditionalItem(@Parent() line: IOrderClaimLine): Promise<boolean> {
		return line.isAdditionalItem ?? !line.orderLineId;
	}
}

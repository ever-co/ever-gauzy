import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderReturnReason } from '../../returns.types';
import { OrderReturnReason } from '../../order-return-reason/order-return-reason.entity';
import { OrderReturnReasonService } from '../../order-return-reason/order-return-reason.service';

/** The definition of a governed reason, as the schema declares it. */
interface IOrderReturnReasonArgs {
	code: string;
	label: string;
	description?: string;
	parentId?: ID;
	isActive?: boolean;
}

/**
 * Governed return reasons over GraphQL.
 *
 * The delete field deactivates rather than removes, exactly as the REST route does: a reason that has
 * explained a return has to stay readable for as long as that return exists.
 */
@Resolver('OrderReturnReason')
export class OrderReturnReasonResolver {
	constructor(private readonly orderReturnReasonService: OrderReturnReasonService) {}

	/**
	 * Lists the reasons as a two-level tree.
	 *
	 * @param filter The reason filter.
	 * @param page The page.
	 * @returns One page of reasons.
	 */
	@Query('orderReturnReasons')
	async orderReturnReasons(
		@Args('filter') filter?: { isActive?: boolean; parentId?: ID; code?: string },
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.orderReturnReasonService.findTree({
			where: {
				...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
				...(filter?.parentId ? { parentId: filter.parentId } : {}),
				...(filter?.code ? { code: filter.code } : {})
			},
			skip,
			take,
			order: { code: 'ASC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one reason.
	 *
	 * @param id The reason.
	 * @returns The reason, or null when it is not the caller's.
	 */
	@Query('orderReturnReason')
	async orderReturnReason(@Args('id') id: ID): Promise<OrderReturnReason | null> {
		try {
			return await this.orderReturnReasonService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a reason.
	 *
	 * @param input The reason.
	 * @returns The payload.
	 */
	@Mutation('createOrderReturnReason')
	async createOrderReturnReason(@Args('input') input: IOrderReturnReasonArgs) {
		try {
			return { orderReturnReason: await this.orderReturnReasonService.create(input as any), userErrors: [] };
		} catch (error) {
			return { orderReturnReason: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Updates a reason.
	 *
	 * @param id The reason.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Mutation('updateOrderReturnReason')
	async updateOrderReturnReason(@Args('id') id: ID, @Args('input') input: IOrderReturnReasonArgs) {
		try {
			return { orderReturnReason: await this.orderReturnReasonService.update(id, input as any), userErrors: [] };
		} catch (error) {
			return { orderReturnReason: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deactivates a reason.
	 *
	 * @param id The reason.
	 * @returns The payload.
	 */
	@Mutation('deleteOrderReturnReason')
	async deleteOrderReturnReason(@Args('id') id: ID) {
		try {
			await this.orderReturnReasonService.deactivate(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves a reason's variants.
	 *
	 * @param reason The reason being read.
	 * @returns The variants.
	 */
	@ResolveField('children')
	async children(@Parent() reason: IOrderReturnReason): Promise<IOrderReturnReason[]> {
		if (Array.isArray(reason.children)) {
			return reason.children;
		}

		return [];
	}
}

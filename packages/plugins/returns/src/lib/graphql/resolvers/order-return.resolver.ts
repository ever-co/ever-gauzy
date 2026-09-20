import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderReturn, IOrderReturnReceiptOutcome, OrderReturnStatus } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
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
 * cannot drift. The guards run on the HTTP request that carried the operation, exactly as they do for a
 * REST call, which is what makes the chain stated below the chain those routes already run under.
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
 *
 * **Authorisation is the controller's, restated field by field.** The class carries what the
 * controller class carries — both protocol guards, the platform's feature gate and the read permission
 * an operator's reads run under — and every field then states the permission its own route states, so a
 * field is never narrower or wider than the route it mirrors: the two reads carry `RETURNS_VIEW`, the
 * request and the cancel `RETURNS_CREATE`, the approval `RETURNS_APPROVE`, the rejection `RETURNS_REJECT`,
 * and the receipt and the close `RETURNS_RECEIVE`, which is the pair `06-api-specification.md` §7 gives
 * this resource. The fields that resolve a return's lines, reason and outstanding quantity answer under
 * the read permission their own read route carries, because that is the route they are selected through.
 *
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the chain the two permission guards
 * already form — after them, so a caller with no credential is refused as a credential problem before a
 * tenant's switches are consulted — and the code it reads is `FEATURE_GRAPHQL`, the commerce catalogue's
 * own entry for "the GraphQL endpoint and its resolvers, under the same guards and permissions as REST".
 * The code is imported rather than restated because the value has to agree with the catalogue's `code`
 * and nothing checks one string against another: a literal that drifted names a code no catalogue row
 * carries, which the guard resolves as disabled, so every field here would answer
 * `Cannot query field <name>` for every caller with nothing red anywhere. One statement on the class
 * puts every field behind it, and a tenant that switched the capability off is answered the same refusal
 * a disabled capability's routes answer with a 404.
 */
@Resolver('OrderReturn')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
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
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
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
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
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
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
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
	@Permissions(ReturnsPermissions.RETURNS_APPROVE)
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
	@Permissions(ReturnsPermissions.RETURNS_REJECT)
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
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
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
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
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
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
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
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
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
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
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
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
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

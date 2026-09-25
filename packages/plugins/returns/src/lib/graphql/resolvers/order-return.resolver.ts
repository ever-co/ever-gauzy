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
import { ReturnsFeatures } from '../../returns.features';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import {
	IOrderReturn,
	IOrderReturnReceiptOutcome,
	IRefundResult,
	IReturnShipmentResult,
	OrderReturnStatus
} from '../../returns.types';
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

/** The edit of a requested return, as the schema declares it. */
interface IUpdateOrderReturnArgs {
	lines?: Array<{
		orderLineId: ID;
		quantity: string;
		reasonId?: ID;
		restock?: boolean;
		warehouseId?: ID;
		note?: string;
	}>;
	warehouseId?: ID;
	reason?: string;
	note?: string;
	/** The version the caller read, which the kernel reads from the operation's arguments. */
	version?: number;
}

/** The refund of a received return, as the schema declares it. */
interface IRefundOrderReturnArgs {
	amount: string;
	reasonId?: ID;
	note?: string;
	/** The version the caller read. */
	version?: number;
}

/** The return leg a return is shipped back on, as the schema declares it. */
interface IShipOrderReturnArgs {
	shippingOptionId?: ID;
	warehouseId?: ID;
	trackingNumber?: string;
	/** The version the caller read. */
	version?: number;
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
 * the receipt and the close `RETURNS_RECEIVE`, which is the pair `06-api-specification.md` §7 gives
 * this resource, and both halves of the inherited soft-delete pair `RETURNS_CREATE`, which is the grant
 * the controller's own `DELETE /order-returns/:id/soft` and `PUT /order-returns/:id/recover` overrides
 * state. The fields that resolve a return's lines, reason and outstanding quantity answer under
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
 *
 * **The plugin's own gate is stated beside it.** The class also declares `ReturnsFeatures.RETURNS`, the
 * flag every controller of this plugin declares, so a tenant that switched returns off is refused here
 * exactly as `FeatureFlagGuard` refuses its REST routes: before it, a refund, a receipt or a deletion
 * that REST answered with a 404 still ran over GraphQL. The two `@FeatureFlag` statements accumulate on
 * the class, and the guard requires every flag the class declares when a field declares none — which no
 * field here does, because a field-level flag would replace both class-level ones.
 */
@Resolver('OrderReturn')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(ReturnsFeatures.RETURNS)
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
	 * @param withDeleted Whether retired returns are included, as the REST list route's own
	 * `withDeleted` is.
	 * @returns One page of returns.
	 */
	@Versioned({ resource: OrderReturnService, write: false })
	@Query('orderReturns')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async orderReturns(
		@Args('filter') filter?: { status?: OrderReturnStatus; orderId?: ID; number?: string; warehouseId?: ID },
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
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
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
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
	 * Edits a requested return: its header fields and the line set that replaces the old one.
	 *
	 * The route it mirrors is `PUT /order-returns/:id`, declared by `06-api-specification.md` §7.14 as
	 * "Update a requested return" under `RETURNS_CREATE` and `Conditional` — which is the `If-Match` the
	 * class already states as `@Versioned`. The body is reproduced rather than summarised, because the
	 * route commits the header whenever a header field moved **or** a line set was supplied: a rewrite of
	 * the line set is a change of the aggregate even when no field of the header moved, and the version
	 * has to follow it, so a client holding the earlier tag cannot edit the same return twice. A field
	 * that reached only `applyVersionedUpdate` would leave a caller who rewrote the lines holding a stale
	 * version, and one that reached only `replaceLines` would let two callers rewrite the same return
	 * concurrently.
	 *
	 * The patch handed to `applyVersionedUpdate` is built from the three members the route's DTO carries
	 * and not from the input's rest, because the input also carries the version: the version is the
	 * caller's statement about the row rather than a column of it, and spreading it into the patch would
	 * write it as a field.
	 *
	 * @param id The return to edit.
	 * @param input The header fields to change and the line set that replaces the old one.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload, with the return as the edit left it.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('updateOrderReturn')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async updateOrderReturn(
		@Args('id') id: ID,
		@Args('input') input: IUpdateOrderReturnArgs,
		@Context() context?: IOperationContext
	) {
		try {
			const changes = {
				warehouseId: input.warehouseId,
				reason: input.reason,
				note: input.note
			};
			const changed = Boolean(changes.warehouseId) || changes.reason !== undefined || changes.note !== undefined;

			if (changed || input.lines?.length) {
				await this.orderReturnService.applyVersionedUpdate(
					id,
					changed ? (changes as any) : {},
					versionExpectationOf(context?.req)
				);
			}

			if (input.lines?.length) {
				await this.orderReturnService.replaceLines(id, input.lines as any);
			}

			return { orderReturn: await this.orderReturnService.findOneDetailed(id), userErrors: [] };
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
	 * Refunds a received return, moving the return's running refund total on.
	 *
	 * This is not a second door to the receipt. The receipt issues a refund only when
	 * `returns.refundTrigger` is `ON_RECEIVE` or `ON_APPROVAL` — it is "skipped when
	 * `refundTrigger = 'MANUAL'`" (doc 10 §11.6 step 5) — and the service behind this field accepts a
	 * return in `RECEIVED`, `PARTIALLY_RECEIVED` or `CLOSED`, while the receipt is refused on anything
	 * that is not `APPROVED` or `PARTIALLY_RECEIVED`. So a refund decided after the last parcel arrived,
	 * or a deployment that refunds by hand, had no GraphQL door at all.
	 *
	 * The grant is the route's own — `RETURNS_RECEIVE` — and deliberately not the `REFUNDS_CREATE` that
	 * `06-api-specification.md` §7.14 states for the route. The two disagree in the repository, and a
	 * field mirrors what its route *does*: §3.1 forbids a field narrower or wider than its route, so a
	 * field stating the documented grant would move money over GraphQL for a caller the same act refuses
	 * over REST. The divergence is recorded rather than resolved, because settling it changes both sides.
	 *
	 * No `@Idempotent` is declared, because the route declares none: §7.14 writes "Yes
	 * (Idempotency-Key, required)" for it while the controller's decorators sit on the request and the
	 * receipt only, and a scope invented here would replay a GraphQL retry that REST lets through — a
	 * difference in behaviour rather than in transport.
	 *
	 * @param id The return being refunded.
	 * @param input The amount, the governed reason and a note.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload, carrying the refund that was written and the return as it now stands.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('refundOrderReturn')
	@Permissions(ReturnsPermissions.RETURNS_RECEIVE)
	async refundOrderReturn(
		@Args('id') id: ID,
		@Args('input') input: IRefundOrderReturnArgs,
		@Context() context?: IOperationContext
	) {
		let refunded: IRefundResult | undefined;

		try {
			refunded = await this.orderReturnService.refund(
				id,
				input.amount,
				input.reasonId,
				input.note,
				versionExpectationOf(context?.req)
			);
		} catch (error) {
			return { orderReturn: null, refundId: null, refundAmount: null, currency: null, userErrors: [toUserError(error)] };
		}

		// The money has moved by the time this line runs, so the read that fills the payload's other half
		// stands outside the write's refusal. Inside it, a read that failed would be answered as a refund
		// that did not happen — and a client that believed that would issue the same refund again, which is
		// the one retry this domain cannot absorb.
		return {
			orderReturn: await this.orderReturnService.findOneDetailed(id),
			refundId: refunded?.refundId ?? null,
			refundAmount: refunded?.amount ?? null,
			currency: refunded?.currency ?? null,
			userErrors: []
		};
	}

	/**
	 * Creates the return leg: the shipment that brings the goods back.
	 *
	 * The route it mirrors is `POST /order-returns/:id/shipping`, and the capability is not the
	 * fulfillment domain's `createFulfillment`: that field raises an outbound shipment whose lines are
	 * what a picking list is built from and refuses one without lines, while a return leg carries none
	 * because goods coming back are not fetched from a bin. Raising the leg through the return is what
	 * lets the service require the return to be `APPROVED` first, stamp the return's identifier onto the
	 * shipment, resolve the carrier and service from the shipping option, and record the chosen option
	 * back on the return it belongs to. A caller who approved a return over GraphQL and then had to
	 * leave the protocol to send it is the failure this closes.
	 *
	 * The options object is built from the three members the route's DTO carries and not from the input
	 * spread, because the input also carries the version — which is the caller's statement about the
	 * row's concurrency and not a member of the shipment.
	 *
	 * @param id The return to ship.
	 * @param input The shipping option, the collection location and an already-known tracking number.
	 * @param context The operation's context, which carries the request the guard ran on.
	 * @returns The payload, carrying the leg that was raised and the return as it now stands.
	 */
	@Versioned({ resource: OrderReturnService })
	@Mutation('shipOrderReturn')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async shipOrderReturn(
		@Args('id') id: ID,
		@Args('input') input: IShipOrderReturnArgs,
		@Context() context?: IOperationContext
	) {
		let leg: IReturnShipmentResult | undefined;

		try {
			leg = await this.orderReturnService.createShipment(
				id,
				{
					shippingOptionId: input.shippingOptionId,
					warehouseId: input.warehouseId,
					trackingNumber: input.trackingNumber
				},
				versionExpectationOf(context?.req)
			);
		} catch (error) {
			return {
				orderReturn: null,
				fulfillmentId: null,
				trackingNumber: null,
				labelUrl: null,
				userErrors: [toUserError(error)]
			};
		}

		// The parcel exists by the time this line runs, so the read-back stands outside the write's refusal
		// for the reason the refund's does: a read that failed would be answered as a shipment that was never
		// raised, and a client that believed it would ask the carrier for a second label.
		return {
			orderReturn: await this.orderReturnService.findOneDetailed(id),
			fulfillmentId: leg?.fulfillmentId ?? null,
			trackingNumber: leg?.trackingNumber ?? null,
			labelUrl: leg?.labelUrl ?? null,
			userErrors: []
		};
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
	 * Retires a return recoverably, keeping the receipt, the stock movements and the refund it wrote.
	 *
	 * The route it mirrors is `DELETE /order-returns/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. Nothing in this
	 * plugin's document removed a return at all before this field, so a return raised over GraphQL could
	 * not be withdrawn on the protocol that raised it, while the REST controller served both routes — and
	 * the pair is the withdrawal a return needs rather than a destructive one, because the receipt it
	 * triggered wrote stock movements and the refund it issued wrote money, both of which point back at
	 * the row.
	 *
	 * The permission is the controller's own for the route — `RETURNS_CREATE`, because the plugin
	 * declares no `RETURNS_DELETE` and withdrawing a return is the grant that already lets a caller
	 * raise one — and not the class-level `RETURNS_VIEW`, which would let a reader retire a return.
	 *
	 * The answer is the payload the return's other mutations answer, `RequestOrderReturnPayload`, so a
	 * refusal is reported in `userErrors` rather than as a GraphQL error, as every other mutation of this
	 * resource reports it.
	 *
	 * @param id The return to retire.
	 * @returns The payload, carrying the return as the soft delete left it.
	 */
	@Mutation('softDeleteOrderReturn')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async softDeleteOrderReturn(@Args('id') id: ID) {
		try {
			return { orderReturn: await this.orderReturnService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a return that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-returns/:id/recover`, whose override states the same
	 * `RETURNS_CREATE` its soft-delete sibling states — putting a return back puts its lines, its
	 * refund and its receipt back into every read that had stopped answering them, which is the same
	 * write read the other way. Without this field a return retired over GraphQL could only be brought
	 * back over REST, so one lifecycle would be completable on one protocol and not the other.
	 *
	 * @param id The return to restore.
	 * @returns The payload, carrying the restored return.
	 */
	@Mutation('recoverOrderReturn')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async recoverOrderReturn(@Args('id') id: ID) {
		try {
			return { orderReturn: await this.orderReturnService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { orderReturn: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Removes a return destructively.
	 *
	 * The route it mirrors is `DELETE /order-returns/:id`, inherited from `CrudController` and overridden
	 * by the controller only to state the permission the base leaves unstated. Two facts meet here and
	 * both are stated rather than one: `softDeleteOrderReturn` is the withdrawal this domain wants —
	 * the receipt wrote stock movements and the refund wrote money, and both point back at the row — and
	 * this field mirrors the framework's own destructive route, which `06-api-specification.md` §2
	 * declares in the inherited route set for every entity resource §7 lists unless a row says otherwise,
	 * and which the marketplace row names six `delete*` fields for. Delivering only the recoverable half
	 * would make GraphQL a narrower surface than REST, which is the one direction §3.1 forbids.
	 *
	 * The answer is an identifier and the refused errors only. There is no row left to carry, so a
	 * payload shaped like the resource's others would promise one that no longer exists.
	 *
	 * @param id The return to remove.
	 * @returns The payload, carrying the identifier that was removed.
	 */
	@Mutation('deleteOrderReturn')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async deleteOrderReturn(@Args('id') id: ID) {
		try {
			await this.orderReturnService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
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

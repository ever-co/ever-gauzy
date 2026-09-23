import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderExchange, OrderExchangeStatus } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
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

/** The edit of an open exchange, as the schema declares it. */
interface IUpdateOrderExchangeArgs {
	lines?: Array<{ orderLineId?: ID; variantId: ID; quantity?: string; unitPrice?: string; note?: string }>;
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
 *
 * **Authorisation is the controller's, restated field by field.** The class carries what the exchanges
 * controller class carries — both protocol guards, the platform's feature gate and the read permission
 * its reads run under — and every field then states the permission its own route states: the two reads
 * carry `EXCHANGES_VIEW`, requesting an exchange `EXCHANGES_CREATE`, approving or rejecting one
 * `EXCHANGES_RESOLVE`, because the decision re-reserves stock and adjusts the payment collection, and
 * both halves of the inherited soft-delete pair `EXCHANGES_CREATE`, which is the grant the exchanges
 * controller's own `DELETE /order-exchanges/:id/soft` and `PUT /order-exchanges/:id/recover` overrides
 * state. The fields that resolve an exchange's lines and its inbound return answer under the permission
 * the exchange is read with, which is the route they are selected through.
 *
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the two permission guards — after
 * them, so a caller with no credential is refused as a credential problem before a tenant's switches are
 * consulted — and the code it reads is `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because nothing checks one string against another: a literal that
 * drifted names a code no catalogue row carries, which the guard resolves as disabled, and every field
 * here would then answer `Cannot query field <name>` for every caller with nothing red anywhere.
 */
@Resolver('OrderExchange')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
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
	 * @param withDeleted Whether retired exchanges are included, as the REST list route's own
	 * `withDeleted` is.
	 * @returns One page of exchanges.
	 */
	@Query('orderExchanges')
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async orderExchanges(
		@Args('filter') filter?: { status?: OrderExchangeStatus; orderId?: ID; number?: string },
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
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
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
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
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
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
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async requestOrderExchange(@Args('input') input: IRequestOrderExchangeArgs) {
		try {
			return { orderExchange: await this.orderExchangeService.create(input as any), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Edits an open exchange: its backorder allowance, a note, and the line set that replaces the old one.
	 *
	 * The route it mirrors is `PUT /order-exchanges/:id`, and both of its calls are reproduced: the header
	 * is written only when `allowBackorder` or `note` moved, and the line set is replaced only when one was
	 * supplied. The capability exists because the set is still the caller's to state before approval — a
	 * replacement line's `unitPrice` is snapshotted when the set is written, and the difference the
	 * customer pays is priced from those snapshots at approval, so a set rewritten afterwards would
	 * re-price lines somebody was already charged for. The service refuses the edit once the exchange is
	 * resolved for exactly that reason.
	 *
	 * @param id The exchange to edit.
	 * @param input The backorder allowance, a note, and the line set that replaces the old one.
	 * @returns The payload, with the exchange as the edit left it.
	 */
	@Mutation('updateOrderExchange')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async updateOrderExchange(@Args('id') id: ID, @Args('input') input: IUpdateOrderExchangeArgs) {
		try {
			const changes = { allowBackorder: input.allowBackorder, note: input.note };

			if (changes.allowBackorder !== undefined || changes.note !== undefined) {
				await this.orderExchangeService.update(id, changes as any);
			}

			if (input.lines?.length) {
				await this.orderExchangeService.replaceLines(id, input.lines as any);
			}

			return { orderExchange: await this.orderExchangeService.findOneDetailed(id), userErrors: [] };
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
	@Permissions(ReturnsPermissions.EXCHANGES_RESOLVE)
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
	@Permissions(ReturnsPermissions.EXCHANGES_RESOLVE)
	async rejectOrderExchange(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderExchange: await this.orderExchangeService.reject(id, reason), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels an exchange: the caller abandons one that was approved and reserved stock.
	 *
	 * Cancelling and rejecting differ in what they release. A rejection decides the exchange was not
	 * warranted; a cancellation abandons one that was approved — doc 10 §12.6: "Rejecting or cancelling an
	 * approved-but-unresolved exchange releases `CLAIM`/`EXCHANGE` reservations with
	 * `release('EXCHANGE', exchangeId)`". The route states `EXCHANGES_CREATE` for that reason, and its
	 * `reason` reaches the service under the same name. Without this field a GraphQL caller could approve
	 * an exchange, reserve the replacement units, and then have no way to give them back — the stock would
	 * be held until something else released it, which is the failure this closes.
	 *
	 * @param id The exchange to cancel.
	 * @param reason Why it was cancelled.
	 * @returns The payload, with the exchange as the cancellation left it.
	 */
	@Mutation('cancelOrderExchange')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async cancelOrderExchange(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { orderExchange: await this.orderExchangeService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires an exchange recoverably, keeping the difference it priced and the customer was charged.
	 *
	 * The route it mirrors is `DELETE /order-exchanges/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. This resolver
	 * declared no deletion-shaped field at all before this one, so an exchange requested over GraphQL
	 * could not be withdrawn on the protocol that requested it, while the REST controller served both
	 * routes — and `differenceDue` was priced once and charged, so a row removed outright would take the
	 * explanation of that charge with it.
	 *
	 * The permission is the controller's own for the route — `EXCHANGES_CREATE`, because the plugin
	 * declares no `EXCHANGES_DELETE` and withdrawing an exchange is the grant that already lets a caller
	 * request one.
	 *
	 * The answer is the payload the exchange's other mutations answer, `RequestOrderExchangePayload`, so
	 * a refusal is reported in `userErrors` rather than as a GraphQL error, as every other mutation of
	 * this resource reports it.
	 *
	 * @param id The exchange to retire.
	 * @returns The payload, carrying the exchange as the soft delete left it.
	 */
	@Mutation('softDeleteOrderExchange')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async softDeleteOrderExchange(@Args('id') id: ID) {
		try {
			return { orderExchange: await this.orderExchangeService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores an exchange that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-exchanges/:id/recover`, whose override states the same
	 * `EXCHANGES_CREATE` its soft-delete sibling states — a restored exchange is decided again and its
	 * difference is read again beside it, which is the same write read the other way. Without this field
	 * an exchange retired over GraphQL could only be brought back over REST, so one lifecycle would be
	 * completable on one protocol and not the other.
	 *
	 * @param id The exchange to restore.
	 * @returns The payload, carrying the restored exchange.
	 */
	@Mutation('recoverOrderExchange')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async recoverOrderExchange(@Args('id') id: ID) {
		try {
			return { orderExchange: await this.orderExchangeService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { orderExchange: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Removes an exchange destructively.
	 *
	 * `softDeleteOrderExchange` is the withdrawal this domain wants — the difference was priced once and
	 * the customer was charged it, and the row is the explanation of that charge — and this field mirrors
	 * the destructive route `CrudController` inherits, which `06-api-specification.md` §2 declares in the
	 * inherited route set for every entity resource §7 lists unless a row says otherwise, and which the
	 * marketplace row names six `delete*` fields for. Both facts belong beside each other: the recoverable
	 * pair is the domain's preference and the destructive route is the framework's inheritance. A line
	 * whose `variantId` is referenced with `RESTRICT` from other rows is refused by the database, so this
	 * removes what the schema lets it remove and no more.
	 *
	 * @param id The exchange to remove.
	 * @returns The payload, carrying the identifier that was removed.
	 */
	@Mutation('deleteOrderExchange')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async deleteOrderExchange(@Args('id') id: ID) {
		try {
			await this.orderExchangeService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves an exchange's outbound lines.
	 *
	 * @param exchange The exchange being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
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
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
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

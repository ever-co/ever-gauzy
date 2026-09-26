import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	connectionFromOffsetPage,
	paginateRows,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { OrderLineInvoice } from '../order-line-invoice/order-line-invoice.entity';
import { OrderLineInvoiceService } from '../order-line-invoice/order-line-invoice.service';
import { OrderLineService } from '../order-line/order-line.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { OrderLineInvoiceDirection, OrderLineKind } from '../order.types';
import { ILineInvoicePosition } from '../order.types';

/** The link as the schema declares it. */
interface IOrderLineInvoiceInput {
	orderLineId: string;
	invoiceItemId: string;
	direction?: OrderLineInvoiceDirection;
	quantity: number;
	amount: number;
	currency: string;
	basisQuantity?: number;
	metadata?: Record<string, unknown>;
}

/**
 * The register that makes a partial invoice, and a partial credit, expressible, over GraphQL.
 *
 * The resolver mirrors the controller field for field, under the same guards and the same permissions,
 * so the two protocols cannot drift: a caller records a link, reads the links of a line and asks how
 * much of it is left to bill over either door, with the same authority and the same arithmetic.
 *
 * `recordOrderLineInvoice` is deliberately a mutation rather than a nested write on an order: the link
 * and the line's counters move together inside one transaction, and a field that could be set on the
 * line would be a second way to move a cache whose only writer is this register.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('OrderLineInvoice')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
export class OrderLineInvoiceResolver {
	constructor(
		private readonly service: OrderLineInvoiceService,
		private readonly lineService: OrderLineService
	) {}

	/**
	 * Lists the links of one order line.
	 *
	 * `listForLine` answers every link the line was billed through, oldest first, and takes no window of
	 * its own — the order is the one the documents were issued in, which the field's own shape depends
	 * on. The page is therefore cut over the rows it returned: a field that accepted a page and answered
	 * the whole register would give a client a `pageInfo` nothing honours.
	 *
	 * @param orderLineId The line to read.
	 * @param page The page.
	 * @param withDeleted Whether retired links are included, as the REST list route's own `withDeleted`
	 * is. The flag belongs to `listForLine`, which is the read that decided which rows exist, rather
	 * than to the page cut here.
	 * @returns A page of links, oldest first.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Query('orderLineInvoices')
	async orderLineInvoices(
		@Args('orderLineId', { type: () => ID }) orderLineId: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<OrderLineInvoice>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.service.listForLine(orderLineId, withDeleted);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Reads how much of one order line is left to bill.
	 *
	 * @param orderLineId The line to read.
	 * @param basisQuantity The quantity the line is invoiced against; the ordered quantity when omitted.
	 * @returns The counters, the outstanding quantity and the status they imply.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Query('orderLineInvoicingPosition')
	async orderLineInvoicingPosition(
		@Args('orderLineId', { type: () => ID }) orderLineId: string,
		@Args('basisQuantity', { type: () => String, nullable: true }) basisQuantity?: string
	): Promise<ILineInvoicePosition> {
		return await this.service.positionFor(orderLineId, basisQuantity);
	}

	/**
	 * Records a link and moves the line's counters with it.
	 *
	 * @param input The link to record.
	 * @returns The stored link, and the line as it now stands.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('recordOrderLineInvoice')
	async recordOrderLineInvoice(@Args('input', { type: () => Object }) input: IOrderLineInvoiceInput) {
		return await this.service.record(input);
	}

	/**
	 * Amends a link's tenant extras.
	 *
	 * Only `metadata` is accepted: the rest of the row describes an issued document, and a correction is
	 * a credit rather than an edit.
	 *
	 * @param id The link.
	 * @param metadata The extras to write.
	 * @returns The link, as it now stands.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('updateOrderLineInvoice')
	async updateOrderLineInvoice(
		@Args('id', { type: () => ID }) id: string,
		@Args('metadata', { type: () => Object, nullable: true }) metadata?: Record<string, unknown>
	) {
		return await this.service.updateOne(id, { metadata } as never);
	}

	/**
	 * Removes a link and re-derives the line's counters from what remains.
	 *
	 * @param id The link.
	 * @returns What the removal did.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('deleteOrderLineInvoice')
	async deleteOrderLineInvoice(@Args('id', { type: () => ID }) id: string) {
		await this.service.delete(id);

		return { id, deleted: true };
	}

	/**
	 * Re-derives a line's counters from its links.
	 *
	 * The reconciliation route: the counters are a cache, and this is what a job compares them against.
	 *
	 * @param orderLineId The line to re-derive.
	 * @param basisQuantity The quantity the line is invoiced against; the ordered quantity when omitted.
	 * @returns The line, with its counters re-derived.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('recomputeOrderLineInvoices')
	async recomputeOrderLineInvoices(
		@Args('orderLineId', { type: () => ID }) orderLineId: string,
		@Args('basisQuantity', { type: () => String, nullable: true }) basisQuantity?: string
	) {
		return await this.service.recomputeCounters(orderLineId, basisQuantity);
	}

	/**
	 * Records one refund against a line, in as many parts as it was paid in.
	 *
	 * The refunded counters are the second register on the same line, and they are written through the
	 * line service rather than through this one: their evidence is the payment domain's `refund_line`
	 * rows, which this package must not read. Two partial refunds are therefore two mutations, and the
	 * register accumulates both — which is what makes a line refunded in two parts expressible.
	 *
	 * @param input The refund to record.
	 * @returns The line, as it now stands.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('recordOrderLineRefund')
	async recordOrderLineRefund(@Args('input', { type: () => Object }) input: IOrderLineRefundInput) {
		return await this.lineService.recordRefund({
			orderLineId: input.orderLineId,
			quantity: input.quantity,
			amount: input.amount,
			currency: input.currency
		});
	}

	/**
	 * Retires a line-to-invoice link recoverably, keeping the evidence it records.
	 *
	 * The route it mirrors is `DELETE /order-line-invoices/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A link is what a
	 * line's counters were derived from and what says which invoice item billed which part of the line,
	 * so the row is the explanation of a document that was issued — retired recoverably, and restored by
	 * the field below, rather than dropped by the destructive delete this endpoint also serves.
	 *
	 * Because a retirement here is the register's own write, the counters are re-derived around it exactly
	 * as they are when a link is removed through `deleteOrderLineInvoice`.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT` — and not the class-level view
	 * grant, because retiring a link moves what a line is billed against.
	 *
	 * @param id The link to retire.
	 * @returns The link, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('softDeleteOrderLineInvoice')
	async softDeleteOrderLineInvoice(@Args('id', { type: () => ID }) id: string): Promise<OrderLineInvoice> {
		return await this.service.softRemove(id);
	}

	/**
	 * Restores a line-to-invoice link that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-line-invoices/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored link is
	 * counted into the line's invoiced and credited quantities again, which is why the route states the
	 * editing grant rather than the reading one.
	 *
	 * @param id The link to restore.
	 * @returns The restored link.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation('recoverOrderLineInvoice')
	async recoverOrderLineInvoice(@Args('id', { type: () => ID }) id: string): Promise<OrderLineInvoice> {
		return await this.service.softRecover(id);
	}
}

/** The refund register's request, as the schema declares it. */
interface IOrderLineRefundInput {
	orderLineId: string;
	quantity: number;
	amount: number;
	currency: string;
}

/**
 * The order-line kinds, as the schema declares them.
 *
 * The enumeration is re-exported here so the SDL and the entity cannot drift: the schema's members and
 * the column's allowed values are one list, written once.
 */
export const ORDER_LINE_KINDS: readonly string[] = Object.values(OrderLineKind);

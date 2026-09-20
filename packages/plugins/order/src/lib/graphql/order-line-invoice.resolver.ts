import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { OrderLineInvoiceService } from '../order-line-invoice/order-line-invoice.service';
import { OrderLineService } from '../order-line/order-line.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { OrderLineInvoiceDirection, OrderLineKind } from '../order.types';
import { ILineInvoicePosition } from '../order.types';
import { OrderLine } from './types';

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
	 * @param orderLineId The line to read.
	 * @returns Every item and credit-note item the line was billed through, oldest first.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@Query('orderLineInvoices')
	async orderLineInvoices(@Args('orderLineId', { type: () => ID }) orderLineId: string) {
		return await this.service.listForLine(orderLineId);
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
	 * The links of a line, read through the register when the line is reached from an order.
	 *
	 * @param line The parent line.
	 * @returns The links.
	 * @throws BadRequestException when the parent carries no identifier, which cannot happen for a row a
	 * query returned.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
	@ResolveField('invoiceLinks', () => [Object], { nullable: true })
	async invoiceLinks(@Parent() line: OrderLine) {
		if (!line?.id) {
			throw new BadRequestException('ORDER_LINE_ID_REQUIRED: a link is read for one order line.');
		}

		return await this.service.listForLine(line.id);
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

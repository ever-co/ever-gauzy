import { Args, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { OrderLineInvoiceService } from '../order-line-invoice/order-line-invoice.service';
import { OrderLineService } from '../order-line/order-line.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { OrderLine } from './types';

/**
 * The fields an order line resolves through the invoice register, and its own lifecycle pair.
 *
 * `invoiceLinks` is declared on `OrderLine` in the schema extension — "Every invoice item and credit-note
 * item this line was billed through" — and `@nestjs/graphql` refuses to build the schema when a
 * `@ResolveField` names a field the type of its `@Resolver(...)` does not declare:
 * `OrderLineInvoice.invoiceLinks defined in resolvers, but not in schema`. The class therefore exists to
 * bind that field to the type that owns it, and it carries the resource's own lifecycle pair besides —
 * `softDeleteOrderLine` and `recoverOrderLine`, which `OrderLineController` serves over REST on the
 * `DELETE /:id/soft` and `PUT /:id/recover` routes `CrudController` contributes and which no resolver of
 * this package declared — while the register's remaining root fields stay on `OrderLineInvoiceResolver`.
 *
 * **The gate is the catalogue's**, as on every resolver of this package: `FeatureFlagGuard` reads
 * `FEATURE_GRAPHQL`, so a tenant that switched the endpoint off is answered the refusal a disabled
 * capability's routes answer with, and the permission is the one both surfaces require for these rows.
 */
@Resolver('OrderLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ORDER_PERMISSIONS.ORDERS_VIEW)
export class OrderLineResolver {
	constructor(
		private readonly service: OrderLineInvoiceService,
		private readonly lineService: OrderLineService
	) {}

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
	 * Retires an order line recoverably, keeping what was ordered and what it was billed at.
	 *
	 * The route it mirrors is `DELETE /order-lines/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A line carries the
	 * price snapshot it was bought at and the counters every fulfilment, invoice and refund moves, so the
	 * row is retired rather than dropped — and the field below is how that is undone.
	 *
	 * The permission is the controller's own for the route — `ORDERS_EDIT` — and not the class-level view
	 * grant, because retiring a line takes it out of the order's totals and out of what is left to ship.
	 *
	 * @param id The line to retire.
	 * @returns The line, as the soft delete left it.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteOrderLine' })
	async softDeleteOrderLine(@Args('id', { type: () => ID }) id: string): Promise<OrderLine> {
		return this.lineService.softRemove(id);
	}

	/**
	 * Restores an order line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-lines/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored line is
	 * counted into the order's totals and into the quantities its invoice links account for again, which
	 * is why the route states the editing grant rather than the reading one.
	 *
	 * @param id The line to restore.
	 * @returns The restored line.
	 */
	@Permissions(ORDER_PERMISSIONS.ORDERS_EDIT)
	@Mutation(() => Object, { name: 'recoverOrderLine' })
	async recoverOrderLine(@Args('id', { type: () => ID }) id: string): Promise<OrderLine> {
		return this.lineService.softRecover(id);
	}
}

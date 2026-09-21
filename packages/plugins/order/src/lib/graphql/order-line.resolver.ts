import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { OrderLineInvoiceService } from '../order-line-invoice/order-line-invoice.service';
import { ORDER_PERMISSIONS } from '../order.permissions';
import { OrderLine } from './types';

/**
 * The fields an order line resolves through the invoice register.
 *
 * `invoiceLinks` is declared on `OrderLine` in the schema extension — "Every invoice item and credit-note
 * item this line was billed through" — and `@nestjs/graphql` refuses to build the schema when a
 * `@ResolveField` names a field the type of its `@Resolver(...)` does not declare:
 * `OrderLineInvoice.invoiceLinks defined in resolvers, but not in schema`. The class therefore exists to
 * bind that one field to the type that owns it, while the register's own root fields stay on
 * `OrderLineInvoiceResolver`.
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
	constructor(private readonly service: OrderLineInvoiceService) {}

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
}

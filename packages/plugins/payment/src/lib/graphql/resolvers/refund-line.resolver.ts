import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { RefundLineService } from '../../refund-line/refund-line.service';
import { IRefundLine } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	ICreateRefundLineGraphInput,
	ICreateRefundLinePayload,
	IDeleteRefundLinePayload,
	IRefundLineConnection,
	IRefundLineFilter,
	IPaymentSort,
	IUpdateRefundLineGraphInput,
	IUpdateRefundLinePayload,
	REFUND_LINE_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Which lines a refund paid back, over GraphQL.
 *
 * The surface mirrors the REST routes exactly, and so does the permission split: reading a breakdown
 * is `REFUNDS_VIEW`, and recording, changing or removing a line is `REFUNDS_CREATE` — the same value
 * that records the refund itself, because a breakdown maintained by somebody who may not give money
 * back would be a second, quieter way to decide what a refund is for.
 *
 * What the breakdown may never do is pass the refund it belongs to, or change once that refund has
 * settled. Both refusals come from the service and arrive here as `userErrors` rather than as transport
 * errors: `REFUND_LINE_OVER_REFUND` when the lines would account for more than the refund gives back,
 * `REFUND_LINE_ORDER_LINE_NOT_FOUND` when a line names an order line of another organization, and
 * `REFUND_LINE_REFUND_SETTLED` when the refund has already moved the money.
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
@Resolver('RefundLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class RefundLineResolver {
	constructor(private readonly refundLineService: RefundLineService) {}

	/**
	 * Lists the lines of the caller's organization, optionally narrowed to one refund.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Query('refundLines')
	async refundLines(
		@Args('filter') filter?: IRefundLineFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
	): Promise<IRefundLineConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.refundLineService.findLinesPage({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, REFUND_LINE_SORT_FIELDS),
			skip,
			take
		});

		return toConnection(listing, skip);
	}

	/**
	 * Reads one line of a refund's breakdown.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Query('refundLine')
	async refundLine(@Args('id') id: ID): Promise<IRefundLine> {
		return this.refundLineService.findLineOrFail(id);
	}

	/**
	 * Records a line against a pending refund.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('createRefundLine')
	async createRefundLine(@Args('input') input: ICreateRefundLineGraphInput): Promise<ICreateRefundLinePayload> {
		try {
			return { refundLine: await this.refundLineService.createLine(input as never), userErrors: [] };
		} catch (error) {
			return { refundLine: null, ...rejection<IRefundLine>(error) };
		}
	}

	/**
	 * Changes what a line of a pending refund records: its quantity, its amount and its metadata.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('updateRefundLine')
	async updateRefundLine(@Args('input') input: IUpdateRefundLineGraphInput): Promise<IUpdateRefundLinePayload> {
		try {
			return { refundLine: await this.refundLineService.updateLine(input.id, input as never), userErrors: [] };
		} catch (error) {
			return { refundLine: null, ...rejection<IRefundLine>(error) };
		}
	}

	/**
	 * Removes a line from a refund that has not settled.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('deleteRefundLine')
	async deleteRefundLine(@Args('id') id: ID): Promise<IDeleteRefundLinePayload> {
		try {
			return { refundLine: await this.refundLineService.removeLine(id), deleted: true, userErrors: [] };
		} catch (error) {
			return { refundLine: null, deleted: false, ...rejection<IRefundLine>(error) };
		}
	}
}

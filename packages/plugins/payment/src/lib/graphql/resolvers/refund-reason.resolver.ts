import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { RefundReasonService } from '../../refund-reason/refund-reason.service';
import { IRefundReason } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	ICreateRefundReasonGraphInput,
	ICreateRefundReasonPayload,
	IDeleteRefundReasonPayload,
	IRefundReasonConnection,
	IRefundReasonFilter,
	IPaymentSort,
	IUpdateRefundReasonGraphInput,
	IUpdateRefundReasonPayload,
	REFUND_REASON_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * The governed refund reasons over GraphQL.
 *
 * A reason is what makes refund reporting groupable instead of a wall of free text, so it is
 * maintained under `REFUNDS_CREATE` — the operator who gives money back is the one who knows why —
 * while reading reasons stays under `REFUNDS_VIEW`.
 *
 * **There is no hard delete.** A reason a refund cites is deactivated, which is what `deleteRefundReason`
 * does, and the answer says so: the reason comes back with `isActive` false and `deleted` true, so a
 * caller is never told a row was removed when it is still resolving for the reporting that cites it.
 * The two-level ceiling and the immutable code are rules of the service: a third level is refused with
 * `REFUND_REASON_DEPTH_EXCEEDED`, and a code that reports cite is refused rather than rewritten.
 */
@Resolver('RefundReason')
@UseGuards(TenantPermissionGuard, PermissionGuard)
export class RefundReasonResolver {
	constructor(private readonly refundReasonService: RefundReasonService) {}

	/**
	 * Lists the governed reasons of the caller's organization.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Query('refundReasons')
	async refundReasons(
		@Args('filter') filter?: IRefundReasonFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number
	): Promise<IRefundReasonConnection> {
		const page = await this.refundReasonService.findReasons({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, REFUND_REASON_SORT_FIELDS),
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return toConnection(page, (row) => row.id);
	}

	/**
	 * Reads one governed reason.
	 */
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Query('refundReason')
	async refundReason(@Args('id') id: ID): Promise<IRefundReason> {
		return this.refundReasonService.findReasonOrFail(id);
	}

	/**
	 * Creates a reason, optionally as a refinement of an existing one.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	// A reason is refused when its code is taken, so the key is optional here exactly as it is on the REST
	// route, under the same scope.
	@Idempotent({ scope: 'refund.reason.create', required: false, resourceType: 'refund_reason' })
	@Mutation('createRefundReason')
	async createRefundReason(
		@Args('input') input: ICreateRefundReasonGraphInput
	): Promise<ICreateRefundReasonPayload> {
		try {
			return { refundReason: await this.refundReasonService.createReason(input as never), userErrors: [] };
		} catch (error) {
			return { refundReason: null, ...rejection<IRefundReason>(error) };
		}
	}

	/**
	 * Changes a reason: its label, its description, its parent or its active state.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('updateRefundReason')
	async updateRefundReason(
		@Args('input') input: IUpdateRefundReasonGraphInput
	): Promise<IUpdateRefundReasonPayload> {
		try {
			return { refundReason: await this.refundReasonService.updateReason(input.id, input as never), userErrors: [] };
		} catch (error) {
			return { refundReason: null, ...rejection<IRefundReason>(error) };
		}
	}

	/**
	 * Deactivates a reason that is no longer offered, keeping it for the refunds that cite it.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('deleteRefundReason')
	async deleteRefundReason(@Args('id') id: ID): Promise<IDeleteRefundReasonPayload> {
		try {
			return { refundReason: await this.refundReasonService.deactivateReason(id), deleted: true, userErrors: [] };
		} catch (error) {
			return { refundReason: null, deleted: false, ...rejection<IRefundReason>(error) };
		}
	}
}

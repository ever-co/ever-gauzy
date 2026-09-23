import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
	IRecoverRefundReasonPayload,
	ISoftDeleteRefundReasonPayload,
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
@Resolver('RefundReason')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IRefundReasonConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.refundReasonService.findReasons({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, REFUND_REASON_SORT_FIELDS),
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(listing, skip);
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

	/**
	 * Retires a governed refund reason recoverably.
	 *
	 * The route it mirrors is `DELETE /refund-reasons/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for. It is
	 * a different act from `deleteRefundReason`, which deactivates the reason so it stops being offered:
	 * this one takes the row out of the reads while keeping it, which is what a reason a report no
	 * longer has to group by needs.
	 *
	 * The permission is the route's own — `REFUNDS_CREATE`, the grant the create, update and deactivate
	 * routes here carry — and not the class's view grant. This class states no `@Permissions` of its
	 * own, so a field that stated none would carry no metadata at all, and `PermissionGuard` answers
	 * `true` to empty metadata.
	 *
	 * @param id The reason to retire.
	 * @returns The payload, carrying the reason as the soft delete left it.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('softDeleteRefundReason')
	async softDeleteRefundReason(@Args('id') id: ID): Promise<ISoftDeleteRefundReasonPayload> {
		try {
			return { refundReason: await this.refundReasonService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { refundReason: null, ...rejection<IRefundReason>(error) };
		}
	}

	/**
	 * Restores a governed refund reason that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /refund-reasons/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for. A
	 * restored reason is offered and read again, and the refunds that cite it resolve the same way they
	 * did before it was withdrawn.
	 *
	 * @param id The reason to restore.
	 * @returns The payload, carrying the restored reason.
	 */
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Mutation('recoverRefundReason')
	async recoverRefundReason(@Args('id') id: ID): Promise<IRecoverRefundReasonPayload> {
		try {
			return { refundReason: await this.refundReasonService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { refundReason: null, ...rejection<IRefundReason>(error) };
		}
	}
}

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentCaptureService } from '../../payment-capture/payment-capture.service';
import { IPaymentCapture } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	ICapturePaymentGraphInput,
	ICapturePaymentPayload,
	IPaymentCaptureConnection,
	IPaymentCaptureFilter,
	IPaymentSort,
	IRecoverPaymentCapturePayload,
	ISoftDeletePaymentCapturePayload,
	PAYMENT_CAPTURE_SORT_FIELDS,
	withDateRange,
	withoutRange
} from '../types/payment.types';

/**
 * The capture ledger over GraphQL.
 *
 * Read and capture, and nothing else: a capture is a fact about money that was taken, so no mutation
 * here updates or deletes one — a partial capture is another row and a correction is a refund. Taking
 * an authorisation carries `PAYMENT_SESSIONS_CAPTURE`, the administration-group permission, because it
 * is the act the whole domain is careful about.
 *
 * The two limits — what remains of the authorisation, and what the collection is for — are enforced by
 * the service, so a capture requested here and one requested over REST are refused identically.
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
@Resolver('PaymentCapture')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PaymentCaptureResolver {
	constructor(private readonly paymentCaptureService: PaymentCaptureService) {}

	/**
	 * Lists the captures of the caller's organization, optionally within a capture-date window.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Query('paymentCaptures')
	async paymentCaptures(
		@Args('filter') filter?: IPaymentCaptureFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IPaymentCaptureConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentCaptureService.findCaptures({
			where: withDateRange(
				withoutRange(filter as Record<string, unknown>, ['capturedAtFrom', 'capturedAtTo']),
				filter as Record<string, unknown>,
				'capturedAt',
				'capturedAtFrom',
				'capturedAtTo'
			),
			order: toOrder(sort, PAYMENT_CAPTURE_SORT_FIELDS),
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(listing, skip);
	}

	/**
	 * Reads one capture.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Query('paymentCapture')
	async paymentCapture(@Args('id') id: ID): Promise<IPaymentCapture> {
		return this.paymentCaptureService.findCaptureOrFail(id);
	}

	/**
	 * Records a capture against a payment, partially or in full, and moves the payment and its
	 * collection with it.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CAPTURE as PermissionsEnum)
	// The REST capture route requires a retry key and this mutation is the same operation, so it requires
	// one too, under the same scope: the two surfaces must answer a retry of one capture identically.
	@Idempotent({ scope: 'payment.capture', required: true, resourceType: 'payment' })
	@Mutation('capturePayment')
	async capturePayment(@Args('input') input: ICapturePaymentGraphInput): Promise<ICapturePaymentPayload> {
		try {
			return { paymentCapture: await this.paymentCaptureService.capture(input as never), userErrors: [] };
		} catch (error) {
			return { paymentCapture: null, ...rejection<IPaymentCapture>(error) };
		}
	}

	/**
	 * Retires a capture recoverably.
	 *
	 * The route it mirrors is `DELETE /payment-captures/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for. It is
	 * the only removal this resolver offers, and the reason is the same one that keeps a hard delete off
	 * the capture route entirely: a capture is a fact about money that was taken, so a row that has to
	 * stop counting towards a payment is withdrawn recoverably rather than destroyed, and the ledger it
	 * was written into stays auditable.
	 *
	 * The permission is the route's own — `PAYMENT_SESSIONS_CAPTURE`, the grant taking the money
	 * carries, because withdrawing the row is as much a money act as writing it — and not the class's
	 * view grant. This class states no `@Permissions` of its own, so a field that stated none would
	 * carry no metadata at all, and `PermissionGuard` answers `true` to empty metadata.
	 *
	 * @param id The capture to retire.
	 * @returns The payload, carrying the capture as the soft delete left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CAPTURE as PermissionsEnum)
	@Mutation('softDeletePaymentCapture')
	async softDeletePaymentCapture(@Args('id') id: ID): Promise<ISoftDeletePaymentCapturePayload> {
		try {
			return { paymentCapture: await this.paymentCaptureService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { paymentCapture: null, ...rejection<IPaymentCapture>(error) };
		}
	}

	/**
	 * Restores a capture that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /payment-captures/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for.
	 * Restoring a capture puts it back into the figure the payment's capture limit and its refundable
	 * amount are computed from, so it states `PAYMENT_SESSIONS_CAPTURE` exactly as the retirement does.
	 *
	 * @param id The capture to restore.
	 * @returns The payload, carrying the restored capture.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CAPTURE as PermissionsEnum)
	@Mutation('recoverPaymentCapture')
	async recoverPaymentCapture(@Args('id') id: ID): Promise<IRecoverPaymentCapturePayload> {
		try {
			return { paymentCapture: await this.paymentCaptureService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { paymentCapture: null, ...rejection<IPaymentCapture>(error) };
		}
	}
}

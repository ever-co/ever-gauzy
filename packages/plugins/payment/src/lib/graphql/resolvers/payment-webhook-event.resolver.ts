import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentWebhookEventService } from '../../payment-webhook-event/payment-webhook-event.service';
import { IPaymentWebhookEvent } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	IPaymentSort,
	IPaymentWebhookEventConnection,
	IPaymentWebhookEventFilter,
	IRecoverPaymentWebhookEventPayload,
	IReprocessPaymentWebhookEventGraphInput,
	IReprocessPaymentWebhookEventPayload,
	ISoftDeletePaymentWebhookEventPayload,
	PAYMENT_WEBHOOK_EVENT_SORT_FIELDS,
	withDateRange,
	withoutRange
} from '../types/payment.types';

/**
 * The inbound provider callback log over GraphQL.
 *
 * Reading the log is one permission and re-running an event is another, because the two are different
 * acts: the first is what support does while investigating a customer's payment, and the second
 * re-applies an effect to money.
 *
 * **There is no mutation that records a callback.** The intake happens on a public, signature-verified
 * route, and the ordering rule that makes this log trustworthy is a rule of the service: the payload row
 * is written before the signature is judged, before the type is looked up and before any state changes,
 * so an unverifiable callback is still on record and a handler defect is replayable. Exposing that as a
 * mutation would let an authenticated caller write a callback that never arrived. Re-processing is
 * refused for an event that already succeeded unless the caller forces it, because re-applying an effect
 * that already landed is a money defect.
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
@Resolver('PaymentWebhookEvent')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PaymentWebhookEventResolver {
	constructor(private readonly paymentWebhookEventService: PaymentWebhookEventService) {}

	/**
	 * Lists the callbacks of the caller's organization, optionally within a receipt window.
	 */
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_VIEW as PermissionsEnum)
	@Query('paymentWebhookEvents')
	async paymentWebhookEvents(
		@Args('filter') filter?: IPaymentWebhookEventFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IPaymentWebhookEventConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentWebhookEventService.findEvents({
			where: withDateRange(
				withoutRange(filter as Record<string, unknown>, ['receivedAtFrom', 'receivedAtTo']),
				filter as Record<string, unknown>,
				'receivedAt',
				'receivedAtFrom',
				'receivedAtTo'
			),
			order: toOrder(sort, PAYMENT_WEBHOOK_EVENT_SORT_FIELDS),
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(listing, skip);
	}

	/**
	 * Reads one callback with its payload, its signature and its last error.
	 */
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_VIEW as PermissionsEnum)
	@Query('paymentWebhookEvent')
	async paymentWebhookEvent(@Args('id') id: ID): Promise<IPaymentWebhookEvent> {
		return this.paymentWebhookEventService.findEventOrFail(id);
	}

	/**
	 * Re-runs a stored callback through the same classification the intake uses.
	 */
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_REPROCESS as PermissionsEnum)
	// Re-running a callback re-applies an effect to money, so the key is honoured here under the same
	// scope as on the REST route: a client that presents one is answered from the record.
	@Idempotent({ scope: 'payment.callback.reprocess', required: false, resourceType: 'payment_webhook_event' })
	@Mutation('reprocessPaymentWebhookEvent')
	async reprocessPaymentWebhookEvent(
		@Args('input') input: IReprocessPaymentWebhookEventGraphInput
	): Promise<IReprocessPaymentWebhookEventPayload> {
		try {
			return {
				paymentWebhookEvent: await this.paymentWebhookEventService.reprocess(input.id, Boolean(input.force)),
				userErrors: []
			};
		} catch (error) {
			return { paymentWebhookEvent: null, ...rejection<IPaymentWebhookEvent>(error) };
		}
	}

	/**
	 * Retires an inbound callback recoverably, keeping the record that it arrived.
	 *
	 * The route it mirrors is `DELETE /payment-webhook-events/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base declares no metadata for.
	 * It withdraws the row from the reads without destroying it, which is the only removal this log can
	 * offer: the ordering rule that makes the log trustworthy is that the payload row is written before
	 * anything is judged about it, so a callback that turned out to be noise is retired rather than
	 * deleted, and what was received stays provable.
	 *
	 * The permission is the route's own — `PAYMENT_CALLBACKS_REPROCESS`, the grant the reprocess route
	 * here carries, because the withdrawal is an act on the log rather than a read of it — and not the
	 * class's view grant. This class states no `@Permissions` of its own, so a field that stated none
	 * would carry no metadata at all, and `PermissionGuard` answers `true` to empty metadata.
	 *
	 * @param id The callback to retire.
	 * @returns The payload, carrying the callback as the soft delete left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_REPROCESS as PermissionsEnum)
	@Mutation('softDeletePaymentWebhookEvent')
	async softDeletePaymentWebhookEvent(@Args('id') id: ID): Promise<ISoftDeletePaymentWebhookEventPayload> {
		try {
			return { paymentWebhookEvent: await this.paymentWebhookEventService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { paymentWebhookEvent: null, ...rejection<IPaymentWebhookEvent>(error) };
		}
	}

	/**
	 * Restores an inbound callback that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /payment-webhook-events/:id/recover`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base declares no metadata for. A
	 * restored callback is part of the log again — and readable by the reprocess mutation beside it — so
	 * the field states `PAYMENT_CALLBACKS_REPROCESS` exactly as the retirement does.
	 *
	 * @param id The callback to restore.
	 * @returns The payload, carrying the restored callback.
	 */
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_REPROCESS as PermissionsEnum)
	@Mutation('recoverPaymentWebhookEvent')
	async recoverPaymentWebhookEvent(@Args('id') id: ID): Promise<IRecoverPaymentWebhookEventPayload> {
		try {
			return { paymentWebhookEvent: await this.paymentWebhookEventService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { paymentWebhookEvent: null, ...rejection<IPaymentWebhookEvent>(error) };
		}
	}
}

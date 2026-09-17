import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { PaymentWebhookEventService } from '../../payment-webhook-event/payment-webhook-event.service';
import { IPaymentWebhookEvent } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	IPaymentSort,
	IPaymentWebhookEventConnection,
	IPaymentWebhookEventFilter,
	IReprocessPaymentWebhookEventGraphInput,
	IReprocessPaymentWebhookEventPayload,
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
 */
@Resolver('PaymentWebhookEvent')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Args('offset') offset?: number
	): Promise<IPaymentWebhookEventConnection> {
		const page = await this.paymentWebhookEventService.findEvents({
			where: withDateRange(
				withoutRange(filter as Record<string, unknown>, ['receivedAtFrom', 'receivedAtTo']),
				filter as Record<string, unknown>,
				'receivedAt',
				'receivedAtFrom',
				'receivedAtTo'
			),
			order: toOrder(sort, PAYMENT_WEBHOOK_EVENT_SORT_FIELDS),
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return toConnection(page, (row) => row.id);
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
}

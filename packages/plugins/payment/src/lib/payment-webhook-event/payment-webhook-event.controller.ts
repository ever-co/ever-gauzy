import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe
} from '@gauzy/core';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { PaymentWebhookEventService } from './payment-webhook-event.service';
import { IPaymentWebhookEvent } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The inbound provider callback log.
 *
 * Reading the log is a permission and re-running an event is another, because the two are different
 * acts: the first is what support does while investigating a customer's payment, and the second
 * re-applies an effect to money.
 *
 * **The inbound route itself is not in this file.** A provider posts to a public, signature-verified
 * path, and every controller in this package is tenant- and permission-guarded by contract, so the
 * intake is exposed as `PaymentWebhookEventService.intake` for the platform to wire to that route.
 * The ordering rule lives in the service and is what makes the log trustworthy: the payload row is
 * written before the signature is judged, before the event type is looked up and before any state
 * changes, so an unverifiable callback is still on record and a handler defect is replayable. A
 * callback that was already seen is answered `{ received: true, duplicate: true }` and processed
 * nothing.
 *
 * Re-processing is refused for an event that already succeeded unless the caller forces it:
 * re-applying an effect that already landed is a money defect, so it takes an explicit decision
 * rather than a retry.
 */
@ApiTags('PaymentWebhookEvent')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_CALLBACKS_VIEW as PermissionsEnum)
@Controller('/payment-webhook-events')
export class PaymentWebhookEventController extends CrudController<PaymentWebhookEvent> {
	constructor(private readonly paymentWebhookEventService: PaymentWebhookEventService) {
		super(paymentWebhookEventService);
	}

	/**
	 * Lists the callbacks of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of callbacks.
	 */
	@ApiOperation({ summary: 'List inbound provider callbacks' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Events retrieved' })
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<PaymentWebhookEvent>): Promise<IPagination<IPaymentWebhookEvent>> {
		return this.paymentWebhookEventService.findEvents({
			where: { ...((filter ?? {}) as Record<string, unknown>) }
		});
	}

	/**
	 * Reads one callback with its payload and its last error.
	 *
	 * @param id The event to read.
	 * @returns The event.
	 */
	@ApiOperation({ summary: 'Find an inbound provider callback by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Event retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentWebhookEvent> {
		return this.paymentWebhookEventService.findEventOrFail(id);
	}

	/**
	 * Re-runs a callback through the same classification the intake uses.
	 *
	 * @param id The event to reprocess.
	 * @param body The optional force flag, which is required to re-run an event that already succeeded.
	 * @returns The stored event.
	 */
	@ApiOperation({ summary: 'Reprocess an inbound provider callback' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Event reprocessed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Already processed, without force' })
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_REPROCESS as PermissionsEnum)
	@Post(':id/reprocess')
	@HttpCode(HttpStatus.OK)
	async reprocess(@Param('id', UUIDValidationPipe) id: ID, @Body() body?: { force?: boolean }): Promise<IPaymentWebhookEvent> {
		return this.paymentWebhookEventService.reprocess(id, Boolean(body?.force));
	}
}

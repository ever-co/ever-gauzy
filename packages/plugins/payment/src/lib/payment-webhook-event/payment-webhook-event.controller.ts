import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { PaymentWebhookEventService } from './payment-webhook-event.service';
import { CreatePaymentWebhookEventDTO, UpdatePaymentWebhookEventDTO } from './dto';
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
	 * Writes a row onto the callback log, without applying it.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it. The ordering that makes the log trustworthy — the
	 * payload is stored before the signature is judged and before any state changes — belongs to
	 * `PaymentWebhookEventService.intake`, which the platform wires to the provider's own path; this
	 * route writes the row the caller names, and applying one is still the re-processing route below.
	 * Both carry the re-processing grant rather than the reading one, because a row here is evidence
	 * and re-running one re-applies an effect to money.
	 *
	 * @param entity The callback row to record.
	 * @returns The stored event.
	 */
	@ApiOperation({ summary: 'Record an inbound provider callback' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Event recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid callback input' })
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_REPROCESS as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreatePaymentWebhookEventDTO): Promise<IPaymentWebhookEvent> {
		return this.paymentWebhookEventService.create(entity as never);
	}

	/**
	 * Corrects the recorded fields of a callback.
	 *
	 * The states an event moves through are recorded by the classification the intake runs; this route
	 * is the repair surface for the row itself — a signature kept as evidence, a payload somebody
	 * recorded by hand — and re-applying an effect is the re-processing route below.
	 *
	 * @param id The event to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update an inbound provider callback' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Event updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Event not found' })
	@Permissions(PaymentPermission.PAYMENT_CALLBACKS_REPROCESS as PermissionsEnum)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdatePaymentWebhookEventDTO) {
		return this.paymentWebhookEventService.update(id, entity as never);
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
	// Re-running a callback re-applies an effect to money, and the service already refuses an event that
	// succeeded without force, so the key is optional: a client that presents one gets the recorded
	// outcome back rather than a second application of the same event.
	@Idempotent({ scope: 'payment.callback.reprocess', required: false, resourceType: 'payment_webhook_event' })
	@Post(':id/reprocess')
	@HttpCode(HttpStatus.OK)
	async reprocess(@Param('id', UUIDValidationPipe) id: ID, @Body() body?: { force?: boolean }): Promise<IPaymentWebhookEvent> {
		return this.paymentWebhookEventService.reprocess(id, Boolean(body?.force));
	}
}

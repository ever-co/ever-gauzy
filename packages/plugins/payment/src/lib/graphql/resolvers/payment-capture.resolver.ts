import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
 */
@Resolver('PaymentCapture')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Args('offset') offset?: number
	): Promise<IPaymentCaptureConnection> {
		const page = await this.paymentCaptureService.findCaptures({
			where: withDateRange(
				withoutRange(filter as Record<string, unknown>, ['capturedAtFrom', 'capturedAtTo']),
				filter as Record<string, unknown>,
				'capturedAt',
				'capturedAtFrom',
				'capturedAtTo'
			),
			order: toOrder(sort, PAYMENT_CAPTURE_SORT_FIELDS),
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return toConnection(page, (row) => row.id);
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
}

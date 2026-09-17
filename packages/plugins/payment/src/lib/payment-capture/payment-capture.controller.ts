import { Body, Controller, Get, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { PaymentCapture } from './payment-capture.entity';
import { PaymentCaptureService } from './payment-capture.service';
import { CreatePaymentCaptureDTO } from './dto';
import { IPaymentCapture } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The capture ledger over REST.
 *
 * The surface is read and create, and nothing else: a capture is a fact about money that was taken,
 * so it is never updated and never deleted — a partial capture is another row and a correction is a
 * refund. `POST /payment-captures` carries `PAYMENT_SESSIONS_CAPTURE`, the administration-group
 * permission, because taking an authorisation is the act this whole domain is careful about.
 *
 * The two limits are enforced in the service rather than trusted to the caller: a capture may not
 * pass what remains of the authorisation (`authorizedAmount - canceledAmount`) and may not push the
 * collection past the amount it is for. A request that would pass either is refused with
 * `PAYMENT_OVER_CAPTURE`, never clamped.
 */
@ApiTags('PaymentCapture')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
@Controller('/payment-captures')
export class PaymentCaptureController extends CrudController<PaymentCapture> {
	constructor(private readonly paymentCaptureService: PaymentCaptureService) {
		super(paymentCaptureService);
	}

	/**
	 * Lists the captures of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of captures.
	 */
	@ApiOperation({ summary: 'List payment captures' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Captures retrieved' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<PaymentCapture>): Promise<IPagination<IPaymentCapture>> {
		return this.paymentCaptureService.findCaptures({ where: { ...((filter ?? {}) as Record<string, unknown>) } });
	}

	/**
	 * Reads one capture.
	 *
	 * @param id The capture to read.
	 * @returns The capture.
	 */
	@ApiOperation({ summary: 'Find a payment capture by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Capture retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Capture not found' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IPaymentCapture> {
		return this.paymentCaptureService.findCaptureOrFail(id);
	}

	/**
	 * Captures a payment, partially or in full.
	 *
	 * @param entity The capture to record.
	 * @returns The stored capture.
	 */
	@ApiOperation({ summary: 'Capture an authorised payment' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Capture recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Not authorised, already captured, or over capture' })
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CAPTURE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreatePaymentCaptureDTO): Promise<IPaymentCapture> {
		return this.paymentCaptureService.capture(entity as never);
	}
}

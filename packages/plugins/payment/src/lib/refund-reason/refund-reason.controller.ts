import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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
import { RefundReason } from './refund-reason.entity';
import { RefundReasonService } from './refund-reason.service';
import { CreateRefundReasonDTO, UpdateRefundReasonDTO } from './dto';
import { IRefundReason } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * The governed refund reasons.
 *
 * A reason is what makes refund reporting groupable: without one, "why did we give 4 200 back last
 * quarter" is answered by reading free text. A reason is therefore maintained under `REFUNDS_CREATE`
 * — the catalogue defines that permission as "create a refund, cancel a pending refund, and maintain
 * the refund reasons", because the operator who gives money back is the one who knows why — while
 * reading them stays under `REFUNDS_VIEW`.
 *
 * The tree is at most two levels deep, checked by the service when a reason is created under a parent
 * and again when one is moved, and a reason that is finished with is deactivated rather than deleted:
 * the reporting that groups by it has to keep resolving.
 */
@ApiTags('RefundReason')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
@Controller('/refund-reasons')
export class RefundReasonController extends CrudController<RefundReason> {
	constructor(private readonly refundReasonService: RefundReasonService) {
		super(refundReasonService);
	}

	/**
	 * Lists the reasons of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of reasons.
	 */
	@ApiOperation({ summary: 'List refund reasons' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reasons retrieved' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<RefundReason>): Promise<IPagination<IRefundReason>> {
		return this.refundReasonService.findReasons({ where: { ...((filter ?? {}) as Record<string, unknown>) } });
	}

	/**
	 * Reads one reason.
	 *
	 * @param id The reason to read.
	 * @returns The reason.
	 */
	@ApiOperation({ summary: 'Find a refund reason by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reason retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reason not found' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefundReason> {
		return this.refundReasonService.findReasonOrFail(id);
	}

	/**
	 * Creates a reason, optionally under an existing one.
	 *
	 * @param entity The reason to create.
	 * @returns The stored reason.
	 */
	@ApiOperation({ summary: 'Create a refund reason' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Reason created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Code taken, or a third level requested' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreateRefundReasonDTO): Promise<IRefundReason> {
		return this.refundReasonService.createReason(entity as never);
	}

	/**
	 * Changes a reason: its label, its description, its parent or its active state. The code is
	 * immutable, because reports cite it.
	 *
	 * @param id The reason to change.
	 * @param entity The fields to change.
	 * @returns The stored reason.
	 */
	@ApiOperation({ summary: 'Update a refund reason' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reason updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reason not found' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateRefundReasonDTO
	): Promise<IRefundReason> {
		return this.refundReasonService.updateReason(id, entity as never);
	}

	/**
	 * Deactivates a reason that is no longer offered, keeping it for the refunds that cite it.
	 *
	 * @param id The reason to deactivate.
	 * @returns The stored reason.
	 */
	@ApiOperation({ summary: 'Deactivate a refund reason' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reason deactivated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Reason not found' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Post(':id/deactivate')
	@HttpCode(HttpStatus.OK)
	async deactivate(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefundReason> {
		return this.refundReasonService.deactivateReason(id);
	}
}

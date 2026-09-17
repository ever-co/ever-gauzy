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
import { Refund } from './refund.entity';
import { RefundService } from './refund.service';
import { CreateRefundDTO, UpdateRefundDTO } from './dto';
import { IRefund, IRefundUpdateInput } from '../payment.types';
import { PaymentPermission } from '../payment.permissions';

/**
 * Money given back.
 *
 * Three deliberate routes sit on this controller, and the split between them is the point. **Creating**
 * a refund records an intention to give money back — a row in `PENDING` that can still be refused.
 * **Approving** it is the act that moves the money: the payment's `refundedAmount` rises, its status
 * becomes `PARTIALLY_REFUNDED` or `REFUNDED`, the collection follows, and the negative ledger movement
 * belongs to the operation step that performed it. **Cancelling** withdraws the intention before
 * anything moved, and writes nothing back because nothing was written.
 *
 * Creating and cancelling carry `REFUNDS_CREATE`; approving carries `REFUNDS_APPROVE`, which is how a
 * refund above an agent's limit becomes somebody else's decision by construction rather than by
 * convention.
 *
 * The refundable figure is never taken from the request: it is the captures of the payment minus the
 * refunds that already succeeded against it, computed when the refund is created and computed again
 * when it is approved. A request that would pass it is refused with `REFUND_AMOUNT_EXCEEDS_CAPTURED`,
 * and a refund that has already settled is refused with `REFUND_ALREADY_SETTLED` — the status moves
 * once.
 */
@ApiTags('Refund')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
@Controller('/refunds')
export class RefundController extends CrudController<Refund> {
	constructor(private readonly refundService: RefundService) {
		super(refundService);
	}

	/**
	 * Lists the refunds of the caller's organization.
	 *
	 * @param filter The query filter, merged with the tenancy scope.
	 * @returns One page of refunds.
	 */
	@ApiOperation({ summary: 'List refunds' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refunds retrieved' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get()
	async findAll(@Query() filter?: BaseQueryDTO<Refund>): Promise<IPagination<IRefund>> {
		return this.refundService.findRefunds({ where: { ...((filter ?? {}) as Record<string, unknown>) } });
	}

	/**
	 * Reads one refund with its governed reason, the payment it gives back and the lines it paid back.
	 *
	 * @param id The refund to read.
	 * @returns The refund, with its line breakdown.
	 */
	@ApiOperation({ summary: 'Find a refund by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Refund not found' })
	@Permissions(PaymentPermission.REFUNDS_VIEW as PermissionsEnum)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IRefund> {
		const refund = await this.refundService.findRefundOrFail(id);

		return { ...refund, lines: await this.refundService.findRefundLines(id) };
	}

	/**
	 * Records a refund against an order and, when one is named, against the payment it gives back.
	 *
	 * @param entity The refund to record.
	 * @returns The stored refund, pending.
	 */
	@ApiOperation({ summary: 'Create a refund' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Refund recorded' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Unattributed, or above what was captured' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async create(@Body() entity: CreateRefundDTO): Promise<IRefund> {
		return this.refundService.createRefund(entity as never);
	}

	/**
	 * Corrects the recorded fields of a refund that has not settled.
	 *
	 * The route is declared here rather than inherited: a body is validated from the type the handler
	 * names, and the base class names the entity's shape as a generic, whose reflected type is
	 * `Object` — a parameter the validation pipe cannot name a class for is skipped, so an inherited
	 * route accepts any body at all and writes it. Recording a refund, approving it and withdrawing it
	 * remain the three verbs above and below, each with the checks the money it moves requires; this is
	 * the repair surface for a row's own fields, which is why it carries `REFUNDS_CREATE` — the grant
	 * that already covers creating and cancelling a pending refund — and never `REFUNDS_APPROVE`.
	 *
	 * @param id The refund to change.
	 * @param entity The fields to change.
	 * @returns The result of the update.
	 */
	@ApiOperation({ summary: 'Update a refund' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Refund updated' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Refund not found' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateRefundDTO) {
		return this.refundService.update(id, entity as never);
	}

	/**
	 * Approves a pending refund, moving the payment and its collection with it.
	 *
	 * @param id The refund to approve.
	 * @param entity The approver's note.
	 * @returns The stored refund.
	 */
	@ApiOperation({ summary: 'Approve a pending refund' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund approved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Already settled, or above what was captured' })
	@Permissions(PaymentPermission.REFUNDS_APPROVE as PermissionsEnum)
	@Post(':id/approve')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async approve(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateRefundDTO
	): Promise<IRefund> {
		return this.refundService.approveRefund(id, (entity as IRefundUpdateInput).note);
	}

	/**
	 * Cancels a pending refund. Nothing moved, so nothing is written back.
	 *
	 * @param id The refund to cancel.
	 * @param entity The reason the refund was withdrawn.
	 * @returns The stored refund.
	 */
	@ApiOperation({ summary: 'Cancel a pending refund' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Refund cancelled' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Already settled' })
	@Permissions(PaymentPermission.REFUNDS_CREATE as PermissionsEnum)
	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateRefundDTO
	): Promise<IRefund> {
		return this.refundService.cancelRefund(id, (entity as IRefundUpdateInput).reason);
	}
}

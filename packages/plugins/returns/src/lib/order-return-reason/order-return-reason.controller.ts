import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { ReturnsFeatures } from '../returns.features';
import { ReturnsPermissions } from '../returns.permissions';
import { CreateOrderReturnReasonCreateDTO, OrderReturnReasonDTO, UpdateOrderReturnReasonDTO } from './dto';
import { OrderReturnReason } from './order-return-reason.entity';
import { OrderReturnReasonService } from './order-return-reason.service';

/**
 * Governed return reasons.
 *
 * Delete is an override rather than the inherited soft delete: a reason that has already explained a
 * return is deactivated, because removing the row would leave those returns unexplainable in a
 * report. The inherited delete is kept for a row that was never used.
 */
@ApiTags('OrderReturnReason')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
@Controller('/order-return-reasons')
export class OrderReturnReasonController extends CrudController<OrderReturnReason> {
	constructor(private readonly orderReturnReasonService: OrderReturnReasonService) {
		super(orderReturnReasonService);
	}

	/**
	 * Lists the reasons as a two-level tree.
	 *
	 * @param options The filter, including `filter[isActive]`.
	 * @returns The reasons, paginated.
	 */
	@ApiOperation({ summary: 'List return reasons' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The reasons were listed.' })
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async findAll(@Query() options: BaseQueryDTO<OrderReturnReason>): Promise<IPagination<OrderReturnReason>> {
		return await this.orderReturnReasonService.findTree(options);
	}

	/**
	 * Creates a reason.
	 *
	 * @param entity The reason.
	 * @returns The created reason.
	 */
	@ApiOperation({ summary: 'Create a return reason' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The reason was created.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderReturnReasonCreateDTO): Promise<OrderReturnReason> {
		return await this.orderReturnReasonService.create(entity as any);
	}

	/**
	 * Updates a reason.
	 *
	 * @param id The reason to update.
	 * @param entity The fields to change.
	 * @returns The updated reason.
	 */
	@ApiOperation({ summary: 'Update a return reason' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The reason was updated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderReturnReasonDTO
	): Promise<OrderReturnReason> {
		return await this.orderReturnReasonService.update(id, entity as any);
	}

	/**
	 * Deactivates a reason, keeping the returns that reference it explainable.
	 *
	 * @param id The reason to deactivate.
	 * @returns The deactivated reason.
	 */
	@ApiOperation({ summary: 'Deactivate a return reason' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The reason was deactivated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderReturnReason> {
		return await this.orderReturnReasonService.deactivate(id);
	}

	/**
	 * Re-activates a reason that was deactivated.
	 *
	 * @param id The reason to reactivate.
	 * @param entity The activation flag.
	 * @returns The updated reason.
	 */
	@ApiOperation({ summary: 'Reactivate a return reason' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The reason was reactivated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Post(':id/activate')
	@UseValidationPipe({ transform: true, whitelist: true })
	async activate(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: OrderReturnReasonDTO
	): Promise<OrderReturnReason> {
		return await this.orderReturnReasonService.update(id, { isActive: entity.isActive ?? true } as any);
	}

	/**
	 * Physically removes a reason that was never used.
	 *
	 * @param id The reason to remove.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Remove an unused return reason' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The reason was removed.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id/hard')
	async hardDelete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.orderReturnReasonService.delete(id);
	}
}

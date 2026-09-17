import { Body, Controller, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { CreateOrderReturnLineDTO, UpdateOrderReturnLineDTO } from './dto';
import { OrderReturnLine } from './order-return-line.entity';
import { OrderReturnLineService } from './order-return-line.service';

/**
 * Return lines.
 *
 * The lines of a return are usually written with the return itself; this surface exists for the
 * operator who corrects one line, and it is the same validator either way — every write goes through
 * the service that checks the request against what was actually fulfilled.
 */
@ApiTags('OrderReturnLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
@Controller('/order-return-lines')
export class OrderReturnLineController extends CrudController<OrderReturnLine> {
	constructor(private readonly orderReturnLineService: OrderReturnLineService) {
		super(orderReturnLineService);
	}

	/**
	 * Lists the lines of a return.
	 *
	 * @param options The filter, including `filter[returnId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List return lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async findAll(@Query() options: BaseQueryDTO<OrderReturnLine>): Promise<IPagination<OrderReturnLine>> {
		return await this.orderReturnLineService.findAll(options);
	}

	/**
	 * Adds a line to a return that is still open.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add a line to a return' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderReturnLineDTO): Promise<OrderReturnLine> {
		return await this.orderReturnLineService.create(entity as any);
	}

	/**
	 * Updates a return line.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update a return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderReturnLineDTO
	): Promise<OrderReturnLine> {
		await this.orderReturnLineService.update(id, entity as any);

		return await this.orderReturnLineService.findOneByIdString(id);
	}
}

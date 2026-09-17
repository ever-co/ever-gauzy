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
import { CreateOrderExchangeLineDTO, UpdateOrderExchangeLineDTO } from './dto';
import { OrderExchangeLine } from './order-exchange-line.entity';
import { OrderExchangeLineService } from './order-exchange-line.service';

/**
 * Outbound exchange lines.
 *
 * The unit price is part of the line rather than a value the reader resolves, because the difference
 * the customer was charged was computed from it. A line written through this surface states its own
 * price for exactly that reason.
 */
@ApiTags('OrderExchangeLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
@Controller('/order-exchange-lines')
export class OrderExchangeLineController extends CrudController<OrderExchangeLine> {
	constructor(private readonly orderExchangeLineService: OrderExchangeLineService) {
		super(orderExchangeLineService);
	}

	/**
	 * Lists outbound exchange lines.
	 *
	 * @param options The filter, including `filter[exchangeId]`.
	 * @returns The lines, paginated.
	 */
	@ApiOperation({ summary: 'List exchange lines' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The lines were listed.' })
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async findAll(@Query() options: BaseQueryDTO<OrderExchangeLine>): Promise<IPagination<OrderExchangeLine>> {
		return await this.orderExchangeLineService.findAll(options);
	}

	/**
	 * Adds an outbound line to an exchange that is still open.
	 *
	 * @param entity The line to add.
	 * @returns The created line.
	 */
	@ApiOperation({ summary: 'Add an outbound line to an exchange' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The line was added.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderExchangeLineDTO): Promise<OrderExchangeLine> {
		return await this.orderExchangeLineService.create(entity as any);
	}

	/**
	 * Updates an outbound line.
	 *
	 * @param id The line to update.
	 * @param entity The fields to change.
	 * @returns The updated line.
	 */
	@ApiOperation({ summary: 'Update an exchange line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was updated.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrderExchangeLineDTO
	): Promise<OrderExchangeLine> {
		await this.orderExchangeLineService.update(id, entity as any);

		return await this.orderExchangeLineService.findOneByIdString(id);
	}
}

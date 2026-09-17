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
import {
	ApproveOrderExchangeDTO,
	CreateOrderExchangeCreateDTO,
	EditOrderExchangeDTO,
	ReasonedOrderExchangeActionDTO
} from './dto';
import { OrderExchange } from './order-exchange.entity';
import { OrderExchangeService } from './order-exchange.service';

/**
 * Exchanges.
 *
 * Approval is the interesting route: it is where the two halves are required to exist together and
 * where `differenceDue` is frozen. That is why the response carries the priced difference rather than
 * leaving the caller to recompute it from the lines.
 */
@ApiTags('OrderExchange')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
@Controller('/order-exchanges')
export class OrderExchangeController extends CrudController<OrderExchange> {
	constructor(private readonly orderExchangeService: OrderExchangeService) {
		super(orderExchangeService);
	}

	/**
	 * Requests an exchange against an order.
	 *
	 * @param entity The exchange.
	 * @returns The created exchange.
	 */
	@ApiOperation({ summary: 'Request an exchange' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The exchange was requested.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateOrderExchangeCreateDTO): Promise<OrderExchange> {
		return await this.orderExchangeService.create(entity as any);
	}

	/**
	 * Updates an exchange that has not been resolved yet.
	 *
	 * @param id The exchange to update.
	 * @param entity The fields to change.
	 * @returns The updated exchange.
	 */
	@ApiOperation({ summary: 'Update an open exchange' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The exchange was updated.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: EditOrderExchangeDTO
	): Promise<OrderExchange> {
		const { lines, ...changes } = entity;

		if (changes.allowBackorder !== undefined || changes.note !== undefined) {
			await this.orderExchangeService.update(id, changes as any);
		}

		if (lines?.length) {
			await this.orderExchangeService.replaceLines(id, lines as any);
		}

		return await this.orderExchangeService.findOneDetailed(id);
	}

	/**
	 * Approves an exchange, pricing the difference between the two halves.
	 *
	 * @param id The exchange to approve.
	 * @param entity The settlement flag and note.
	 * @returns The approved exchange.
	 */
	@ApiOperation({ summary: 'Approve an exchange and price the difference' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The exchange was approved.' })
	@Permissions(ReturnsPermissions.EXCHANGES_RESOLVE)
	@Post(':id/approve')
	@UseValidationPipe({ transform: true, whitelist: true })
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ApproveOrderExchangeDTO
	): Promise<OrderExchange> {
		return await this.orderExchangeService.approve(id, entity.note);
	}

	/**
	 * Rejects an exchange.
	 *
	 * @param id The exchange to reject.
	 * @param entity Why it was rejected.
	 * @returns The rejected exchange.
	 */
	@ApiOperation({ summary: 'Reject an exchange' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The exchange was rejected.' })
	@Permissions(ReturnsPermissions.EXCHANGES_RESOLVE)
	@Post(':id/reject')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reject(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderExchangeActionDTO
	): Promise<OrderExchange> {
		return await this.orderExchangeService.reject(id, entity.reason);
	}

	/**
	 * Cancels an exchange.
	 *
	 * @param id The exchange to cancel.
	 * @param entity Why it was cancelled.
	 * @returns The cancelled exchange.
	 */
	@ApiOperation({ summary: 'Cancel an exchange' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The exchange was cancelled.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@Post(':id/cancel')
	@UseValidationPipe({ transform: true, whitelist: true })
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderExchangeActionDTO
	): Promise<OrderExchange> {
		return await this.orderExchangeService.cancel(id, entity.reason);
	}

	/**
	 * Closes an exchange whose two halves settled.
	 *
	 * @param id The exchange to close.
	 * @param entity An optional note.
	 * @returns The closed exchange.
	 */
	@ApiOperation({ summary: 'Close an exchange' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The exchange was closed.' })
	@Permissions(ReturnsPermissions.EXCHANGES_RESOLVE)
	@Post(':id/close')
	@UseValidationPipe({ transform: true, whitelist: true })
	async close(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReasonedOrderExchangeActionDTO
	): Promise<OrderExchange> {
		return await this.orderExchangeService.close(id, entity.note);
	}

	/**
	 * Reads an exchange with its outbound lines and its inbound return.
	 *
	 * @param id The exchange to read.
	 * @returns The exchange.
	 */
	@ApiOperation({ summary: 'Find an exchange with its lines and difference' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The exchange was found.' })
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<OrderExchange> {
		return await this.orderExchangeService.findOneDetailed(id);
	}

	/**
	 * Lists exchanges.
	 *
	 * @param options The filter, including `filter[status]` and `filter[orderId]`.
	 * @returns The exchanges, paginated.
	 */
	@ApiOperation({ summary: 'List exchanges' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The exchanges were listed.' })
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async findAll(@Query() options: BaseQueryDTO<OrderExchange>): Promise<IPagination<OrderExchange>> {
		return await this.orderExchangeService.findAll(options);
	}
}

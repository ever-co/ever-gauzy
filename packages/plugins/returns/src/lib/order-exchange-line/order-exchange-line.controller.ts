import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
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
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
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

	/**
	 * Deletes an exchange line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. This line joins an exchange, and the plugin declares no
	 * `EXCHANGES_DELETE`, so this states `EXCHANGES_CREATE`, the grant that already lets a caller
	 * write an exchange line.
	 *
	 * @param id The exchange line to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete an exchange line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was deleted.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes an exchange line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id/soft` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Soft removal is the same destructive write staged for recovery,
	 * so it states `EXCHANGES_CREATE` as well.
	 *
	 * @param id The exchange line to soft delete.
	 * @returns The soft-deleted exchange line.
	 */
	@ApiOperation({ summary: 'Soft delete an exchange line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was soft deleted.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted exchange line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `PUT :id/recover` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Restoring is the same destructive grant exercised backwards, so
	 * it states `EXCHANGES_CREATE` as well.
	 *
	 * @param id The exchange line to restore.
	 * @returns The restored exchange line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted exchange line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was restored.' })
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}

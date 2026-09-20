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
	// The route the CRUD base maps for this method. An override replaces the inherited
	// method *and* its decorators, so the overriding controller restates it.
	@Get()
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

	/**
	 * Deletes a return line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. This line joins a return, and the plugin declares no
	 * `RETURNS_DELETE`, so this states `RETURNS_CREATE`, the grant that already lets a caller write a
	 * return line.
	 *
	 * @param id The return line to delete.
	 * @returns The result of the delete.
	 */
	@ApiOperation({ summary: 'Delete a return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was deleted.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft-deletes a return line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `DELETE :id/soft` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Soft removal is the same destructive write staged for recovery,
	 * so it states `RETURNS_CREATE` as well.
	 *
	 * @param id The return line to soft delete.
	 * @returns The soft-deleted return line.
	 */
	@ApiOperation({ summary: 'Soft delete a return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was soft deleted.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a soft-deleted return line.
	 *
	 * The route belongs to `CrudController`, and this override exists only to state its permission:
	 * the base declares `PUT :id/recover` with no permission metadata at all, and `PermissionGuard`
	 * (`packages/core/src/lib/shared/guards/permission.guard.ts`) returns `true` to empty metadata —
	 * `if (isEmpty(permissions)) { return true; }` — so the inherited handler stands on the
	 * class-level read grant alone. Restoring is the same destructive grant exercised backwards, so
	 * it states `RETURNS_CREATE` as well.
	 *
	 * @param id The return line to restore.
	 * @returns The restored return line.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted return line' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The line was restored.' })
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}

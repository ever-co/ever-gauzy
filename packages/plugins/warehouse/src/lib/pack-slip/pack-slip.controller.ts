import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IPagination } from '@gauzy/contracts';
import {
	AbstractValidationPipe,
	BaseQueryDTO,
	CrudController,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { PackSlip } from './pack-slip.entity';
import { PackSlipService } from './pack-slip.service';
import { CancelPackSlipDTO, CreatePackSlipDTO, PackSlipContentDTO, PackSlipDTO, UpdatePackSlipDTO } from './dto';

/**
 * Packing records.
 *
 * A pack slip exists to ship a fulfilment and it hangs off it, so it is authorised with the fulfilment
 * values rather than with a parallel set: a role that may pack is a role that may edit fulfilments, and
 * a second spelling of the same right is how two roles that should be one drift apart.
 */
@ApiTags('PackSlip')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
@Controller('/pack-slips')
export class PackSlipController extends CrudController<PackSlip> {
	constructor(private readonly packSlipService: PackSlipService) {
		super(packSlipService);
	}

	/**
	 * Lists pack slips.
	 *
	 * @param options The filter, including `filter[status]` and `filter[pickListId]`.
	 * @returns The slips, paginated.
	 */
	@ApiOperation({ summary: 'List pack slips' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The slips were listed.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<PackSlip>): Promise<IPagination<PackSlip>> {
		return await this.packSlipService.findAll(options);
	}

	/**
	 * Reads a slip with the lines it covers.
	 *
	 * @param id The slip.
	 * @returns The slip.
	 */
	@ApiOperation({ summary: 'Read a pack slip with its contents' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The slip was found.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<PackSlip> {
		return await this.packSlipService.findOneDetailed(id);
	}

	/**
	 * Creates a slip from a picked list.
	 *
	 * @param entity The slip to create.
	 * @returns The created slip.
	 */
	@ApiOperation({ summary: 'Create a pack slip from a picked list' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The slip was created.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The list is not picked yet.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreatePackSlipDTO): Promise<PackSlip> {
		return await this.packSlipService.create(entity as any);
	}

	/**
	 * Updates an open slip.
	 *
	 * @param id The slip.
	 * @param entity The fields to change.
	 * @returns The updated slip.
	 */
	@ApiOperation({ summary: 'Update an open pack slip' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The slip was updated.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdatePackSlipDTO & PackSlipDTO
	): Promise<PackSlip> {
		await this.packSlipService.update(id, entity as any);

		return await this.packSlipService.findOneDetailed(id);
	}

	/**
	 * Records the packing and seals the slip.
	 *
	 * @param id The slip.
	 * @param entity What the bench measured.
	 * @returns The packed slip.
	 */
	@ApiOperation({ summary: 'Record packing and seal the slip' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The slip was packed and is now immutable.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'A covered line has no outcome.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Idempotent({ scope: 'warehouse.pack', required: false, resourceType: 'pack-slip' })
	@Post(':id/pack')
	@UseValidationPipe({ transform: true, whitelist: true })
	async pack(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: PackSlipContentDTO): Promise<PackSlip> {
		return await this.packSlipService.pack(id, entity);
	}

	/**
	 * Voids a slip that was never packed.
	 *
	 * @param id The slip.
	 * @param entity Why it was voided.
	 * @returns The voided slip.
	 */
	@ApiOperation({ summary: 'Void an unpacked slip' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The slip was voided and its lines detached.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Post(':id/void')
	@UseValidationPipe({ transform: true, whitelist: true })
	async void(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: CancelPackSlipDTO): Promise<PackSlip> {
		return await this.packSlipService.cancel(id, entity.reason);
	}

	/**
	 * Delete a pack slip.
	 *
	 * The `DELETE ':id'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `FULFILLMENTS_EDIT`, the slip's edit
	 * grant, which is what the plugin's own slip writes demand.
	 *
	 * @param id The slip to delete.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete a pack slip' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The slip was deleted.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Delete(':id')
	@HttpCode(HttpStatus.ACCEPTED)
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return super.delete(id);
	}

	/**
	 * Soft delete a pack slip.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `FULFILLMENTS_EDIT`, the same grant the
	 * delete route above states.
	 *
	 * @param id The slip to soft delete.
	 * @returns The soft-deleted slip.
	 */
	@ApiOperation({ summary: 'Soft delete a pack slip' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The slip was soft deleted.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted pack slip.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `FULFILLMENTS_EDIT` — restoring is the
	 * same grant exercised backwards, exactly as the delete route above states it.
	 *
	 * @param id The slip to restore.
	 * @returns The restored slip.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted pack slip' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The slip was restored.' })
	@Permissions(WarehousePermissions.FULFILLMENTS_EDIT)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
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
import { WarehouseFeatures } from '../warehouse.features';
import { WarehousePermissions } from '../warehouse.permissions';
import { WarehouseZone } from './warehouse-zone.entity';
import { WarehouseZoneService } from './warehouse-zone.service';
import {
	CreateWarehouseZoneDTO,
	ReorderWarehouseZonesDTO,
	UpdateWarehouseZoneDTO,
	WarehouseZoneDTO
} from './dto';

/**
 * The areas of a stock location.
 *
 * The visiting order is the one thing on this surface that is not a field of a zone but a property of
 * the set, so it has a route of its own and it is written whole: two zones sharing a position is a pick
 * path that depends on the order the database happens to return rows in.
 */
@ApiTags('WarehouseZone')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(WarehouseFeatures.WAREHOUSE)
@Permissions(WarehousePermissions.WAREHOUSE_ZONES_VIEW)
@Controller('/warehouse-zones')
export class WarehouseZoneController extends CrudController<WarehouseZone> {
	constructor(private readonly warehouseZoneService: WarehouseZoneService) {
		super(warehouseZoneService);
	}

	/**
	 * Lists the zones of a location.
	 *
	 * @param options The filter, including `filter[warehouseId]` and `filter[type]`.
	 * @returns The zones, paginated.
	 */
	@ApiOperation({ summary: 'List warehouse zones' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The zones were listed.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_VIEW)
	@Get()
	async findAll(@Query() options: BaseQueryDTO<WarehouseZone>): Promise<IPagination<WarehouseZone>> {
		return await this.warehouseZoneService.findAll(options);
	}

	/**
	 * Reads a zone with its bins.
	 *
	 * @param id The zone.
	 * @returns The zone.
	 */
	@ApiOperation({ summary: 'Read a zone with its bins' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The zone was found.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<WarehouseZone> {
		return await this.warehouseZoneService.findOneDetailed(id);
	}

	/**
	 * Creates a zone inside a location.
	 *
	 * @param entity The zone to create.
	 * @returns The created zone.
	 */
	@ApiOperation({ summary: 'Create a zone inside a location' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The zone was created.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateWarehouseZoneDTO): Promise<WarehouseZone> {
		return await this.warehouseZoneService.create(entity as any);
	}

	/**
	 * Updates a zone.
	 *
	 * @param id The zone.
	 * @param entity The fields to change.
	 * @returns The updated zone.
	 */
	@ApiOperation({ summary: 'Update a zone' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The zone was updated.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateWarehouseZoneDTO & WarehouseZoneDTO
	): Promise<WarehouseZone> {
		return await this.warehouseZoneService.update(id, entity as any);
	}

	/**
	 * Rewrites the walking order of a location's zones.
	 *
	 * @param entity The zones and their new positions.
	 * @returns The zones in their new order.
	 */
	@ApiOperation({ summary: 'Rewrite the visiting order of the zones of a location' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The zones were reordered.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@Post('/reorder')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reorder(@Body() entity: ReorderWarehouseZonesDTO): Promise<WarehouseZone[]> {
		return await this.warehouseZoneService.reorder(entity.warehouseId, entity.zones);
	}

	/**
	 * Takes a zone out of service, or puts it back.
	 *
	 * @param id The zone.
	 * @returns The zone.
	 */
	@ApiOperation({ summary: 'Block or unblock a zone' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The zone was blocked or unblocked.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@Post(':id/block')
	async block(@Param('id', UUIDValidationPipe) id: ID): Promise<WarehouseZone> {
		return await this.warehouseZoneService.setBlocked(id, true);
	}

	/**
	 * Puts a blocked zone back into service.
	 *
	 * @param id The zone.
	 * @returns The zone.
	 */
	@ApiOperation({ summary: 'Put a blocked zone back into service' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The zone was unblocked.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_EDIT)
	@Post(':id/unblock')
	async unblock(@Param('id', UUIDValidationPipe) id: ID): Promise<WarehouseZone> {
		return await this.warehouseZoneService.setBlocked(id, false);
	}

	/**
	 * Deletes a zone that holds no bin.
	 *
	 * @param id The zone.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete an empty zone' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The zone was deleted.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'The zone still holds positions.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_DELETE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return super.delete(id);
	}

	/**
	 * Soft delete a zone.
	 *
	 * The `DELETE ':id/soft'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `WAREHOUSE_ZONES_DELETE`, the grant the
	 * plugin's own `deleteWarehouseZone` mutation carries, so both surfaces ask the same caller.
	 *
	 * @param id The zone to soft delete.
	 * @returns The soft-deleted zone.
	 */
	@ApiOperation({ summary: 'Soft delete a zone' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The zone was soft deleted.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_DELETE)
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restore a soft-deleted zone.
	 *
	 * The `PUT ':id/recover'` route belongs to `CrudController`, and this override exists only to state the
	 * permission it demands. The base declares the route with no permission metadata at all, so
	 * `PermissionGuard` (`packages/core/src/lib/shared/guards/permission.guard.ts`) answers `true` to that
	 * empty metadata with its `isEmpty(permissions)` return, which left the inherited handler standing on
	 * this controller's class-level read grant alone. It now states `WAREHOUSE_ZONES_DELETE` — restoring is
	 * the same grant exercised backwards, exactly as the delete route above states it.
	 *
	 * @param id The zone to restore.
	 * @returns The restored zone.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted zone' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The zone was restored.' })
	@Permissions(WarehousePermissions.WAREHOUSE_ZONES_DELETE)
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return await super.softRecover(id, ...options);
	}
}

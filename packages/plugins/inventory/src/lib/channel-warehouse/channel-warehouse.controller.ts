import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe
} from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { ChannelWarehouse } from './channel-warehouse.entity';
import { ChannelWarehouseService } from './channel-warehouse.service';
import { AssignChannelWarehouseDTO, ChannelWarehouseDTO, ChannelWarehouseQueryDTO  } from './dto';

/**
 * The channel-assignment resource.
 */
@ApiTags('ChannelWarehouse')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/channel-warehouses')
export class ChannelWarehouseController {
	constructor(private readonly channelWarehouseService: ChannelWarehouseService) {}

	/** Lists the assignments of a context or of a location. */
	@ApiOperation({ summary: 'List channel warehouse assignments' })
	@ApiResponse({ status: 200, description: 'Assignments found.' })
	@Get()
	async findAll(@Query() filter: ChannelWarehouseQueryDTO): Promise<IPagination<ChannelWarehouse>> {
		const { take, skip, withDeleted, ...where } = filter;

		return await this.channelWarehouseService.findAssignments({
			where: where as any,
			...(take ? { take: Number(take) } : {}),
			...(skip ? { skip: Number(skip) } : {}),
			...(withDeleted ? { withDeleted: true } : {})
		});
	}

	/** Reads one assignment. */
	@ApiOperation({ summary: 'Find one channel warehouse assignment by id' })
	@ApiResponse({ status: 200, description: 'Assignment found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<ChannelWarehouse> {
		return await this.channelWarehouseService.findOneByIdString(id);
	}

	/** Assigns a location to a context. */
	@ApiOperation({ summary: 'Assign a location to a channel' })
	@ApiResponse({ status: 201, description: 'Location assigned.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async assign(@Body() entity: AssignChannelWarehouseDTO): Promise<ChannelWarehouse> {
		return await this.channelWarehouseService.assign(entity as any);
	}

	/** Removes an assignment. */
	@ApiOperation({ summary: 'Unassign a location from a channel' })
	@ApiResponse({ status: 202, description: 'Location unassigned.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Delete(':channelId/:warehouseId')
	async unassign(
		@Param('channelId', UUIDValidationPipe) channelId: ID,
		@Param('warehouseId', UUIDValidationPipe) warehouseId: ID
	): Promise<void> {
		await this.channelWarehouseService.unassign(channelId, warehouseId);
	}
}

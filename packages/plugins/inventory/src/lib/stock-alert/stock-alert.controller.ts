import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
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
import { StockAlert } from './stock-alert.entity';
import { StockAlertService } from './stock-alert.service';
import { CreateStockAlertDTO, StockAlertDTO, UpdateStockAlertDTO } from './dto';

/**
 * The alert-rule resource.
 */
@ApiTags('StockAlert')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-alerts')
export class StockAlertController {
	constructor(private readonly stockAlertService: StockAlertService) {}

	/** Lists alert rules. */
	@ApiOperation({ summary: 'List stock alert rules' })
	@ApiResponse({ status: 200, description: 'Rules found.' })
	@Get()
	async findAll(@Query() filter: StockAlertDTO): Promise<IPagination<StockAlert>> {
		return await this.stockAlertService.findAlerts({ where: filter as any });
	}

	/** Reads one rule. */
	@ApiOperation({ summary: 'Find one stock alert rule by id' })
	@ApiResponse({ status: 200, description: 'Rule found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockAlert> {
		return await this.stockAlertService.findOneByIdString(id);
	}

	/** Creates a rule. */
	@ApiOperation({ summary: 'Create a stock alert rule' })
	@ApiResponse({ status: 201, description: 'Rule created.' })
	@ApiResponse({ status: 409, description: 'A rule already watches this variant at this location.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStockAlertDTO): Promise<StockAlert> {
		return await this.stockAlertService.createAlert(entity as any);
	}

	/** Updates a rule. */
	@ApiOperation({ summary: 'Update a stock alert rule' })
	@ApiResponse({ status: 202, description: 'Rule updated.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateStockAlertDTO) {
		return await this.stockAlertService.update(id, entity as any);
	}

	/** Deletes a rule. */
	@ApiOperation({ summary: 'Delete a stock alert rule' })
	@ApiResponse({ status: 202, description: 'Rule deleted.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID) {
		return await this.stockAlertService.delete(id);
	}
}

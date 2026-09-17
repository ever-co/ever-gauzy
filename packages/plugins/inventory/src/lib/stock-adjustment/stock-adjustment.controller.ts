import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { StockAdjustment } from './stock-adjustment.entity';
import { StockAdjustmentService } from './stock-adjustment.service';
import { CreateStockAdjustmentDTO, StockAdjustmentDTO } from './dto';

/**
 * The manual-correction resource: draft an instruction, apply it, cancel it.
 */
@ApiTags('StockAdjustment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-adjustments')
export class StockAdjustmentController {
	constructor(private readonly stockAdjustmentService: StockAdjustmentService) {}

	/** Lists instructions. */
	@ApiOperation({ summary: 'List stock adjustments' })
	@ApiResponse({ status: 200, description: 'Adjustments found.' })
	@Get()
	async findAll(@Query() filter: StockAdjustmentDTO): Promise<IPagination<StockAdjustment>> {
		return await this.stockAdjustmentService.findAdjustments({ where: filter as any });
	}

	/** Reads one instruction. */
	@ApiOperation({ summary: 'Find one stock adjustment by id' })
	@ApiResponse({ status: 200, description: 'Adjustment found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockAdjustment> {
		return await this.stockAdjustmentService.findOneByIdString(id);
	}

	/** Drafts an instruction. */
	@ApiOperation({ summary: 'Create a stock adjustment' })
	@ApiResponse({ status: 201, description: 'Adjustment drafted.' })
	@ApiResponse({ status: 400, description: 'No reason was stated.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStockAdjustmentDTO): Promise<StockAdjustment> {
		return await this.stockAdjustmentService.createAdjustment(entity as any);
	}

	/** Applies a drafted instruction, writing its ledger row. */
	@ApiOperation({ summary: 'Apply a stock adjustment' })
	@ApiResponse({ status: 202, description: 'Adjustment applied.' })
	@ApiResponse({ status: 409, description: 'The instruction was already applied, or the correction would break a hold.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/apply')
	async apply(@Param('id', UUIDValidationPipe) id: ID) {
		return await this.stockAdjustmentService.apply(id);
	}

	/** Cancels a drafted instruction. */
	@ApiOperation({ summary: 'Cancel a stock adjustment' })
	@ApiResponse({ status: 202, description: 'Adjustment canceled.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/cancel')
	async cancel(@Param('id', UUIDValidationPipe) id: ID): Promise<StockAdjustment> {
		return await this.stockAdjustmentService.cancel(id);
	}
}

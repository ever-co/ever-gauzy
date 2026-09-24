import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	Versioned
} from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { StockAdjustment } from './stock-adjustment.entity';
import { StockAdjustmentService } from './stock-adjustment.service';
import { CreateStockAdjustmentDTO, StockAdjustmentQueryDTO } from './dto';
import { STOCK_LEVEL_VERSION_TARGET } from './../stock-level/stock-level.types';

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
	async findAll(@Query() filter: StockAdjustmentQueryDTO): Promise<IPagination<StockAdjustment>> {
		const { take, skip, withDeleted, ...where } = filter;

		return await this.stockAdjustmentService.findAdjustments({
			where: where as any,
			...(take ? { take: Number(take) } : {}),
			...(skip ? { skip: Number(skip) } : {}),
			...(withDeleted ? { withDeleted: true } : {})
		});
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

	/**
	 * Applies a drafted instruction, writing its ledger row.
	 *
	 * The signed change lands on one level — the instruction names one variant at one location — so
	 * this is the route where a caller's read genuinely decides its write: an operator who saw 40 on
	 * hand and writes 25 off is correcting a number that may already be 30. The version the caller read
	 * is therefore required, and a level that has moved since is refused rather than corrected from a
	 * value that no longer exists.
	 *
	 * The key is optional because the operation is a delta: a retry without one applies the correction
	 * twice, which is exactly what presenting a key prevents, and a client that does not retry is not
	 * forced to invent one.
	 */
	@ApiOperation({ summary: 'Apply a stock adjustment' })
	@ApiResponse({ status: 202, description: 'Adjustment applied.' })
	@ApiResponse({ status: 409, description: 'The instruction was already applied, or the correction would break a hold.' })
	@ApiResponse({ status: 428, description: 'The version the correction was based on was not stated.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ target: STOCK_LEVEL_VERSION_TARGET })
	@Idempotent({ scope: 'stock.adjust', required: false, resourceType: 'stock-adjustment' })
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

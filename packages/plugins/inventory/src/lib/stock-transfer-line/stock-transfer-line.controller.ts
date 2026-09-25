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
import { isQueryFlagSet } from './../inventory.query';
import { StockTransferLine } from './stock-transfer-line.entity';
import { StockTransferLineService } from './stock-transfer-line.service';
import { CreateStockTransferLineDTO, StockTransferLineDTO, StockTransferLineQueryDTO  } from './dto';

/**
 * The lines of a transfer, exposed so a caller can read and extend a draft.
 */
@ApiTags('StockTransferLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
@Controller('/stock-transfer-lines')
export class StockTransferLineController {
	constructor(private readonly stockTransferLineService: StockTransferLineService) {}

	/** Lists transfer lines. */
	@ApiOperation({ summary: 'List stock transfer lines' })
	@ApiResponse({ status: 200, description: 'Lines found.' })
	@Get()
	async findAll(@Query() filter: StockTransferLineQueryDTO): Promise<IPagination<StockTransferLine>> {
		const { take, skip, withDeleted, ...where } = filter;

		return await this.stockTransferLineService.findLines({
			where: where as any,
			...(take ? { take: Number(take) } : {}),
			...(skip ? { skip: Number(skip) } : {}),
			// The raw query value: no validation pipe runs here, so the DTO's transform never turned
			// `'false'` into `false`, and a truthiness test lifted the soft-delete filter for it.
			...(isQueryFlagSet(withDeleted) ? { withDeleted: true } : {})
		});
	}

	/** Reads one transfer line. */
	@ApiOperation({ summary: 'Find one stock transfer line by id' })
	@ApiResponse({ status: 200, description: 'Line found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockTransferLine> {
		return await this.stockTransferLineService.findOneByIdString(id);
	}

	/** Adds a variant to a draft transfer. */
	@ApiOperation({ summary: 'Add a line to a draft transfer' })
	@ApiResponse({ status: 201, description: 'Line added.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStockTransferLineDTO): Promise<StockTransferLine> {
		return await this.stockTransferLineService.addLine(entity as any);
	}
}

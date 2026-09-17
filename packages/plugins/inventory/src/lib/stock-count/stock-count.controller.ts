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
import { StockCount } from './stock-count.entity';
import { StockCountService } from './stock-count.service';
import { CreateStockCountDTO, RecordStockCountLinesDTO, StockCountDTO } from './dto';

/**
 * The physical-count resource: create a session, open it, record readings, close it.
 */
@ApiTags('StockCount')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-counts')
export class StockCountController {
	constructor(private readonly stockCountService: StockCountService) {}

	/** Lists count sessions. */
	@ApiOperation({ summary: 'List stock count sessions' })
	@ApiResponse({ status: 200, description: 'Sessions found.' })
	@Get()
	async findAll(@Query() filter: StockCountDTO): Promise<IPagination<StockCount>> {
		return await this.stockCountService.findCounts({ where: filter as any });
	}

	/** Reads one session. */
	@ApiOperation({ summary: 'Find one stock count session by id' })
	@ApiResponse({ status: 200, description: 'Session found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockCount> {
		return await this.stockCountService.findOneByIdString(id);
	}

	/** Reads the lines of a session. The expectation is withheld for a blind count. */
	@ApiOperation({ summary: 'List the lines of a count session' })
	@ApiResponse({ status: 200, description: 'Lines found.' })
	@Get(':id/lines')
	async lines(@Param('id', UUIDValidationPipe) id: ID) {
		const count = await this.stockCountService.findOneByIdString(id);
		return await this.stockCountService.listLines(id, !count.blindCount);
	}

	/** Creates a draft session. */
	@ApiOperation({ summary: 'Create a stock count session' })
	@ApiResponse({ status: 201, description: 'Session created.' })
	@ApiResponse({ status: 409, description: 'A session is already open for this location.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStockCountDTO): Promise<StockCount> {
		return await this.stockCountService.createCount(entity as any);
	}

	/** Opens a session: generates its lines and snapshots the expectation. */
	@ApiOperation({ summary: 'Open a stock count session' })
	@ApiResponse({ status: 202, description: 'Session opened.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/open')
	async open(@Param('id', UUIDValidationPipe) id: ID): Promise<StockCount> {
		return await this.stockCountService.open(id);
	}

	/** Records counted quantities for a batch of lines. */
	@ApiOperation({ summary: 'Record counted quantities' })
	@ApiResponse({ status: 202, description: 'Readings recorded.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/count')
	@UseValidationPipe({ transform: true, whitelist: true })
	async count(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: RecordStockCountLinesDTO): Promise<StockCount> {
		return await this.stockCountService.recordLines(id, entity.lines);
	}

	/** Closes a session and writes its corrections to the ledger. */
	@ApiOperation({ summary: 'Close a stock count session' })
	@ApiResponse({ status: 202, description: 'Session closed.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/close')
	async close(@Param('id', UUIDValidationPipe) id: ID) {
		return await this.stockCountService.close(id);
	}

	/** Cancels a session without writing the ledger. */
	@ApiOperation({ summary: 'Cancel a stock count session' })
	@ApiResponse({ status: 202, description: 'Session canceled.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/cancel')
	async cancel(@Param('id', UUIDValidationPipe) id: ID): Promise<StockCount> {
		return await this.stockCountService.cancel(id);
	}
}

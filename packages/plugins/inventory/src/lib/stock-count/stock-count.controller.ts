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
import { StockCount } from './stock-count.entity';
import { StockCountService } from './stock-count.service';
import { CreateStockCountDTO, RecordStockCountLinesDTO, StockCountDTO, StockCountQueryDTO  } from './dto';

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
	async findAll(@Query() filter: StockCountQueryDTO): Promise<IPagination<StockCount>> {
		const { take, skip, withDeleted, ...where } = filter;

		return await this.stockCountService.findCounts({
			where: where as any,
			...(take ? { take: Number(take) } : {}),
			...(skip ? { skip: Number(skip) } : {}),
			...(withDeleted ? { withDeleted: true } : {})
		});
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

	/**
	 * Records counted quantities for a batch of lines.
	 *
	 * The readings themselves are a write on the session and not on the levels — nothing is moved until
	 * the session closes — so this route carries the key and not the version: a retry that recorded the
	 * same readings twice would double-count a batch of the variance.
	 */
	@ApiOperation({ summary: 'Record counted quantities' })
	@ApiResponse({ status: 202, description: 'Readings recorded.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Idempotent({ scope: 'stock.count', required: false, resourceType: 'stock-count' })
	@Post(':id/count')
	@UseValidationPipe({ transform: true, whitelist: true })
	async count(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: RecordStockCountLinesDTO): Promise<StockCount> {
		return await this.stockCountService.recordLines(id, entity.lines);
	}

	/**
	 * Closes a session and writes its corrections to the ledger.
	 *
	 * The corrections land on the levels of the lines the session covers, so a caller cannot state one
	 * version for all of them: a stated version is honoured for the level it names, and every
	 * correction is still written under the engine's compare-and-set. The key is what makes a retry of
	 * the close safe, because a second close would write a second set of corrections.
	 */
	@ApiOperation({ summary: 'Close a stock count session' })
	@ApiResponse({ status: 202, description: 'Session closed.' })
	@ApiResponse({ status: 409, description: 'A level moved past the version the close was based on.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false })
	@Idempotent({ scope: 'stock.count', required: false, resourceType: 'stock-count' })
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

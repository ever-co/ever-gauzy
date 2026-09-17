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
import { StockTransfer } from './stock-transfer.entity';
import { StockTransferService } from './stock-transfer.service';
import {
	CreateStockTransferDTO,
	ReceiveStockTransferDTO,
	ShipStockTransferDTO,
	StockTransferDTO,
	UpdateStockTransferDTO
} from './dto';

/**
 * The transfer resource: draft it, approve it, dispatch it, receive it.
 */
@ApiTags('StockTransfer')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_TRANSFER_VIEW as PermissionsEnum)
@Controller('/stock-transfers')
export class StockTransferController {
	constructor(private readonly stockTransferService: StockTransferService) {}

	/** Lists transfers. */
	@ApiOperation({ summary: 'List stock transfers' })
	@ApiResponse({ status: 200, description: 'Transfers found.' })
	@Get()
	async findAll(@Query() filter: StockTransferDTO): Promise<IPagination<StockTransfer>> {
		return await this.stockTransferService.findTransfers({ where: filter as any });
	}

	/** Reads one transfer. */
	@ApiOperation({ summary: 'Find one stock transfer by id' })
	@ApiResponse({ status: 200, description: 'Transfer found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockTransfer> {
		return await this.stockTransferService.findOneByIdString(id);
	}

	/** Creates a draft transfer. */
	@ApiOperation({ summary: 'Create a stock transfer' })
	@ApiResponse({ status: 201, description: 'Transfer created.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStockTransferDTO): Promise<StockTransfer> {
		return await this.stockTransferService.createTransfer(entity as any);
	}

	/** Updates the note of a draft transfer. */
	@ApiOperation({ summary: 'Update a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer updated.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Post(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateStockTransferDTO) {
		return await this.stockTransferService.update(id, entity as any);
	}

	/** Submits a draft transfer for approval. */
	@ApiOperation({ summary: 'Submit a stock transfer for approval' })
	@ApiResponse({ status: 202, description: 'Transfer requested.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Post(':id/request')
	async request(@Param('id', UUIDValidationPipe) id: ID): Promise<StockTransfer> {
		return await this.stockTransferService.request(id);
	}

	/** Approves a requested transfer. */
	@ApiOperation({ summary: 'Approve a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer approved.' })
	@ApiResponse({ status: 409, description: 'The transfer is in the wrong state.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_APPROVE as PermissionsEnum)
	@Post(':id/approve')
	async approve(@Param('id', UUIDValidationPipe) id: ID): Promise<StockTransfer> {
		return await this.stockTransferService.approve(id);
	}

	/** Dispatches a transfer and writes the outbound movements. */
	@ApiOperation({ summary: 'Ship a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer dispatched.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_SHIP as PermissionsEnum)
	@Post(':id/ship')
	@UseValidationPipe({ transform: true, whitelist: true })
	async ship(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: ShipStockTransferDTO): Promise<StockTransfer> {
		return await this.stockTransferService.ship(id, entity.lines);
	}

	/** Receives a transfer and writes the inbound movements. */
	@ApiOperation({ summary: 'Receive a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer received.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_RECEIVE as PermissionsEnum)
	@Post(':id/receive')
	@UseValidationPipe({ transform: true, whitelist: true })
	async receive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReceiveStockTransferDTO
	): Promise<StockTransfer> {
		return await this.stockTransferService.receive(id, entity.lines);
	}

	/** Cancels a transfer that has not been fully received. */
	@ApiOperation({ summary: 'Cancel a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer canceled.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CANCEL as PermissionsEnum)
	@Post(':id/cancel')
	async cancel(@Param('id', UUIDValidationPipe) id: ID, @Query('reason') reason?: string): Promise<StockTransfer> {
		return await this.stockTransferService.cancel(id, reason);
	}
}

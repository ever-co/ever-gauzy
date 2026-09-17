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
import { StockReservation } from './stock-reservation.entity';
import { StockReservationService } from './stock-reservation.service';
import { CreateStockReservationDTO, StockReservationDTO, UpdateStockReservationDTO } from './dto';

/**
 * The reservation resource: hold stock, release it, consume it, push its expiry out.
 */
@ApiTags('StockReservation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-reservations')
export class StockReservationController {
	constructor(private readonly stockReservationService: StockReservationService) {}

	/** Lists holds. */
	@ApiOperation({ summary: 'List stock reservations' })
	@ApiResponse({ status: 200, description: 'Reservations found.' })
	@Get()
	async findAll(@Query() filter: StockReservationDTO): Promise<IPagination<StockReservation>> {
		return await this.stockReservationService.findReservations({ where: filter as any });
	}

	/** Reads one hold. */
	@ApiOperation({ summary: 'Find one stock reservation by id' })
	@ApiResponse({ status: 200, description: 'Reservation found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockReservation> {
		return await this.stockReservationService.findOneByIdString(id);
	}

	/** Holds stock for a document. */
	@ApiOperation({ summary: 'Reserve stock' })
	@ApiResponse({ status: 201, description: 'Stock reserved.' })
	@ApiResponse({ status: 409, description: 'Availability does not cover the requested hold.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateStockReservationDTO): Promise<StockReservation> {
		return await this.stockReservationService.reserve(entity as any);
	}

	/** Updates the mutable fields of a hold; the quantity and the location are not among them. */
	@ApiOperation({ summary: 'Update a stock reservation' })
	@ApiResponse({ status: 202, description: 'Reservation updated.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateStockReservationDTO) {
		return await this.stockReservationService.update(id, entity as any);
	}

	/** Releases a hold without the stock leaving. */
	@ApiOperation({ summary: 'Release a stock reservation' })
	@ApiResponse({ status: 202, description: 'Reservation released.' })
	@ApiResponse({ status: 409, description: 'The reservation was already closed.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/release')
	async release(@Param('id', UUIDValidationPipe) id: ID, @Query('reason') reason?: string): Promise<StockReservation> {
		return await this.stockReservationService.release(id, reason);
	}

	/** Pushes the expiry of every active hold of a document. */
	@ApiOperation({ summary: 'Extend the expiry of the holds of a document' })
	@ApiResponse({ status: 202, description: 'Holds extended.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/extend')
	async extend(@Param('id', UUIDValidationPipe) id: ID, @Query('expiresAt') expiresAt: string): Promise<number> {
		return await this.stockReservationService.extend(id as any, id, new Date(expiresAt));
	}
}

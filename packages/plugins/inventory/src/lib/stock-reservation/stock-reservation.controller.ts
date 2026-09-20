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

	/**
	 * Holds stock for a document.
	 *
	 * Whether the hold fits is decided from the level the caller read, so the version it read is
	 * required: a level that has moved since is a level whose availability is no longer the one the
	 * decision was made on, and granting the hold anyway is how two documents oversell one bin.
	 *
	 * The key is optional — a hold is a delta on the reserved quantity, and a retry without a key
	 * reserves the same units twice.
	 */
	@ApiOperation({ summary: 'Reserve stock' })
	@ApiResponse({ status: 201, description: 'Stock reserved.' })
	@ApiResponse({ status: 409, description: 'Availability does not cover the requested hold.' })
	@ApiResponse({ status: 428, description: 'The version the hold was based on was not stated.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned()
	@Idempotent({ scope: 'stock.reservation.create', required: false, resourceType: 'stock-reservation' })
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

	/**
	 * Releases a hold without the stock leaving.
	 *
	 * The release gives the reserved quantity back to the level, so a caller that read the level may
	 * state its version and have it honoured; a caller that states none is still protected by the
	 * compare-and-set the release is written under, and by the hold's own status, which makes a second
	 * release a refusal rather than a second credit.
	 */
	@ApiOperation({ summary: 'Release a stock reservation' })
	@ApiResponse({ status: 202, description: 'Reservation released.' })
	@ApiResponse({ status: 409, description: 'The reservation was already closed.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false })
	@Idempotent({ scope: 'stock.reservation.release', required: false, resourceType: 'stock-reservation' })
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

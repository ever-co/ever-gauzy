import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { StockReservationReferenceType } from './../inventory.enums';
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

	/**
	 * Runs the expiry sweep now, for the tenant the request runs in.
	 *
	 * The sweep has a schedule of its own — `InventoryMaintenanceModule` fires it every minute — and
	 * this is the operator's way of forcing a run without waiting for it: after a bulk cart cleanup,
	 * after a deployment whose queue was down, or simply to see the number. It is the same method the
	 * worker calls, so there is one definition of which holds are eligible.
	 *
	 * It is scoped by the request like every other route here: `releaseExpired` narrows its read to the
	 * tenant the request runs in, so an operator forces a run over their own holds and not over another
	 * tenant's. The scheduled pass has no request and therefore sweeps every tenant, which is the
	 * behaviour a maintenance pass owes.
	 *
	 * The route is declared before `POST /:id` on purpose: a literal segment declared after it would be
	 * captured by the parameter route and refused as a malformed identifier instead of being served.
	 *
	 * @param batchSize How many holds one pass claims; the service's documented batch is the default.
	 * @param maxBatches How many passes this run walks at most.
	 * @returns How many holds were released, and over how many batches.
	 */
	@ApiOperation({ summary: 'Release the stock reservations whose expiry has passed' })
	@ApiResponse({ status: 200, description: 'The sweep ran and reports what it released.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post('/expire')
	async expire(
		@Query('batchSize') batchSize?: string,
		@Query('maxBatches') maxBatches?: string
	): Promise<{ released: number; batches: number }> {
		const bounded = (value: string | undefined, fallback: number): number => {
			const stated = Number(value);

			return Number.isInteger(stated) && stated > 0 ? stated : fallback;
		};

		return await this.stockReservationService.releaseExpired(bounded(batchSize, 500), bounded(maxBatches, 200));
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

	/**
	 * Consumes a hold: the held units leave, and the hold closes with them.
	 *
	 * The counterpart of the release beside it, and not a variant of it: a release gives the reserved
	 * quantity back to availability and leaves the on-hand quantity where it was, while a consumption
	 * removes both in one movement, because the units are gone and the hold on them is gone with them.
	 * It carries the same conventions as the release — the version is optional, because the
	 * compare-and-set the movement is written under is the guarantee, and a key already used for this
	 * operation is replayed rather than removing the units twice.
	 *
	 * @param id The hold to consume.
	 * @param reason Machine-readable reason recorded on the ledger row.
	 * @returns The hold, closed.
	 */
	@ApiOperation({ summary: 'Consume a stock reservation' })
	@ApiResponse({ status: 202, description: 'Reservation consumed; the units left and the hold closed with them.' })
	@ApiResponse({ status: 409, description: 'The reservation was already closed.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Versioned({ required: false })
	@Idempotent({ scope: 'stock.reservation.consume', required: false, resourceType: 'stock-reservation' })
	@Post(':id/consume')
	async consume(@Param('id', UUIDValidationPipe) id: ID, @Query('reason') reason?: string): Promise<StockReservation> {
		return await this.stockReservationService.consume(id, reason);
	}

	/**
	 * Pushes the expiry of every active hold of a document.
	 *
	 * **The path parameter is the document, not the kind of document.** It used to be passed as both —
	 * `extend(id as any, id, …)` — so the read was narrowed to `referenceType = <a uuid>`, which no row
	 * can carry: the route matched nothing, answered `0`, and every hold it was called for expired on
	 * schedule anyway. The kind is what a caller states beside it, and a caller that states none is
	 * answered for every active hold of that document, which is what this route's own summary says it
	 * does.
	 *
	 * The instant is validated rather than passed through. `new Date('later today')` is an invalid date,
	 * and writing one into `expiresAt` makes a hold that the expiry sweep can never select and that no
	 * comparison can order — a hold that is held for ever by a typo.
	 *
	 * @param id The document whose holds are pushed out.
	 * @param expiresAt The new expiry, as an ISO-8601 instant.
	 * @param referenceType The kind of document, when the caller narrows it to one.
	 * @returns How many holds were extended.
	 */
	@ApiOperation({ summary: 'Extend the expiry of the holds of a document' })
	@ApiResponse({ status: 202, description: 'Holds extended.' })
	@ApiResponse({ status: 400, description: 'The stated expiry is not an instant.' })
	@Permissions(InventoryPermission.STOCK_EDIT as PermissionsEnum)
	@Post(':id/extend')
	async extend(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('expiresAt') expiresAt: string,
		@Query('referenceType') referenceType?: StockReservationReferenceType
	): Promise<number> {
		const instant = new Date(expiresAt);

		if (!expiresAt || Number.isNaN(instant.getTime())) {
			throw new BadRequestException(
				'STOCK_RESERVATION_EXPIRY_INVALID: `expiresAt` states the instant a hold is pushed out to, as an ISO-8601 date and time.'
			);
		}

		return await this.stockReservationService.extend(referenceType as StockReservationReferenceType, id, instant);
	}
}

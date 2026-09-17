import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	UUIDValidationPipe,
	UseValidationPipe,
	parseIfMatch
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
 *
 * Every transition is a conditional request. A transfer is worked by more than one operator — one
 * drafts and approves it, another dispatches it, a third receives it — and the state machine alone
 * cannot tell a second dispatcher from a first, because both read a document that was `APPROVED` when
 * they looked. The version the caller read is therefore stated on the request, and the transition it
 * carries is refused when the document has moved past it.
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

	/**
	 * Updates the fields of a transfer.
	 *
	 * The edit is a write on a versioned document, so it takes the same precondition the transitions
	 * take and is refused with the same conflict when the transfer has moved on.
	 */
	@ApiOperation({ summary: 'Update a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer updated.' })
	@ApiResponse({ status: 409, description: 'The transfer has moved past the stated version.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Post(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateStockTransferDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<StockTransfer> {
		return await this.stockTransferService.update(id, entity as any, this.expectedVersion(ifMatch));
	}

	/** Submits a draft transfer for approval. */
	@ApiOperation({ summary: 'Submit a stock transfer for approval' })
	@ApiResponse({ status: 202, description: 'Transfer requested.' })
	@ApiResponse({ status: 409, description: 'The transfer is in the wrong state or has moved past the stated version.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CREATE as PermissionsEnum)
	@Post(':id/request')
	async request(
		@Param('id', UUIDValidationPipe) id: ID,
		@Headers('if-match') ifMatch?: string
	): Promise<StockTransfer> {
		return await this.stockTransferService.request(id, this.expectedVersion(ifMatch));
	}

	/** Approves a requested transfer. */
	@ApiOperation({ summary: 'Approve a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer approved.' })
	@ApiResponse({ status: 409, description: 'The transfer is in the wrong state or has moved past the stated version.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_APPROVE as PermissionsEnum)
	@Post(':id/approve')
	async approve(
		@Param('id', UUIDValidationPipe) id: ID,
		@Headers('if-match') ifMatch?: string
	): Promise<StockTransfer> {
		return await this.stockTransferService.approve(id, this.expectedVersion(ifMatch));
	}

	/** Dispatches a transfer and writes the outbound movements. */
	@ApiOperation({ summary: 'Ship a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer dispatched.' })
	@ApiResponse({ status: 409, description: 'The transfer is in the wrong state or has moved past the stated version.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_SHIP as PermissionsEnum)
	@Post(':id/ship')
	@UseValidationPipe({ transform: true, whitelist: true })
	async ship(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ShipStockTransferDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<StockTransfer> {
		return await this.stockTransferService.ship(id, entity.lines, this.expectedVersion(ifMatch));
	}

	/** Receives a transfer and writes the inbound movements. */
	@ApiOperation({ summary: 'Receive a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer received.' })
	@ApiResponse({ status: 409, description: 'The transfer is in the wrong state or has moved past the stated version.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_RECEIVE as PermissionsEnum)
	@Post(':id/receive')
	@UseValidationPipe({ transform: true, whitelist: true })
	async receive(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReceiveStockTransferDTO,
		@Headers('if-match') ifMatch?: string
	): Promise<StockTransfer> {
		return await this.stockTransferService.receive(id, entity.lines, this.expectedVersion(ifMatch));
	}

	/** Cancels a transfer that has not been fully received. */
	@ApiOperation({ summary: 'Cancel a stock transfer' })
	@ApiResponse({ status: 202, description: 'Transfer canceled.' })
	@ApiResponse({ status: 409, description: 'The transfer is in the wrong state or has moved past the stated version.' })
	@Permissions(InventoryPermission.STOCK_TRANSFER_CANCEL as PermissionsEnum)
	@Post(':id/cancel')
	async cancel(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('reason') reason?: string,
		@Headers('if-match') ifMatch?: string
	): Promise<StockTransfer> {
		return await this.stockTransferService.cancel(id, reason, this.expectedVersion(ifMatch));
	}

	/**
	 * The version a transition was based on, as the request states it.
	 *
	 * The header is read with the kernel's own entity-tag parser, so a quoted tag, a weak tag and a
	 * bare number all mean what they mean on every other conditional write of the platform. A request
	 * that states no header is a request that states no precondition, and the transition is then
	 * evaluated against the document alone. A header that cannot be read as a version, or that accepts
	 * several, is refused rather than ignored: a precondition that quietly degrades into an
	 * unconditional write is the failure the header exists to prevent.
	 *
	 * @param ifMatch The raw `If-Match` header, when the request carried one.
	 * @returns The version it states, or undefined when it states none.
	 * @throws BadRequestException When the header cannot be read as one version.
	 */
	private expectedVersion(ifMatch?: string): number | undefined {
		const parsed = parseIfMatch(ifMatch);

		if (!parsed) {
			return undefined;
		}
		if (parsed.status === 'invalid') {
			throw new BadRequestException('The If-Match header must state the version this request was based on.');
		}
		if (parsed.expectation.wildcard) {
			// `*` states that the document must exist and accepts whatever version it holds.
			return undefined;
		}
		if (parsed.expectation.versions.length !== 1) {
			throw new BadRequestException('The If-Match header must state a single version for a transfer transition.');
		}

		return parsed.expectation.versions[0];
	}
}

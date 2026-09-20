import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
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
import { InventoryErrorCode, inventoryError } from './../inventory.errors';
import { StockLevelService } from './stock-level.service';
import { IStockAvailability, IStockReconciliation } from './stock-level.types';
import { ReconcileStockLevelsDTO } from './dto';

/**
 * The stock level resource: what one variant holds at one location, and how that compares to the
 * movement ledger.
 *
 * There is deliberately no route that writes a quantity. A level is the cached sum of its movements,
 * so it is changed by the document that moved the stock — a receipt, a transfer, a hold, a manual
 * correction, a count — and never by a caller editing the number. The one write this resource serves
 * is the reconciliation, which corrects a level from its own ledger and records the correction as a
 * movement like every other change.
 *
 * The availability a level reports is derived on read rather than stored, so nothing here has to keep
 * a third number in step with the two it is computed from.
 */
@ApiTags('StockLevel')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-levels')
export class StockLevelController {
	constructor(private readonly stockLevelService: StockLevelService) {}

	/**
	 * Lists the levels of a location, of a variant, or of the caller's tenant.
	 */
	/**
	 * Lists the levels of a location, of a variant, or of the caller's tenant.
	 *
	 * **Both filters are optional, and saying so is the whole of this signature.** The tenant-wide read
	 * is the one an operator asks for first, and it is the one the platform's own parameter pipe cannot
	 * express: `UUIDValidationPipe` refuses an absent value outright, so a route that carried it on
	 * both filters answered `404` to every unfiltered request — the documented read was unreachable and
	 * the refusal named a missing identifier rather than the request being understood. The framework's
	 * own pipe does express it: an absent value is `undefined`, and a value that is present but is not
	 * an identifier is still a refusal.
	 */
	@ApiOperation({ summary: 'List stock levels' })
	@ApiResponse({ status: 200, description: 'Levels found.' })
	@Versioned({ write: false })
	@Get()
	async findAll(
		@Query('warehouseId', new ParseUUIDPipe({ optional: true })) warehouseId?: ID,
		@Query('variantId', new ParseUUIDPipe({ optional: true })) variantId?: ID,
		@Query('take') take?: number
	): Promise<IStockAvailability[]> {
		return await this.stockLevelService.findLevels({
			warehouseId,
			variantId,
			take: take ? Number(take) : undefined
		});
	}

	/**
	 * Reads one level, with the availability it derives.
	 *
	 * A level of another tenant is not a level this caller may read, so it is answered exactly as a
	 * level that does not exist: the id is not a capability, and the two answers are the same one.
	 */
	@ApiOperation({ summary: 'Find one stock level by id' })
	@ApiResponse({ status: 200, description: 'Level found.' })
	@ApiResponse({ status: 404, description: 'Level not found.' })
	@Versioned({ write: false })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IStockAvailability> {
		const level = await this.stockLevelService.findLevelById(id);
		if (!level) {
			throw inventoryError(InventoryErrorCode.LEVEL_NOT_FOUND, 'The stock level does not exist.', {
				notFound: true,
				details: { levelId: id }
			});
		}
		return level;
	}

	/**
	 * Recomputes the levels from the movement ledger and records every correction it made.
	 *
	 * The ledger is the truth and a level is its cache, so this is the route an operator runs when the
	 * two are suspected of disagreeing. It is a write, which is why it carries the reconciliation
	 * permission rather than the read one: a correction appends a movement to the ledger, and the
	 * ledger is the record the business is audited against.
	 *
	 * The version is optional here, and that is not a weaker guarantee. A run is scoped by location
	 * and variant and walks a batch of levels, so a caller cannot state one version for all of them;
	 * a caller that does state the version it read has it honoured for the level it names and is
	 * refused the moment that level has moved, and a caller that states none is still protected by the
	 * compare-and-set every correction is written under.
	 */
	@ApiOperation({ summary: 'Reconcile stock levels against the movement ledger' })
	@ApiResponse({ status: 202, description: 'Levels reconciled.' })
	@ApiResponse({ status: 409, description: 'A level moved past the version the run was based on.' })
	@Permissions(InventoryPermission.STOCK_RECONCILE as PermissionsEnum)
	@Versioned({ required: false })
	@Idempotent({ scope: 'stock.reconcile', required: false, resourceType: 'stock-level' })
	@Post('reconcile')
	@UseValidationPipe({ transform: true, whitelist: true })
	async reconcile(@Body() entity: ReconcileStockLevelsDTO): Promise<IStockReconciliation> {
		return await this.stockLevelService.reconcile({
			warehouseId: entity?.warehouseId as ID,
			variantId: entity?.variantId as ID,
			take: entity?.take
		});
	}
}

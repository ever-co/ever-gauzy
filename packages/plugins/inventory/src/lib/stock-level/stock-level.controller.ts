import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
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
import { IStockAvailability, IStockReconciliation, STOCK_LEVEL_VERSION_TARGET } from './stock-level.types';
import { ReconcileStockLevelsDTO } from './dto';

/**
 * The largest page `GET /stock-levels` answers, and the page it answers when none is stated: the ceiling
 * `BaseQueryDTO` puts on a list's `take`, and the size the service reads when it is handed none.
 */
const STOCK_LEVEL_PAGE_CEILING = 100;

/**
 * Turns the page a `GET /stock-levels` request states into the row window the service reads.
 *
 * The route reads `skip` as the eight other inventory list routes do — a one-based page number whose rows
 * start at `take * (skip - 1)` — and the service reads a row offset, so the page is multiplied out here.
 * Both values arrive as the strings a query string carries, and no validation pipe runs on this route, so
 * they are read as `BaseQueryDTO`'s own transform reads them (`parseInt`, base ten) and bounded as it
 * bounds them:
 *
 * - a size past 100 is read as 100, and the page is counted in that size too, so page two of a thousand
 *   is the hundred rows after the first hundred — the rows the caller is handed next — rather than a
 *   window that leaves a gap of nine hundred before it;
 * - a size below zero asks for nothing, which the service answers without a read; an absent or unreadable
 *   size is the default page of a hundred;
 * - an absent page, a page below one and an unreadable page are page one — a `skip` of zero was "no
 *   offset" before this route read pages, and it is still where the list starts;
 * - the offset is capped at the largest integer a number states exactly, so an absurd page is an empty
 *   page rather than an `OFFSET 1e+23` the database refuses to parse.
 *
 * @param take The page size, as the request stated it.
 * @param skip The one-based page number, as the request stated it.
 * @returns The row count and row offset the service reads.
 */
function stockLevelPage(take: unknown, skip: unknown): { take: number; skip: number } {
	const size = Number.parseInt(String(take), 10);
	const page = Number.parseInt(String(skip), 10);

	const rows = Number.isNaN(size) ? STOCK_LEVEL_PAGE_CEILING : Math.min(Math.max(size, 0), STOCK_LEVEL_PAGE_CEILING);
	const pageNumber = Number.isNaN(page) || page < 1 ? 1 : page;

	return { take: rows, skip: Math.min(rows * (pageNumber - 1), Number.MAX_SAFE_INTEGER) };
}

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
	 *
	 * **Both filters are optional, and saying so is the whole of this signature.** The tenant-wide read
	 * is the one an operator asks for first, and it is the one the platform's own parameter pipe cannot
	 * express: `UUIDValidationPipe` refuses an absent value outright, so a route that carried it on
	 * both filters answered `404` to every unfiltered request — the documented read was unreachable and
	 * the refusal named a missing identifier rather than the request being understood. The framework's
	 * own pipe does express it: an absent value is `undefined`, and a value that is present but is not
	 * an identifier is still a refusal.
	 *
	 * **`skip` is a one-based page number and `take` is the page size**, which is what the eight other
	 * inventory list routes mean by them: their reads go through the kernel's `paginate`, which reads the
	 * page as the offset `take * (skip - 1)`. This route read `skip` as a row offset instead, so a client
	 * paging every inventory list the same way was handed page one and then a window that began one row in.
	 * The conversion is made here and nowhere else: the service's `skip` stays a row offset, because the
	 * GraphQL `stockLevels` connection hands it the row offset its cursor decodes to. See
	 * {@link stockLevelPage} for how an absent, unreadable or out-of-range value is read.
	 */
	@ApiOperation({ summary: 'List stock levels' })
	@ApiQuery({
		name: 'take',
		required: false,
		type: Number,
		description: 'Page size, 0–100; 100 when absent. A larger size is read as 100.'
	})
	@ApiQuery({
		name: 'skip',
		required: false,
		type: Number,
		description: 'One-based page number: the page starts at row take × (skip − 1). Absent or below 1 is page 1.'
	})
	@ApiResponse({ status: 200, description: 'Levels found.' })
	@Versioned({ write: false })
	@Get()
	async findAll(
		@Query('warehouseId', new ParseUUIDPipe({ optional: true })) warehouseId?: ID,
		@Query('variantId', new ParseUUIDPipe({ optional: true })) variantId?: ID,
		@Query('take') take?: number,
		@Query('skip') skip?: number,
		@Query('withDeleted') withDeleted?: string
	): Promise<IStockAvailability[]> {
		// `skip` and `withDeleted` are what the GraphQL connection beside this route offers, and a route that
		// cannot express them answers a narrower question than the field: the client that pages over GraphQL
		// and the client that pages over REST must be able to ask for the same rows. `withDeleted` arrives as
		// the string a query parameter always is, so `true` is the only value that lifts the soft-delete
		// filter — an absent or unreadable one leaves the read exactly as it was.
		return await this.stockLevelService.findLevels({
			warehouseId,
			variantId,
			...stockLevelPage(take, skip),
			withDeleted: String(withDeleted).toLowerCase() === 'true'
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
	@Versioned({ required: false, target: STOCK_LEVEL_VERSION_TARGET })
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

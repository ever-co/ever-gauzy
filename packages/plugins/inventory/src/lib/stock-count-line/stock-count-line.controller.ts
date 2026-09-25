import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { InventoryPermission } from './../inventory.permissions';
import { isQueryFlagSet } from './../inventory.query';
import { StockCountLine } from './stock-count-line.entity';
import { StockCountLineService } from './stock-count-line.service';
import { StockCountLineDTO, StockCountLineQueryDTO  } from './dto';

/**
 * The count-line resource, read-only by design.
 */
@ApiTags('StockCountLine')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(InventoryPermission.STOCK_VIEW as PermissionsEnum)
@Controller('/stock-count-lines')
export class StockCountLineController {
	constructor(private readonly stockCountLineService: StockCountLineService) {}

	/** Lists count lines. */
	@ApiOperation({ summary: 'List stock count lines' })
	@ApiResponse({ status: 200, description: 'Lines found.' })
	@Get()
	async findAll(@Query() filter: StockCountLineQueryDTO): Promise<IPagination<StockCountLine>> {
		const { take, skip, withDeleted, ...where } = filter;

		return await this.stockCountLineService.findLines({
			where: where as any,
			...(take ? { take: Number(take) } : {}),
			...(skip ? { skip: Number(skip) } : {}),
			// The raw query value: no validation pipe runs here, so the DTO's transform never turned
			// `'false'` into `false`, and a truthiness test lifted the soft-delete filter for it.
			...(isQueryFlagSet(withDeleted) ? { withDeleted: true } : {})
		});
	}

	/** Reads one count line. */
	@ApiOperation({ summary: 'Find one stock count line by id' })
	@ApiResponse({ status: 200, description: 'Line found.' })
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<StockCountLine> {
		return await this.stockCountLineService.findOneByIdString(id);
	}
}

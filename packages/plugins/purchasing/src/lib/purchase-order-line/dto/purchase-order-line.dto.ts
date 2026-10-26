import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * One line of a purchase order as a caller sees it.
 *
 * `receivedQuantity`, `damagedQuantity` and `billedQuantity` are readable and never writable: the first
 * two are the order's own record of what the stock ledger already holds and are moved only by a goods
 * receipt, and the third is a cache the bill side re-derives from its own lines. What is still unbilled
 * is not here at all — it is derived at read.
 */
export class PurchaseOrderLineDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly purchaseOrderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, in the unit it was entered in.' })
	@IsOptional()
	readonly quantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'The unit the quantity is stated in.' })
	@IsOptional()
	@IsUUID()
	readonly unitId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Snapshot of the unit factor, e.g. "12.000000000000".' })
	@IsOptional()
	readonly conversionFactor?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly receivedQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly damagedQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string, re-derived from the bill lines.' })
	@IsOptional()
	readonly billedQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly unitCost?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: "The supplier's container, as the term priced it." })
	@IsOptional()
	readonly orderedPackSize?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Which standing term priced this line.' })
	@IsOptional()
	@IsUUID()
	readonly vendorTermId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal fraction, e.g. "0.200000".' })
	@IsOptional()
	readonly taxRate?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly discountTotal?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal string.' })
	@IsOptional()
	readonly total?: DecimalString;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expectedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

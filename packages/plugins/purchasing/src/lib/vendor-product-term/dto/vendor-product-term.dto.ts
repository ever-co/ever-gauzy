import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { VendorTermStatus } from '../../purchasing.types';

/**
 * A vendor term as a caller sees it.
 *
 * Amounts and rates are strings, never numbers: the columns behind them are exact decimals and a JSON
 * number would lose the exactness on the way in. `status` is writable — withdrawing a term is how it
 * is retired, because a term a placed order used is never deleted.
 */
export class VendorProductTermDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly vendorId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 3, description: 'ISO 4217 code the price is stated in.' })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal price for one base unit, e.g. "4.200000".' })
	@IsOptional()
	readonly unitCost?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'Negotiated fraction off the price, e.g. "0.050000".' })
	@IsOptional()
	readonly discountPercent?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'The quantity from which this price applies.' })
	@IsOptional()
	readonly minQuantity?: DecimalString;

	@ApiPropertyOptional({ type: () => String, description: 'The supplier container, e.g. "12.000000".' })
	@IsOptional()
	readonly packSize?: DecimalString;

	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly packLabel?: string;

	@ApiPropertyOptional({ type: () => Number, description: 'Days from order confirmation to receipt.' })
	@IsOptional()
	@IsInt()
	readonly leadTimeDays?: number;

	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly vendorProductCode?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly vendorProductName?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Negotiated over-shipment fraction, e.g. "0.050000".' })
	@IsOptional()
	readonly overReceiptTolerancePercent?: DecimalString;

	@ApiPropertyOptional({ type: () => Number, description: 'Lower wins between two rows that both match.' })
	@IsOptional()
	@IsInt()
	readonly priority?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly startsAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly endsAt?: Date;

	@ApiPropertyOptional({ type: () => String, enum: VendorTermStatus })
	@IsOptional()
	@IsEnum(VendorTermStatus)
	readonly status?: VendorTermStatus;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, unknown>;
}

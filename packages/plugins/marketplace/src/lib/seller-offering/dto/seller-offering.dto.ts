import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	CommissionBasis,
	CurrencyCode,
	DecimalString,
	ICommissionTier,
	ID,
	OfferingCondition,
	OfferingFulfilmentMode,
	OfferingStatus
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * An offering as the API accepts it.
 *
 * A seller's price is authored here and materialised into a price row on publication, so that exactly
 * one mechanism is read when a price is resolved. `productId` is absent on purpose: it is derived from
 * the variant, and a caller that supplies a variant the catalogue has not published cannot make the
 * offering visible by asserting one.
 */
export class SellerOfferingDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly sellerSku?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly title?: string;

	@ApiPropertyOptional({ type: () => String, enum: OfferingCondition })
	@IsOptional()
	@IsEnum(OfferingCondition)
	readonly condition?: OfferingCondition;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly priceAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly priceCurrency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly productPriceId?: ID;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly commissionRate?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: CommissionBasis })
	@IsOptional()
	@IsEnum(CommissionBasis)
	readonly commissionBasis?: CommissionBasis;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly commissionTiers?: ICommissionTier[];

	@ApiPropertyOptional({ type: () => String, enum: OfferingStatus })
	@IsOptional()
	@IsEnum(OfferingStatus)
	readonly status?: OfferingStatus;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly channelIds?: string[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly regionIds?: string[];

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly availableFrom?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly availableTo?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(1)
	readonly maxQuantityPerOrder?: number;

	@ApiPropertyOptional({ type: () => String, enum: OfferingFulfilmentMode })
	@IsOptional()
	@IsEnum(OfferingFulfilmentMode)
	readonly fulfilmentMode?: OfferingFulfilmentMode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly fulfilmentWarehouseId?: ID;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly handlingDays?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isFeatured?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly allowNegativeNet?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, any>;
}

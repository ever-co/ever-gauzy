import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import {
	CommissionBasis,
	CurrencyCode,
	DecimalString,
	ICommissionTier,
	ID,
	SellerPayoutMode,
	SellerPayoutSchedule,
	TaxCollectionMode,
	TaxRegistrationScheme
} from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A seller as the API accepts it.
 *
 * What is deliberately absent is as important as what is here: there is no `organizationId` and no
 * `tenantId` (they come from the request context, never from a body), no `status` (the lifecycle has
 * its own endpoints, so an edit can never put a seller live), and no balance, settlement or payout
 * field of any kind. A caller cannot write its way past a transition or invent a figure.
 */
export class SellerDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly name?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly legalName?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly email?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly phone?: string;

	/**
	 * The seller's party row. Required to create a seller: without a party there is nothing to verify,
	 * nothing to contract with and nowhere for a tax identifier to belong.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly contactId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly merchantId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly userId?: ID;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly channelIds?: string[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly regionIds?: string[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly payoutAccountReference?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly payoutAccountHolderId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly taxId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly vatNumber?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2)
	readonly taxCountryCode?: string;

	@ApiPropertyOptional({ type: () => String, enum: TaxRegistrationScheme })
	@IsOptional()
	@IsEnum(TaxRegistrationScheme)
	readonly taxRegistrationScheme?: TaxRegistrationScheme;

	@ApiPropertyOptional({ type: () => String, enum: TaxCollectionMode })
	@IsOptional()
	@IsEnum(TaxCollectionMode)
	readonly taxCollectionMode?: TaxCollectionMode;

	/**
	 * A fraction, not a percentage: `0.15` is fifteen per cent.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly defaultCommissionRate?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: CommissionBasis })
	@IsOptional()
	@IsEnum(CommissionBasis)
	readonly commissionBasis?: CommissionBasis;

	/**
	 * Graduated bands, half open: `[{ "from": 0, "to": 100, "rate": 0.12 }]`.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly commissionTiers?: ICommissionTier[];

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly fixedFeePerItem?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly fixedFeeCurrency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly commissionOnShipping?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly chargeShippingCost?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly allowNegativeNet?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: SellerPayoutMode })
	@IsOptional()
	@IsEnum(SellerPayoutMode)
	readonly payoutMode?: SellerPayoutMode;

	@ApiPropertyOptional({ type: () => String, enum: SellerPayoutSchedule })
	@IsOptional()
	@IsEnum(SellerPayoutSchedule)
	readonly payoutSchedule?: SellerPayoutSchedule;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly payoutCurrency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly payoutThreshold?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly reservePercent?: DecimalString;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly reserveHoldDays?: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly payoutHoldDays?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, any>;
}

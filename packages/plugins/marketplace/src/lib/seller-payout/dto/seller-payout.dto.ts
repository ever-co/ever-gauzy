import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID, SellerPayoutMode, SellerPayoutStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A payout as the API accepts it.
 *
 * There is no amount field, and that is the point: a payout's amount is the sum of the transactions it
 * covers, so a caller chooses **which transactions** are paid and never how much. The reserve, the fee
 * and the paid amount are computed by the run and are not writable anywhere.
 */
export class SellerPayoutDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerId?: ID;

	@ApiPropertyOptional({ type: () => String, enum: SellerPayoutStatus })
	@IsOptional()
	@IsEnum(SellerPayoutStatus)
	readonly status?: SellerPayoutStatus;

	@ApiPropertyOptional({ type: () => String, enum: SellerPayoutMode })
	@IsOptional()
	@IsEnum(SellerPayoutMode)
	readonly payoutMode?: SellerPayoutMode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@IsArray()
	readonly transactionIds?: ID[];

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly periodStart?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly periodEnd?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly scheduledAt?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly feeAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly providerKey?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly providerReference?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	readonly metadata?: Record<string, any>;
}

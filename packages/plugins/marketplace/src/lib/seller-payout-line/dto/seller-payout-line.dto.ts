import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A payout line as the API accepts it.
 *
 * A line is never authored: it is created by the payout run from the transactions it selects. The DTO
 * exists so that the read and release paths have a validated shape, and the amount is not writable
 * because the amount is the transaction's net.
 */
export class SellerPayoutLineDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerPayoutId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerTransactionId?: ID;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly amount?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	readonly currency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly note?: string;
}

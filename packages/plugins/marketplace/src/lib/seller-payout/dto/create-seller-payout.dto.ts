import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { SellerPayoutDTO } from './seller-payout.dto';

/**
 * Create request validation.
 *
 * A payout is built from settleable transactions of one seller in one currency, so the seller and the currency are what a caller states and the amount is what the ledger says. `isFinal` is the closing payout of a seller being offboarded: it is stated at creation because it is what the reserve and the threshold are measured against.
 */
export class CreateSellerPayoutDTO extends IntersectionType(
	SellerPayoutDTO,
	PickType(SellerPayoutDTO, ['sellerId', 'currency'] as const)
) {
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isFinal?: boolean;
}
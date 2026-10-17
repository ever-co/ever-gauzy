import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { DecimalAmount, IsDecimalAmount } from '../../shared/is-decimal-amount.validator';

/**
 * The writable surface of an applied promotion.
 *
 * `amount` is produced by the promotion engine: the cart records the discount that was granted rather
 * than recomputing it, so a promotion edited afterwards cannot silently change a cart that has already
 * been quoted. **It is never the caller's (R3-07):** the member is still accepted so an existing client's
 * body validates, and it is ignored — the cart asks the engine what the named promotion grants.
 */
export class CommerceCartPromotionDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly cartId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly promotionId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly couponId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	/**
	 * Ignored (R3-07): the discount is what the promotion engine grants, never what a request states.
	 * Kept, optional, so a body that still carries it validates; a decimal string or a number, for the
	 * same reason the other money members of this package take both.
	 */
	@ApiPropertyOptional({
		type: () => String,
		deprecated: true,
		description: 'Ignored: the discount is computed by the promotion engine.'
	})
	@IsOptional()
	@IsDecimalAmount()
	readonly amount?: DecimalAmount;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isAutomatic: boolean;
}

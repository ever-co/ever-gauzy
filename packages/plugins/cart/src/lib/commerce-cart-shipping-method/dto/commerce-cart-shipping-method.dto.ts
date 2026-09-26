import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { DecimalAmount, IsDecimalAmount } from '../../shared/is-decimal-amount.validator';

/**
 * The writable surface of a delivery choice held against a cart.
 *
 * `amount` is the price the shipping calculation produced; the cart records it and never computes it,
 * which is why the field is required on a manual override too.
 */
export class CommerceCartShippingMethodDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly cartId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly shippingOptionId: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	readonly name: string;

	/**
	 * The computed shipping amount. A decimal string or a number: the GraphQL schema types it
	 * `Decimal!` and the two surfaces have to agree about one field's wire format.
	 */
	@ApiProperty({ type: () => String })
	@IsDecimalAmount()
	readonly amount: DecimalAmount;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly data: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isManual: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxCategoryId: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly position: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

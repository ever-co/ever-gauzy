import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { DecimalAmount, IsDecimalAmount } from '../../shared/is-decimal-amount.validator';

/**
 * The writable surface of a cart line.
 *
 * `unitPrice` is the price the price resolver returned; this DTO accepts it because a cart is priced
 * by the pricing package and the cart simply records the result. The snapshot fields (`title`, `sku`,
 * `thumbnail`) are written by the add-to-cart path from the variant, not authored by a caller.
 *
 * **The money members take a decimal string as well as a number.** The GraphQL schema types the same
 * two fields `Decimal!` and states that a money value read over GraphQL and the same value read over
 * REST are string-identical; typing them `@IsNumber() number` here made that untrue and left the REST
 * surface with no guard at all against an amount a double cannot hold. Both forms are accepted, the
 * service normalises whichever arrives through the money layer, and the documented type is the string
 * the schema promises. See `is-decimal-amount.validator.ts`.
 */
export class CommerceCartLineDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly cartId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly productId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly variantId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sellerId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly sku: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	readonly thumbnail: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	readonly quantity: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDecimalAmount()
	readonly unitPrice: DecimalAmount;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsDecimalAmount()
	readonly originalUnitPrice: DecimalAmount;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxInclusive: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly taxCategoryId: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDiscountable: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly requiresShipping: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly weight: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly position: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly warehouseId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly subscriptionPlanId: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

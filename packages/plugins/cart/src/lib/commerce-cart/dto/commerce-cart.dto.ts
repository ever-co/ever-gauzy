import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CommerceCartStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of a cart.
 *
 * The total columns are deliberately absent: they are computed by the totals writer from the lines and
 * the money ledgers, and a caller that could set them could make the cache disagree with the ledgers.
 */
export class CommerceCartDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly channelId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly regionId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly userId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEmail()
	@MaxLength(255)
	readonly email: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	readonly currency: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly currencyDecimals: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	readonly locale: string;

	@ApiPropertyOptional({ type: () => String, enum: CommerceCartStatus })
	@IsOptional()
	@IsEnum(CommerceCartStatus)
	readonly status: CommerceCartStatus;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly shippingAddressId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly billingAddressId: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly shippingAddressSnapshot: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly billingAddressSnapshot: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTaxExempt: boolean;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId: string;
}

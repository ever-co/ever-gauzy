import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { GiftCardStatus } from '../../promotion.types';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * A stored-value instrument. The balance is derived from the transaction ledger and materialised here.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class GiftCardDTO extends TenantOrganizationBaseDTO {
	/**
	 * The redeemable string; generated from the platform alphabet when absent.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	/**
	 * Face value at issue.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly initialAmount: DecimalString | number;

	/**
	 * Current balance; the ledger is the authority and this column is the cache of it.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly balance?: DecimalString | number;

	/**
	 * The card currency. A card is only redeemable against an order in it.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	/**
	 * Active, redeemed, expired or canceled.
	 */
	@ApiPropertyOptional({ type: () => String, enum: GiftCardStatus })
	@IsOptional()
	@IsEnum(GiftCardStatus)
	readonly status: GiftCardStatus = GiftCardStatus.ACTIVE;

	/**
	 * The registered holder.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly customerId?: string;

	/**
	 * The order that issued the card, on a refund-to-card flow.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: string;

	/**
	 * Expiry instant; null means the card never expires.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly expiresAt?: Date;

	/**
	 * Optional second factor, stored hashed and never returned.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly pin?: string;

	/**
	 * Reloadable marker, issuer, recipient and message.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}

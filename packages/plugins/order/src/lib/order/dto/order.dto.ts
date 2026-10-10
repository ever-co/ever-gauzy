import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AddressType } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of an order.
 *
 * The statuses and every total are deliberately absent. `status` moves through `OrderStateMachine`
 * alone, `paymentStatus` and `fulfillmentStatus` are materialised from the order's own rows, and the
 * totals are written by the totals writer from the lines and the money ledgers — a caller that could
 * set any of them could make a cache disagree with the ledger that is its source of truth.
 */
export class OrderDTO extends TenantOrganizationBaseDTO {
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

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly phone: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	readonly currency: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly currencyDecimals: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(10)
	readonly locale: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isDraft: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isTest: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly source: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly cartId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentOrderId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly purchaseOrderNumber: string;

	/**
	 * The settlement schedule the order is placed against.
	 *
	 * A payment term is what makes "net 30" mean something to an order: the schedule says when each
	 * instalment falls due, and the order records which one it agreed to. `promisedAt` is deliberately
	 * **absent** from this DTO: it is a cache of the lines, materialised by the totals writer, and a
	 * caller that could set it could make the order promise something no line agrees with.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly paymentTermId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly externalId: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

/**
 * An address as a caller supplies it when creating an order directly rather than from a cart.
 *
 * The order stores the snapshot, so the caller states the values rather than an address-book id; the
 * `type` decides which of the order's two address rows it becomes.
 */
export class OrderAddressInputDTO {
	@ApiProperty({ type: () => String, enum: AddressType })
	readonly type: AddressType;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly sourceAddressId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly contactName: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly company: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly firstName: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly lastName: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly phone: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEmail()
	@MaxLength(255)
	readonly email: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	readonly line1: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly line2: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(128)
	readonly city: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	readonly province: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	readonly provinceCode: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	readonly postalCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(2)
	readonly countryCode: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly countryId: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly latitude: number;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly longitude: number;
}

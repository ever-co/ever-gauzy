import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AddressType, ID, IOrderAddress } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { Order } from '../order/order.entity';
import { MikroOrmOrderAddressRepository } from './repository/mikro-orm-order-address.repository';

/**
 * One frozen address of an order.
 *
 * This is a **snapshot**, not a reference, and that is the whole point of the table: an order must stay
 * printable and correctly taxed after the customer edits or deletes the address book entry it came
 * from. `sourceAddressId` records where the copy came from and deliberately carries no foreign key, so
 * the snapshot survives its source.
 *
 * The live address book is the core `address` table; this table is the order's own immutable copy.
 */
@MultiORMEntity('order_address', { mikroOrmRepository: () => MikroOrmOrderAddressRepository })
export class OrderAddress extends TenantOrganizationBaseEntity implements IOrderAddress {
	/** The order. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	orderId: ID;

	/** Whether this is the billing or the shipping address. Exactly one row of each per order. */
	@ApiProperty({ type: () => String, enum: AddressType })
	@IsEnum(AddressType)
	@MultiORMColumn({ type: 'simple-enum', enum: AddressType })
	type: AddressType;

	/** The address book row this was copied from. No constraint: the snapshot outlives its source. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	sourceAddressId?: ID;

	/** Contact name as it was. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	contactName?: string;

	/** Company as it was. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	company?: string;

	/** First name as it was. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	firstName?: string;

	/** Last name as it was. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	lastName?: string;

	/** Telephone number as it was. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 32 })
	phone?: string;

	/** Email as it was. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	email?: string;

	/** Street address. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	line1: string;

	/** Second line of the street address. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	line2?: string;

	/** City. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128 })
	city: string;

	/** Province or state. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 128 })
	province?: string;

	/** Province or state code, which is what a tax rate is matched on. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 16 })
	provinceCode?: string;

	/** Postal code. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 32 })
	postalCode?: string;

	/** ISO-3166-1 alpha-2 country code. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(2)
	@MultiORMColumn({ type: 'varchar', length: 2 })
	countryCode: string;

	/** The country lookup row, when one matched. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	countryId?: ID;

	/** Latitude, when the address was geocoded. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 10, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	latitude?: number;

	/** Longitude, when the address was geocoded. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 10, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	longitude?: number;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The order. */
	@MultiORMManyToOne(() => Order, (it) => it.addresses, { onDelete: 'CASCADE' })
	@JoinColumn()
	order?: Order;
}

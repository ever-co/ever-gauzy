import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { CurrencyCode, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { PriceListStatus, PriceListType } from '../pricing.types';
import { ProductPrice } from '../product-price/product-price.entity';
import { MikroOrmPriceListRepository } from './repository/mikro-orm-price-list.repository';

/**
 * A named, scoped, time-boxed set of prices.
 *
 * A price list is the unit an operator actually works with: "Summer sale", "Wholesale 2026",
 * "EU retail". The scoping columns are what make one list apply to one slice of demand and not to
 * the rest — `channelId`, `regionId`, `customerGroupId` and `currency` each narrow the list, and a
 * null means "any", which is why a list with every scope null is the tenant-wide list.
 *
 * Eligibility is a predicate over three of these columns plus the window: `status = 'ACTIVE'`, the
 * window contains the instant being priced, and every non-null scope column matches the context.
 * At most one `OVERRIDE` list may win for a context — two eligible `OVERRIDE` lists at equal
 * priority are refused rather than resolved arbitrarily, because silently choosing one would make
 * a contract price depend on row order.
 *
 * A list that has prices is never hard-deleted: `status = 'INACTIVE'` withdraws it while keeping
 * its rows queryable, and the children are removed with the list when a delete is forced.
 */
@ColumnIndex('UQ_price_list_org_code', ['organizationId', 'code'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_price_list_window', ['organizationId', 'status', 'startsAt', 'endsAt'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_price_list_priority', ['priority'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_price_list_scope', ['channelId', 'regionId', 'customerGroupId', 'currency'], {
	where: '"deletedAt" IS NULL'
})
@MultiORMEntity('price_list', { mikroOrmRepository: () => MikroOrmPriceListRepository })
export class PriceList extends TenantOrganizationBaseEntity {
	/**
	 * Operator-facing name.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Stable code the list is addressed by in integrations and imports. Unique per organization
	 * among live rows, so a re-import updates the list it created last time rather than creating a
	 * second one beside it.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Why the list exists, in the operator's own words.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	/**
	 * How the list competes: on price (`SALE`) or outright (`OVERRIDE`).
	 */
	@ApiProperty({ type: () => String, enum: PriceListType, default: PriceListType.SALE })
	@IsEnum(PriceListType)
	@MultiORMColumn({ type: 'simple-enum', enum: PriceListType, default: PriceListType.SALE })
	type: PriceListType;

	/**
	 * Whether the list may participate in resolution at all.
	 */
	@ApiProperty({ type: () => String, enum: PriceListStatus, default: PriceListStatus.DRAFT })
	@IsEnum(PriceListStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: PriceListStatus, default: PriceListStatus.DRAFT })
	status: PriceListStatus;

	/**
	 * Tie-break between two eligible lists of the same type. The higher value wins, so a list that
	 * should only apply when nothing more specific exists is given a low priority rather than a
	 * narrow scope.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/**
	 * Currency the list's prices are expressed in. Null means the list applies whatever currency
	 * the caller prices in, which is only sensible when its prices carry their own currency.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: CurrencyCode;

	/**
	 * Sales channel the list is restricted to; null means any channel.
	 *
	 * Held as a plain identifier: the channel table is a kernel table this package does not own, so
	 * the column is a scalar and the referential constraint is added by this package's migration.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	channelId?: ID;

	/**
	 * Contact group the list is restricted to; null means any customer. A list bound to a group is
	 * more specific than an unbound one and wins over it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	customerGroupId?: ID;

	/**
	 * Region the list is restricted to; null means any region.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	regionId?: ID;

	/**
	 * Start of the window the list is eligible inside; null is open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	/**
	 * End of the window the list is eligible inside; null is open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Whether the amounts carried by this list already contain tax.
	 *
	 * It is the second answer in the precedence chain — a price row's own `taxInclusive` beats it,
	 * and a `price_preference` answers only when neither the price nor the list does.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/**
	 * Open-ended producer data: the import batch a list came from, an external agreement reference,
	 * anything a consumer needs to keep beside its own rows.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Prices carried by the list. They have no meaning without it, so they are removed with it.
	 */
	@MultiORMOneToMany(() => ProductPrice, (price: ProductPrice) => price.priceList)
	prices?: ProductPrice[];

	/*
	|--------------------------------------------------------------------------
	| Note on rule rows
	|--------------------------------------------------------------------------
	|
	| A list may carry conditions (`rule` rows with `ownerType = PRICE_LIST`), and they are evaluated
	| as part of eligibility rather than stored here. The relation is polymorphic and deliberately
	| carries no foreign key, so it is not declared as an ORM relation: the price-list service reads
	| and writes those rows through the platform rule service, and deletes them inside the transaction
	| that deletes the list, because there is no cascade to do it.
	*/
}

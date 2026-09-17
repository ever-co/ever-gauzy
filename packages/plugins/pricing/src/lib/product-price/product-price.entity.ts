import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { CurrencyCode, DecimalString, ID } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	ProductVariant,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { PriceBaseSource, PriceComputeMode, PriceStatus } from '../pricing.types';
import { PriceList } from '../price-list/price-list.entity';
import { MikroOrmProductPriceRepository } from './repository/mikro-orm-product-price.repository';

/**
 * The price of one product variant.
 *
 * There is exactly one table in the platform that holds what a variant costs and this is it. A row
 * with a `priceListId` belongs to a list and is a candidate only while that list is eligible; a row
 * without one is the variant's default price, used whenever no list wins. Quantity tiers are
 * further rows of the same table distinguished by `minQuantity` / `maxQuantity`, not a child table,
 * because a tier is the same fact at a different quantity rather than a different kind of fact.
 *
 * **A row says how it computes, not only what it is.** `computeMode` is the whole of that: an
 * `AMOUNT` row states its price in `amount` and is the only mode that existed before, while a
 * `PERCENT_OFF` row states *how* — a base (`baseSource`, and `basePriceListId` for a price book), a
 * signed share (`percent`, negative for a cost-plus markup) and an optional price ending (`roundTo`).
 * The arithmetic stays on the price row rather than moving into `rule`, because `rule` answers "does
 * this row apply?" with a boolean and a value-producing expression inside it would leak pricing
 * arithmetic into the evaluator that tax, fulfilment, approvals and entitlements share. A companion
 * table is refused for the same reason: the derivation is a property *of* the price, so a companion
 * row would be 1:1 and would add a second thing to keep in step.
 *
 * A row with `variantId` null is **open-scoped**: its applicability is exactly its `rule` rows with
 * `ownerType = PRICE`, and it prices every variant they select. That is what the nullable relation is
 * for, and it is why an open row must carry at least one product-, variant- or collection-rooted
 * rule — a scope-less open row would re-price the whole catalogue.
 *
 * Two rules the schema cannot state and the service therefore owns: the tiers of one
 * `(variant, currency, price list)` tuple must not overlap — an overlapping pair makes the resolved
 * price depend on row order — and the margin guard rails (`minMarginPercent`, `maxDiscountPercent`)
 * are applied when a price is calculated, on the **derived** amount for a derived row, never stored
 * into `amount`.
 *
 * `compareAtAmount` is display-only and `costAmount` is a reporting snapshot: neither ever enters a
 * computed total. Conditions that decide whether this row applies (`quantity`, `customer.group`,
 * `channel`) live in `rule` rows with `ownerType = PRICE`, not in extra columns here, so one
 * evaluator answers "does this apply" for every capability that asks.
 */
@ColumnIndex('IDX_price_variant_ccy_status', ['variantId', 'currency', 'status'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_price_list', ['priceListId'], { where: '"priceListId" IS NOT NULL' })
@ColumnIndex('IDX_price_window', ['variantId', 'status', 'startsAt', 'endsAt'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_price_org_created', ['organizationId', 'createdAt'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_price_base_list', ['basePriceListId'], { where: '"basePriceListId" IS NOT NULL' })
@ColumnIndex('IDX_price_unit', ['unitId'], { where: '"unitId" IS NOT NULL' })
@ColumnIndex('IDX_price_open_scope', ['organizationId', 'currency', 'status'], {
	where: '"variantId" IS NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('UQ_price_tier', ['variantId', 'currency', 'priceListId', 'minQuantity', 'maxQuantity'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@MultiORMEntity('product_price', { mikroOrmRepository: () => MikroOrmProductPriceRepository })
export class ProductPrice extends TenantOrganizationBaseEntity {
	/**
	 * Currency the amount is expressed in. Mandatory: there is no currency-agnostic price, because a
	 * number without a currency cannot be charged.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * What one unit costs, exact, at the storage scale of a money column.
	 *
	 * **Null exactly when the row derives its price**, which is a breaking read change: every consumer
	 * of a price row has to handle the derived case, and the mitigation is that the resolve response is
	 * the sanctioned read path for a price — it echoes `baseAmount` and `computation`, so a caller
	 * never has to interpret a null.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	amount?: DecimalString;

	/**
	 * How the row computes its price: the row's `amount` **is** the price, or the price is derived from
	 * a base. A closed two-value set, so an enumeration and not a registry.
	 */
	@ApiProperty({ type: () => String, enum: PriceComputeMode, default: PriceComputeMode.AMOUNT })
	@IsEnum(PriceComputeMode)
	@MultiORMColumn({ type: 'simple-enum', enum: PriceComputeMode, default: PriceComputeMode.AMOUNT })
	computeMode: PriceComputeMode;

	/**
	 * Signed fraction of the base: positive reduces it, negative is a cost-plus **markup**. Required
	 * exactly when `computeMode` is `PERCENT_OFF`, and bounded by `-1000 < percent <= 100`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 9,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	percent?: DecimalString;

	/**
	 * Which price the derivation starts from. Required exactly when `computeMode` is `PERCENT_OFF`.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PriceBaseSource })
	@IsOptional()
	@IsEnum(PriceBaseSource)
	@MultiORMColumn({ type: 'simple-enum', enum: PriceBaseSource, nullable: true })
	baseSource?: PriceBaseSource;

	/**
	 * The list a `PRICE_LIST` derivation reads. Required exactly when `baseSource` is `PRICE_LIST`,
	 * never the row's own list, acyclic (the service refuses `PRICE_BASE_CYCLE`) and depth-capped at
	 * five when a chain of derived lists is resolved.
	 *
	 * `RESTRICT` and not `CASCADE`: a list another list derives from is part of that list's meaning, so
	 * removing it would silently change a price rather than merely orphan a row.
	 */
	@MultiORMManyToOne(() => PriceList, {
		/** A base list a derivation reads cannot be deleted out from under it. */
		onDelete: 'RESTRICT',
		nullable: true
	})
	@JoinColumn()
	basePriceList?: PriceList;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ProductPrice) => it.basePriceList)
	@MultiORMColumn({ nullable: true, relationId: true })
	basePriceListId?: ID;

	/**
	 * The multiple the derived amount is quantised to, applied **after** the percentage and **before**
	 * the currency rounding boundary B1. A price ending (`19.99`) is a merchandising decision about a
	 * price, not a property of a currency, so it has no other home. Null means no quantisation, and a
	 * stated value is greater than zero.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	roundTo?: DecimalString;

	/**
	 * The unit `minQuantity` and `maxQuantity` are expressed in. Null means the variant's sales unit,
	 * else its stock unit.
	 *
	 * A tier is a threshold, and "10+" is a different threshold per box and per piece, so a unitless
	 * tier does not merely read ambiguously — it returns the wrong price to one of the two readers. The
	 * column carries **no foreign key**: `unit` belongs to the kernel's measurement set, which owns the
	 * target and adds the constraint once it exists.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true })
	unitId?: ID;

	/**
	 * Manufacturer's suggested or previously charged price, carried for display only. It is never
	 * used in a total and never falls back to `amount`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	compareAtAmount?: DecimalString;

	/**
	 * Cost snapshot the margin guard and margin reporting read. A snapshot rather than a join,
	 * because a report of what a past sale earned must not change when the cost is re-estimated.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	costAmount?: DecimalString;

	/**
	 * Lower bound of the quantity band this row applies to, inclusive. Null is open-ended, so a row
	 * with both bounds null is the single price of the variant.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	minQuantity?: DecimalString;

	/**
	 * Upper bound of the quantity band this row applies to, inclusive. Null is open-ended.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	maxQuantity?: DecimalString;

	/**
	 * Whether the amount already contains tax. Null means "inherit": the price list's answer is
	 * used, and only when the list is silent too does a `price_preference` decide.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', nullable: true })
	taxInclusive?: boolean;

	/**
	 * Guard rail as a fraction, not a percentage: `0.150000` is a 15 % floor. A calculated price may
	 * not fall below `costAmount × (1 + minMarginPercent)`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 9,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	minMarginPercent?: DecimalString;

	/**
	 * Guard rail as a fraction, not a percentage: `0.300000` is a 30 % ceiling. The discount taken
	 * off `amount` may not exceed it, which is what stops a stacked promotion from giving a product
	 * away.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 9,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	maxDiscountPercent?: DecimalString;

	/**
	 * Row lifecycle. Only `ACTIVE` rows are candidates; `INACTIVE` is what an ended promotion's row
	 * is set to, so the price it charged stays queryable.
	 */
	@ApiProperty({ type: () => String, enum: PriceStatus, default: PriceStatus.ACTIVE })
	@IsEnum(PriceStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: PriceStatus, default: PriceStatus.ACTIVE })
	status: PriceStatus;

	/**
	 * Start of the window this price is valid inside; null is open. A price-level window narrows the
	 * list's window rather than replacing it: both must contain the instant being priced.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	/**
	 * End of the window this price is valid inside; null is open.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Open-ended producer data: the import row a price came from, the reason an override was
	 * granted.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Price list the row belongs to. Null is the default price of the variant, which is what makes
	 * an installation with no price list behave exactly as it did before the list existed.
	 */
	@MultiORMManyToOne(() => PriceList, {
		/** A price is part of its list and cannot outlive it. */
		onDelete: 'CASCADE',
		/** The default price has no list. */
		nullable: true
	})
	@JoinColumn()
	priceList?: PriceList;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ProductPrice) => it.priceList)
	@MultiORMColumn({ nullable: true, relationId: true })
	priceListId?: ID;

	/**
	 * Variant the price is for, or null for an **open-scoped** row.
	 *
	 * Null does not mean "unset": it means the row's applicability is exactly its `rule` rows with
	 * `ownerType = PRICE`, and it prices every variant those rules select. A row with a variant keeps
	 * the meaning it always had.
	 *
	 * `CASCADE` is the deliberate deviation from the rule that a mandatory reference to a master row
	 * restricts deletion: a price is part of the variant, so it is removed with it rather than
	 * blocking it.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		onDelete: 'CASCADE',
		nullable: true
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ProductPrice) => it.variant)
	@MultiORMColumn({ nullable: true, relationId: true })
	variantId?: ID;

	/*
	|--------------------------------------------------------------------------
	| Note on rule rows
	|--------------------------------------------------------------------------
	|
	| A price may carry conditions (`rule` rows with `ownerType = PRICE`) that decide whether it
	| applies. They are polymorphic, carry no foreign key, and are therefore not an ORM relation:
	| they are read and written through the platform rule service, which keeps one evaluator
	| answering "does this apply" for pricing, promotion, tax and shipping alike.
	*/
}

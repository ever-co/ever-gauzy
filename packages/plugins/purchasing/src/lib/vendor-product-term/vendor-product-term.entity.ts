import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import {
	IsDate,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength
} from 'class-validator';
import { CurrencyCode, DecimalString, ID, IOrganizationVendor } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	OrganizationVendor,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { IVendorProductTerm, VendorTermStatus } from '../purchasing.types';
import { MikroOrmVendorProductTermRepository } from './repository/mikro-orm-vendor-product-term.repository';

/**
 * The commercial agreement with one supplier, for one sellable unit.
 *
 * **This is the row that carries the agreement.** The supplier master is a vendor-level record: it can
 * say that a supplier has a 21-day lead time and nothing more. It cannot say that the same supplier
 * quotes 4.20 for the 500-unit break of one variant until March and 5.10 for the 100-unit break of
 * another, that the first has a 3-day lead time and the second 90, or what the supplier calls either
 * of them. Two things break without this table: the expected date, because a vendor-level lead time
 * gives every line of that supplier the same date and every late-delivery report is then wrong for the
 * ordinary case of a mixed basket; and the cost, because there is nothing to prefill a line's price
 * from, so the buy-side price is retyped on every order.
 *
 * The precedence is **term row → vendor row → organization setting → none**, stated once and applied
 * by the term service: `leadTimeDays`, `minimumOrderAmount` and `currency` on `organization_vendor`
 * are read only when the winning term row does not carry its own.
 *
 * Two rules the schema states and the service enforces. For one organization, vendor, variant and
 * currency, two `ACTIVE` rows whose windows overlap may not claim overlapping quantity bands — a row's
 * band runs from its `minQuantity` to the next higher one, open-ended at the top — so a line's price
 * is never decided by the order the rows happen to be stored in; a term a placed order used is never
 * deleted, its `status` moves to `INACTIVE`, so the history of what was agreed stays readable.
 *
 * Money carries `transformer: new ColumnNumericTransformerPipe()` and a sibling ISO currency column: a
 * price without its currency is not a price, and the negotiated percentage is a **rate** rather than
 * an amount, so the next order resolves it again instead of inheriting a number nobody can explain.
 */
@ColumnIndex(
	'UQ_vendor_product_term',
	['organizationId', 'vendorId', 'variantId', 'currency', 'minQuantity', 'startsAt'],
	{ unique: true, where: '"deletedAt" IS NULL' }
)
@ColumnIndex('IDX_vendor_term_resolve', ['organizationId', 'variantId', 'status', 'startsAt', 'endsAt'], {
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_vendor_term_vendor', ['vendorId', 'variantId', 'status'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_vendor_term_code', ['vendorId', 'vendorProductCode'], {
	where: '"vendorProductCode" IS NOT NULL AND "deletedAt" IS NULL'
})
@MultiORMEntity('vendor_product_term', { mikroOrmRepository: () => MikroOrmVendorProductTermRepository })
export class VendorProductTerm extends TenantOrganizationBaseEntity implements IVendorProductTerm {
	/**
	 * The supplier the agreement is with.
	 *
	 * The supplier master is the platform's existing vendor entity, restricted here so a supplier that
	 * has agreed terms cannot be hard-deleted out from under them.
	 */
	@ApiProperty({ type: () => OrganizationVendor })
	@IsNotEmpty()
	@MultiORMManyToOne(() => OrganizationVendor, {
		/** Database cascade action on delete. */
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	vendor?: IOrganizationVendor;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: VendorProductTerm) => it.vendor)
	@MultiORMColumn({ relationId: true })
	vendorId: ID;

	/**
	 * The sellable unit the agreement is scoped to.
	 *
	 * A plain id rather than a mapped relation: the variant belongs to the catalogue, which this domain
	 * reads through its own identifiers. The term is scoped to the variant rather than to the product
	 * because that is what the purchase line and the receipt line both point at — and a vendor-wide row
	 * with no variant is deliberately not supported, since it would create a second resolution path and
	 * a precedence question for a convenience.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@MultiORMColumn()
	variantId: ID;

	/**
	 * Currency the price is stated in. Defaulted by the service from the supplier's own purchase
	 * currency and then from the organization's base currency, because a price without its currency
	 * cannot be compared with an order.
	 */
	@ApiProperty({ type: () => String, maxLength: 3 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Price for one **base** unit, excluding tax, at or above `minQuantity`.
	 *
	 * When the supplier quoted a container price, the service derives this as
	 * `container price ÷ packSize`, rounded half-up to the storage scale, so the platform's own total
	 * stays authoritative and recomputable.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		transformer: new ColumnNumericTransformerPipe()
	})
	unitCost: DecimalString;

	/**
	 * Negotiated fraction off `unitCost`; null means none. A rate rather than an amount, so the next
	 * order resolves it again.
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
	discountPercent?: DecimalString;

	/**
	 * The quantity from which this row's price applies — the price-break threshold.
	 */
	@ApiPropertyOptional({ type: () => String, default: 0 })
	@IsOptional()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	minQuantity: DecimalString;

	/**
	 * The supplier's selling container — a case of twelve, a pallet of forty — so a quote of "10.80 per
	 * case of twelve" is recordable and the price per base unit is obtained from it.
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
	packSize?: DecimalString;

	/** What the supplier calls that container; printed on the order. */
	@ApiPropertyOptional({ type: () => String, maxLength: 16 })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	packLabel?: string;

	/**
	 * Days from order confirmation to receipt **for this product**. Null inherits the supplier's own
	 * lead time, which is the only thing the vendor row can state.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	leadTimeDays?: number;

	/**
	 * The supplier's own code for our variant. Without it a quotation, an acknowledgement and a
	 * supplier's bill cannot be reconciled against our own units.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	vendorProductCode?: string;

	/** The supplier's own name for it; null means our name is used. */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	vendorProductName?: string;

	/**
	 * Negotiated over-shipment allowance for this product, as a fraction. Null falls through to the
	 * organization's setting and then to no allowance at all.
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
	overReceiptTolerancePercent?: DecimalString;

	/**
	 * Explicit tie-break between two rows that both match, applied **before** price. Without it a
	 * line's price would depend on the order the rows happen to be stored in, and a non-deterministic
	 * price is worse than a missing one.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 100 })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 100 })
	priority: number;

	/**
	 * Validity window. Null is open-ended on that side. A negotiated price is valid for a period, and
	 * overwriting the row would destroy the history of what was agreed — so a renegotiation closes the
	 * old window and opens a new one.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	startsAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	endsAt?: Date;

	/**
	 * Where the term is in its life. Only `ACTIVE` rows are resolution candidates, which is what lets a
	 * buyer write a term before the supplier has confirmed it.
	 */
	@ApiProperty({ type: () => String, enum: VendorTermStatus })
	@IsEnum(VendorTermStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: VendorTermStatus, default: VendorTermStatus.ACTIVE })
	status: VendorTermStatus;

	/** Open-ended extras: the quotation the term came from, the buyer who negotiated it. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, unknown>;
}

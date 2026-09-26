import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import {
	AdjustmentFunding,
	AdjustmentOwnerType,
	AdjustmentType,
	CurrencyCode,
	DecimalString,
	IAdjustment,
	ID
} from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmAdjustmentRepository } from './repository/mikro-orm-adjustment.repository';

/**
 * One signed monetary modification of one document.
 *
 * The table is the platform's single money-adjustment ledger (doc 07 §7): a promotion, a manual
 * override, a loyalty redemption, a gift card, a credit line, a rounding correction, a shipping
 * discount and a fee are the same row with a different `type`. Nothing else may change an amount
 * payable — a second mechanism writing a total directly is how two components come to disagree about
 * what a customer owes.
 *
 * `ownerId` is polymorphic and carries no foreign key: an adjustment belongs to a cart line, a cart, an
 * order, a return line, a claim line or a subscription billing cycle. Rows are never edited after
 * their owner leaves an editable state; a correction is a new reversing row, so the ledger keeps the
 * history of what was decided.
 */
@MultiORMEntity('adjustment', { mikroOrmRepository: () => MikroOrmAdjustmentRepository })
export class Adjustment extends TenantOrganizationBaseEntity implements IAdjustment {
	/**
	 * What the adjustment is attached to.
	 */
	@ApiProperty({ type: () => String, enum: AdjustmentOwnerType })
	@IsEnum(AdjustmentOwnerType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32, default: AdjustmentOwnerType.CART_LINE })
	ownerType: AdjustmentOwnerType;

	/**
	 * Id of the owning row. Polymorphic by design, so it is a plain identifier rather than a relation.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	ownerId: ID;

	/**
	 * Signed exact amount: negative reduces what the customer pays, positive adds a fee or a positive
	 * rounding correction. Zero is never stored — a zero adjustment is removed, not recorded.
	 *
	 * The column is `numeric(20,6)` read through the platform's numeric transformer, so the property is
	 * typed as the exact decimal the money layer works in while the value the ORM hands back may be the
	 * number that transformer parsed; `Money.fromStorage` accepts either form and is the only way the
	 * value should be read for arithmetic.
	 */
	@ApiProperty({ type: () => String })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount: DecimalString;

	/**
	 * Currency of the amount. Always present, so an adjustment is self-describing and can be summed
	 * without reading its owner.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Whether `amount` is expressed in the owner's gross basis. It is what tells a tax split how much
	 * of the reduction was net and how much was tax.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/**
	 * What produced the adjustment. The type fixes the sign of the amount except for `MANUAL`,
	 * `GIFT_CARD` and `ROUNDING`, which may be either.
	 */
	@ApiProperty({ type: () => String, enum: AdjustmentType })
	@IsEnum(AdjustmentType)
	@MultiORMColumn({ type: 'varchar', length: 32, default: AdjustmentType.MANUAL })
	type: AdjustmentType;

	/**
	 * Coupon or promotion code that produced the adjustment, when one exists.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	code?: string;

	/**
	 * Domain of the referenced row, for example `promotion` or `gift_card`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	referenceType?: string;

	/**
	 * Id of the referenced row. No foreign key, because the target table depends on `referenceType`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	referenceId?: ID;

	/**
	 * Human-readable reason shown on the document. Mandatory for a manual adjustment and for a fee.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	description?: string;

	/**
	 * Provider or strategy row that produced the adjustment.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	providerId?: ID;

	/**
	 * Governed reason code from `adjustment_reason`.
	 *
	 * Held as text rather than as a foreign key so that a historical adjustment survives the retirement
	 * of the reason it cites; the service validates the code, and the applicability of the reason to the
	 * adjustment's type, on every write.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	reasonCode?: string;

	/**
	 * The producer's own trace: which rule matched, which allocation was used, the derived net and tax.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/**
	 * Who bears the cost of this row.
	 *
	 * The column exists because the question the discount layer asks last — *who paid for this* — must be
	 * answerable from the ledger rather than from the offer that produced the row: the same promotion may
	 * be funded by the platform, by one seller, or split between them, and the split is expressed as two
	 * rows so that each amount is rounded once on its own. The default is `PLATFORM`, which is what every
	 * row written before the marketplace existed means.
	 */
	@ApiProperty({ type: () => String, enum: AdjustmentFunding, default: AdjustmentFunding.PLATFORM })
	@IsEnum(AdjustmentFunding)
	@MultiORMColumn({ type: 'varchar', length: 16, default: AdjustmentFunding.PLATFORM })
	fundedBy: AdjustmentFunding;

	/**
	 * The seller that bears the cost, when {@link fundedBy} is `SELLER`.
	 *
	 * Held as an id rather than as a relation: the table this points at belongs to the marketplace
	 * package, and the kernel does not depend on a package that depends on it. The constraint onto
	 * `seller` is added by the set that owns that table, and the table's own rule — a row funded by a
	 * seller names one — is added with it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	sellerId?: ID;
}

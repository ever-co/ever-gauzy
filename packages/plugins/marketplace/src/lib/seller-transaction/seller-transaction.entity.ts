import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	CommissionBasis,
	CommissionOn,
	CurrencyCode,
	DecimalString,
	ID,
	ISellerTransaction,
	JsonData,
	SellerHoldReason,
	SellerTransactionKind,
	SellerTransactionStatus
} from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmSellerTransactionRepository } from './repository/mikro-orm-seller-transaction.repository';
import { Seller } from '../seller/seller.entity';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';

/**
 * The split of one order line's money for one seller: the ledger, and the truth about what a seller
 * earned or owes.
 *
 * One row is written per seller-owned order line at placement, plus one per seller-attributed
 * shipping charge and one per carrier cost the platform paid on the seller's behalf. The row carries
 * exactly five monetary columns, and they satisfy — exactly, at the row's currency precision —
 *
 *     netAmount = grossAmount + taxAmount + sellerDiscountAmount − commissionAmount
 *
 * which is what makes the seller's entitlement and the platform's commission sum to what the buyer
 * was charged for the line with no residue anywhere. The commission is resolved once, at placement,
 * and snapshotted here: a later change to the offering, the seller or the platform default never
 * moves a past transaction, so a statement is reproducible from its own columns.
 *
 * The monetary columns are **append only**. A correction is a new reversal row naming the row it
 * reverses, never an edit, and a settled payout is never rewritten to agree with a later reversal:
 * the negative is carried forward instead.
 */
@MultiORMEntity('seller_transaction', { mikroOrmRepository: () => MikroOrmSellerTransactionRepository })
export class SellerTransaction extends TenantOrganizationBaseEntity implements ISellerTransaction {
	/**
	 * What the row records: a sale, shipping revenue, a carrier cost, or the reversal of an earlier row.
	 */
	@ApiProperty({ type: () => String, enum: SellerTransactionKind, default: SellerTransactionKind.SALE })
	@IsEnum(SellerTransactionKind)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: SellerTransactionKind.SALE })
	kind: SellerTransactionKind;

	/**
	 * Where the row stands. Only this column changes after the row is written; its amounts never do.
	 */
	@ApiProperty({ type: () => String, enum: SellerTransactionStatus, default: SellerTransactionStatus.PENDING })
	@IsEnum(SellerTransactionStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: SellerTransactionStatus.PENDING })
	status: SellerTransactionStatus;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	/**
	 * Snapshot of the currency's decimal places, so a later change to a currency's precision cannot
	 * retroactively alter an amount that was already recorded.
	 */
	@ApiProperty({ type: () => Number, default: 2 })
	@MultiORMColumn({ type: 'int', default: 2 })
	currencyDecimals: number;

	/**
	 * Signed: positive for a sale or a shipping charge, negative on a reversal row.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	grossAmount: DecimalString;

	/**
	 * The line's tax, from the line's own tax rows.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	taxAmount: DecimalString;

	/**
	 * The **seller-funded** discount only, non-positive on a sale. It reduces the commission basis
	 * where the basis says it does; the platform's own discount never does.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	sellerDiscountAmount: DecimalString;

	/**
	 * The platform-funded discount attributed to this row, non-positive on a sale.
	 *
	 * It does **not** reduce the seller's net and it does **not** reduce the commission basis: the
	 * platform chose to fund the discount and does not thereby reduce its own fee, and a basis that
	 * moved with someone else's promotion would make a seller's commission unpredictable through no
	 * act of its own. It is the term that makes the row's conservation identity exact.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	platformDiscountAmount: DecimalString;

	/**
	 * The basis convention snapshotted at placement.
	 */
	@ApiProperty({ type: () => String, enum: CommissionBasis })
	@IsEnum(CommissionBasis)
	@MultiORMColumn({ type: 'varchar' })
	commissionBasis: CommissionBasis;

	/**
	 * The amount the rate applied to, signed like the row.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	commissionBasisAmount: DecimalString;

	/**
	 * The resolved rate, snapshotted. It is the rate this seller was actually charged, whatever the
	 * offering or the platform default say today.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, default: 0 })
	commissionRate: DecimalString;

	/**
	 * One multiplication, one rounding, at the currency's precision — or the flat per-item fee where
	 * the basis is a fixed one.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	commissionAmount: DecimalString;

	/**
	 * The seller's entitlement for this row: `grossAmount + taxAmount + sellerDiscountAmount −
	 * commissionAmount`, an exact subtraction of already rounded values rather than an independent
	 * computation, which is what leaves no residue between the two sides of the row.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	netAmount: DecimalString;

	/**
	 * Whether the commission was computed on this line or distributed from an order-level computation.
	 * Recorded rather than inferred, because the two are reconciled differently.
	 */
	@ApiProperty({ type: () => String, enum: CommissionOn, default: CommissionOn.LINE })
	@IsEnum(CommissionOn)
	@MultiORMColumn({ type: 'varchar', default: CommissionOn.LINE })
	commissionOn: CommissionOn;

	/**
	 * The business moment the row describes: placement for a sale, the refund's own date for a
	 * reversal.
	 */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn({ })
	occurredAt: Date;

	/**
	 * When the row became eligible for a payout; null until the money was captured and the hold
	 * elapsed.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	settleableAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	settledAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	paidAt?: Date;

	/**
	 * Mandatory when the status is `HELD`: a held row a seller cannot read the reason for is one it
	 * cannot act on.
	 */
	@ApiPropertyOptional({ type: () => String, enum: SellerHoldReason })
	@IsOptional()
	@IsEnum(SellerHoldReason)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	holdReason?: SellerHoldReason;

	/**
	 * The money movement that caused a reversal; null on a sale.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	refundId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * The rounding trace of the row, the payout run that took it and any provider fragments: a
	 * rounding decision has to be reviewable in a diff.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The seller this row belongs to. Restricted: the ledger is the evidence of what was owed.
	 */
	@MultiORMManyToOne(() => Seller, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	seller?: Seller;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerTransaction) => it.seller)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	sellerId: ID;

	/**
	 * The order the row splits. Carried as an identifier with its index; the constraint onto the order
	 * package's table is created by that package's own migration, which is what keeps the marketplace
	 * from depending on the order tables' internal shape.
	 */
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	orderId: ID;

	/**
	 * The order line the row splits; null for shipping, fee and order-level adjustment rows.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderLineId?: ID;

	/**
	 * The payment-ledger row this split corresponds to. It is the tie between the split ledger and the
	 * money ledger, and it is what makes the split reconciliation a join rather than a reconstruction.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	orderTransactionId?: ID;

	/**
	 * The row this one reverses. A reversal is always a new row, never an edit of the row it reverses.
	 */
	@MultiORMManyToOne(() => SellerTransaction, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn({ name: 'reversesTransactionId' })
	reverses?: SellerTransaction;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@RelationId((it: SellerTransaction) => it.reverses)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	reversesTransactionId?: ID;

	@MultiORMOneToMany(() => SellerTransaction, (transaction) => transaction.reverses)
	reversedBy?: SellerTransaction[];

	/**
	 * The payout lines that paid this transaction. Restricted: a transaction covered by a payout must
	 * not vanish from under it.
	 */
	@MultiORMOneToMany(() => SellerPayoutLine, (line) => line.sellerTransaction, {
		onDelete: 'RESTRICT'
	})
	payoutLines?: SellerPayoutLine[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	CurrencyCode,
	DecimalString,
	ID,
	ISellerPayout,
	JsonData,
	SellerPayoutMode,
	SellerPayoutStatus
} from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { MikroOrmSellerPayoutRepository } from './repository/mikro-orm-seller-payout.repository';
import { Seller } from '../seller/seller.entity';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';
import { SellerSettlement } from '../seller-settlement/seller-settlement.entity';

/**
 * One instruction to move one seller's settleable balance, in one currency, to the seller's bank
 * account.
 *
 * A payout is derived from the ledger and never independent of it. It is built from **settleable
 * transactions of one seller in one currency and by nothing else**, one line per transaction, and
 * `netAmount` is the sum of those lines. A paid payout is never edited: a later refund writes a
 * reversal row on the ledger and leaves the payout exactly as it was, which is what makes the
 * platform's own records reconcilable against a provider's.
 *
 * The platform holds no funds. This row records an instruction given to a regulated provider under
 * the provider's own licence — it is not a movement of the platform's money, and no marketplace table
 * is a cash balance.
 */
@MultiORMEntity('seller_payout', { mikroOrmRepository: () => MikroOrmSellerPayoutRepository })
export class SellerPayout extends TenantOrganizationBaseEntity implements ISellerPayout {
	/**
	 * Human-facing number, drawn from the platform's sequence for payouts and unique per organization.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	number: string;

	/**
	 * Where the instruction stands. `PAID` and `CANCELED` are terminal.
	 */
	@ApiProperty({ type: () => String, enum: SellerPayoutStatus, default: SellerPayoutStatus.DRAFT })
	@IsEnum(SellerPayoutStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: SellerPayoutStatus.DRAFT })
	status: SellerPayoutStatus;

	/**
	 * Snapshotted from the seller at creation: a seller that changes how it is paid does not change
	 * how an already-built payout would be executed.
	 */
	@ApiProperty({ type: () => String, enum: SellerPayoutMode })
	@IsEnum(SellerPayoutMode)
	@MultiORMColumn({ type: 'varchar' })
	payoutMode: SellerPayoutMode;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	@ApiProperty({ type: () => Number, default: 2 })
	@MultiORMColumn({ type: 'int', default: 2 })
	currencyDecimals: number;

	/**
	 * The sum of the payout's lines, and nothing else: the lines are what make the payout's amount a
	 * derivable figure rather than an asserted one.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	netAmount: DecimalString;

	/**
	 * The provider's transfer fee, which the seller bears and the platform does not earn.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	feeAmount: DecimalString;

	/**
	 * Withheld at this run under the reserve policy. It is a per-run computation, not a balance, so
	 * lowering the percentage releases the reserve on the next run with nothing to reconcile.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	reserveAmount: DecimalString;

	/**
	 * `netAmount − feeAmount − reserveAmount`: the amount actually instructed to the provider.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	paidAmount: DecimalString;

	/**
	 * The transfer currency, when it differs from the ledger currency.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	settlementCurrency?: CurrencyCode;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 10, nullable: true })
	fxRate?: DecimalString;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, nullable: true })
	settlementAmount?: DecimalString;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	fxCapturedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	periodStart?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	periodEnd?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	scheduledAt?: Date;

	/**
	 * The offboarding payout: exempt from the minimum threshold and from the reserve, because a seller
	 * being closed down is owed the whole balance and no future run will release a reserve.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@MultiORMColumn({ type: 'boolean', default: false })
	isFinal: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	approvedAt?: Date;

	/**
	 * Set by the approving operator. Approving is a separate permission from creating, because
	 * creating a payout is preparation and approving one moves money.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: SellerPayout) => it.approvedByUser)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	approvedByUserId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	paidAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	failedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	canceledAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	providerKey?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	providerReference?: string;

	/**
	 * The provider's transfer id, unique per provider. It is what makes a retried execution replay the
	 * stored response instead of moving money twice.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	providerTransferId?: string;

	/**
	 * Masked snapshot of the destination at the time of payment, which is what a statement shows.
	 * The account itself is the holder the seller names, never a string copied here.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	payoutAccountReference?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	failureCode?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	failureReason?: string;

	/**
	 * Mandatory when an operator creates a payout below the seller's threshold; the note is the
	 * recorded justification for overriding a policy.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	@MultiORMManyToOne(() => Seller, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	seller?: Seller;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerPayout) => it.seller)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	sellerId: ID;

	/**
	 * The transactions this payout pays. They cascade with the payout, because a line has no meaning
	 * without one; cancelling a payout soft-deletes its lines, which is what releases the transactions
	 * back to settleable.
	 */
	@MultiORMOneToMany(() => SellerPayoutLine, (line) => line.sellerPayout, {
		onDelete: 'CASCADE'
	})
	lines?: SellerPayoutLine[];

	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	approvedByUser?: User;

	/**
	 * The settlement report that accounts for this payout, in the transfer mode.
	 */
	@MultiORMManyToOne(() => SellerSettlement, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	reconcilesSettlement?: SellerSettlement;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: SellerPayout) => it.reconcilesSettlement)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	reconcilesSettlementId?: ID;
}

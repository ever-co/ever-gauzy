import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	CurrencyCode,
	DecimalString,
	ID,
	ISellerSettlement,
	JsonData,
	SellerSettlementStatus
} from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { MikroOrmSellerSettlementRepository } from './repository/mikro-orm-seller-settlement.repository';
import { Seller } from '../seller/seller.entity';
import { SellerPayout } from '../seller-payout/seller-payout.entity';

/**
 * What the payment provider reported it did, recorded as reported.
 *
 * This row is the provider's statement for a period and not the platform's expectation of one. It
 * carries the provider's own gross, the commission it withheld, **its** fee — which is not the
 * platform's commission and is never netted into it — and the net it transferred. Where the
 * platform's lines for the period and the provider's net disagree, the difference is recorded as a
 * discrepancy and reported: the platform's own ledger is never edited to agree with an external
 * report, because a ledger that can be edited to agree with anything can be reconciled against
 * nothing.
 *
 * A closed settlement accepts no further lines, and a replayed provider report cannot create a
 * second one: the report id is unique per provider.
 */
@MultiORMEntity('seller_settlement', { mikroOrmRepository: () => MikroOrmSellerSettlementRepository })
export class SellerSettlement extends TenantOrganizationBaseEntity implements ISellerSettlement {
	/**
	 * The provider that reported the settlement.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	providerKey: string;

	/**
	 * Where the report stands. `CLOSED` is terminal and refuses further lines.
	 */
	@ApiProperty({ type: () => String, enum: SellerSettlementStatus, default: SellerSettlementStatus.OPEN })
	@IsEnum(SellerSettlementStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: SellerSettlementStatus.OPEN })
	status: SellerSettlementStatus;

	/**
	 * Currency of the reported figures.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3 })
	currency: CurrencyCode;

	@ApiProperty({ type: () => Number, default: 2 })
	@MultiORMColumn({ type: 'int', default: 2 })
	currencyDecimals: number;

	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	grossAmount: DecimalString;

	/**
	 * The commission withheld at source: by the provider in the split mode, or by the platform before
	 * the seller's account was credited in the transfer mode.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	commissionAmount: DecimalString;

	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	feeAmount: DecimalString;

	/**
	 * `grossAmount − commissionAmount − feeAmount`.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	netAmount: DecimalString;

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
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	fxCapturedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	periodStart?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	periodEnd?: Date;

	/**
	 * The provider's own report id, unique per provider: a replayed report is a constraint violation
	 * rather than a second settlement.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	providerReportId?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalReference?: string;

	/**
	 * The platform's lines for the period less the reported net: zero when the two agree, and the
	 * figure the reconciliation report explains when they do not.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	discrepancyAmount: DecimalString;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	reconciledAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: SellerSettlement) => it.reconciledByUser)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	reconciledByUserId?: ID;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	closedAt?: Date;

	/**
	 * Mandatory when the settlement is disputed or carries a discrepancy, because a difference that
	 * nobody wrote down is a difference nobody will resolve.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'text', nullable: true })
	note?: string;

	/**
	 * The provider's report fragment and the per-line differences the reconciliation found.
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

	@MultiORMManyToOne(() => Seller, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	seller?: Seller;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerSettlement) => it.seller)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	sellerId: ID;

	/**
	 * The account the provider settled into: the join between the provider's report, the payout
	 * instruction and the destination, so the three cannot disagree about which account the money went
	 * to. Nullable only for a historical settlement imported before the account row existed.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	payoutAccountHolderId?: ID;

	/**
	 * The payout this settlement reports, in the transfer mode.
	 */
	@MultiORMManyToOne(() => SellerPayout, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payout?: SellerPayout;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@RelationId((it: SellerSettlement) => it.payout)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	payoutId?: ID;

	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	reconciledByUser?: User;
}

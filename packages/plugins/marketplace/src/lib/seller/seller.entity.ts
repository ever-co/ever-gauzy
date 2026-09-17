import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	CommissionBasis,
	CurrencyCode,
	DecimalString,
	ICommissionTier,
	ID,
	ISeller,
	JsonData,
	SellerPayoutMode,
	SellerPayoutSchedule,
	SellerStatus,
	SellerVerificationStatus,
	TaxCollectionMode,
	TaxRegistrationScheme
} from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	Merchant,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	OrganizationContact,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { MikroOrmSellerRepository } from './repository/mikro-orm-seller.repository';
import { SellerOffering } from '../seller-offering/seller-offering.entity';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { SellerSettlement } from '../seller-settlement/seller-settlement.entity';

/**
 * A merchant on the marketplace.
 *
 * A seller is a party **plus** a commercial relationship: the party is the platform's own
 * `organization_contact` — already the row that carries the buyer relationship, the invoices and the
 * audit trail — and this row carries what makes that party a marketplace participant: a lifecycle, a
 * commission, a tax registration, payout terms and a balance. The same business may be a buyer on one
 * channel and a seller here, which is why the participation is a row of its own and why nothing about
 * it is written onto the party.
 *
 * The payee master (`merchant`) keeps its existing meaning and is not reused: it is a label the
 * organization pays by invoice, with no lifecycle, no commission and no balance. Where the same
 * business is both, `merchantId` links the two so nobody types the business twice; the marketplace
 * never reads `merchant` for commission, split or payout arithmetic.
 *
 * A seller belongs to exactly one organization, forever. `organizationId` is inherited and is never
 * an updatable field: no operation moves a seller between organizations, and every child row copies
 * the organization of the parent row the service read rather than one supplied by a caller.
 */
@MultiORMEntity('seller', { mikroOrmRepository: () => MikroOrmSellerRepository })
export class Seller extends TenantOrganizationBaseEntity implements ISeller {
	/**
	 * Stable, human-usable key, unique per organization and immutable after creation.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/**
	 * Trading name.
	 */
	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255 })
	name: string;

	/**
	 * Registered name. Retained through offboarding, because a ledger row must resolve to a named
	 * legal entity after the person behind it has been erased.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	legalName?: string;

	/**
	 * Snapshot of the party's reachability for marketplace correspondence, so a notification path
	 * survives an edit to the contact row.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	email?: string;

	/**
	 * Snapshot of the party's phone number.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	phone?: string;

	/**
	 * Channels the seller may sell in; null means every channel of the organization. A coarse gate
	 * only: the offering carries the fine one.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonColumn<string[]>({ nullable: true })
	channelIds?: string[];

	/**
	 * Regions the seller serves; null inherits the channel's own set.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonColumn<string[]>({ nullable: true })
	regionIds?: string[];

	/**
	 * Participation state. It moves only along the documented transitions, and `ACTIVE` is reached
	 * only by an explicit activation after every required verification passed.
	 */
	@ApiProperty({ type: () => String, enum: SellerStatus, default: SellerStatus.DRAFT })
	@IsEnum(SellerStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: SellerStatus.DRAFT })
	status: SellerStatus;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	submittedAt?: Date;

	/**
	 * Set on every entry to `ACTIVE`, including a reinstatement after suspension.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	activatedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	suspendedAt?: Date;

	/**
	 * Mandatory when the status is `SUSPENDED`: a suspension a seller cannot read the reason for is
	 * one it cannot remedy.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	suspensionReason?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	rejectedAt?: Date;

	/**
	 * Mandatory when the status is `REJECTED`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	rejectionReason?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	offboardedAt?: Date;

	/**
	 * Business-identity verification. One of three independent verdicts: a seller that cannot be
	 * identified and cannot receive money must not be allowed to accumulate a balance.
	 */
	@ApiProperty({
		type: () => String,
		enum: SellerVerificationStatus,
		default: SellerVerificationStatus.UNVERIFIED
	})
	@IsEnum(SellerVerificationStatus)
	@MultiORMColumn({ type: 'varchar', default: SellerVerificationStatus.UNVERIFIED })
	businessVerificationStatus: SellerVerificationStatus;

	@ApiProperty({ type: () => String, enum: SellerVerificationStatus, default: SellerVerificationStatus.UNVERIFIED })
	@IsEnum(SellerVerificationStatus)
	@MultiORMColumn({ type: 'varchar', default: SellerVerificationStatus.UNVERIFIED })
	taxVerificationStatus: SellerVerificationStatus;

	/**
	 * Payout-account verification. Reports the verification verdict of the account holder the money is
	 * sent to, and is what a payout requires to be `VERIFIED`.
	 */
	@ApiProperty({ type: () => String, enum: SellerVerificationStatus, default: SellerVerificationStatus.UNVERIFIED })
	@IsEnum(SellerVerificationStatus)
	@MultiORMColumn({ type: 'varchar', default: SellerVerificationStatus.UNVERIFIED })
	payoutAccountStatus: SellerVerificationStatus;

	/**
	 * The provider that performed the verification, or null when a person recorded the result.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	verificationProvider?: string;

	/**
	 * The provider's own verification id, echoed back so a later expiry notice can be matched to it.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	verificationReference?: string;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	verifiedAt?: Date;

	/**
	 * Verification expires: an expired payout account holds payouts, an expired identity suspends the
	 * seller, because selling without a valid identity is the riskier of the two.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ type: 'timestamptz', nullable: true })
	verificationExpiresAt?: Date;

	/**
	 * Opaque, masked display reference to the destination account.
	 *
	 * **Never a bank account number, an IBAN or a routing number**, and never a provider secret: the
	 * provider holds the account and the platform holds a reference to it. The platform does not store
	 * payout credentials, and a provider that cannot hold the account itself is a provider the
	 * marketplace is not enabled with.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	payoutAccountReference?: string;

	/**
	 * The verified account holder the money is sent to: a core `payment_account_holder` row of type
	 * `SELLER` in this seller's own organization. The identifier is carried here and the relation is
	 * declared with it; a payout is built only for a seller whose holder is active, and a holder a
	 * payout or a settlement references is never deleted, only disabled.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	payoutAccountHolderId?: ID;

	/**
	 * The seller's tax identification number.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	taxId?: string;

	/**
	 * VAT or GST registration number, where the jurisdiction distinguishes it from a tax id.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	vatNumber?: string;

	/**
	 * Jurisdiction of registration, ISO 3166-1 alpha-2, which selects the registration's rules.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(2)
	@MultiORMColumn({ type: 'varchar', length: 2, nullable: true })
	taxCountryCode?: string;

	@ApiPropertyOptional({ type: () => String, enum: TaxRegistrationScheme })
	@IsOptional()
	@IsEnum(TaxRegistrationScheme)
	@MultiORMColumn({ type: 'varchar', nullable: true })
	taxRegistrationScheme?: TaxRegistrationScheme;

	/**
	 * Who collects and remits the tax on this seller's lines. Per seller rather than per tenant,
	 * because the correct answer depends on the jurisdiction of the seller and of the buyer.
	 */
	@ApiProperty({ type: () => String, enum: TaxCollectionMode, default: TaxCollectionMode.SELLER_REMITS })
	@IsEnum(TaxCollectionMode)
	@MultiORMColumn({ type: 'varchar', default: TaxCollectionMode.SELLER_REMITS })
	taxCollectionMode: TaxCollectionMode;

	/**
	 * The seller's default commission rate, as a fraction: `0.150000` is fifteen per cent. Null
	 * inherits the platform default, and the resolution is field by field — a seller that sets only a
	 * rate inherits the platform's basis rather than silently producing a zero commission.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, nullable: true })
	defaultCommissionRate?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: CommissionBasis })
	@IsOptional()
	@IsEnum(CommissionBasis)
	@MultiORMColumn({ type: 'varchar', nullable: true })
	commissionBasis?: CommissionBasis;

	/**
	 * Graduated bands, half open: `[{ "from": 0, "to": 100, "rate": 0.12 }, …]`. Overlapping or gapped
	 * bands are refused at write time, and a tiered basis with a rate is refused too: two answers to
	 * one question is a defect rather than a policy.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonColumn<ICommissionTier[]>({ nullable: true })
	commissionTiers?: ICommissionTier[];

	/**
	 * The flat fee per item, for the fixed-fee basis.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, nullable: true })
	fixedFeePerItem?: DecimalString;

	/**
	 * Currency of the flat fee; mandatory when it differs from the payout currency.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	fixedFeeCurrency?: CurrencyCode;

	/**
	 * Whether commission applies to a seller-attributed shipping charge. Defaults to true, because a
	 * shipping charge is revenue like any other.
	 */
	@ApiProperty({ type: () => Boolean, default: true })
	@MultiORMColumn({ type: 'boolean', default: true })
	commissionOnShipping: boolean;

	/**
	 * Whether the platform paid a carrier cost on the seller's behalf. When true, that cost is
	 * recorded as its own negative ledger row rather than netted invisibly into a sale.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@MultiORMColumn({ type: 'boolean', default: false })
	chargeShippingCost: boolean;

	/**
	 * Whether a line of this seller may have a negative net. Off by default: a negative net means the
	 * seller owes the platform on a sale it did not choose to make at that price.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@MultiORMColumn({ type: 'boolean', default: false })
	allowNegativeNet: boolean;

	/**
	 * How the seller's money reaches the seller. There are exactly two permitted modes, and in both
	 * the seller's share is credited to the seller's own provider account at capture, so the platform
	 * never holds a third party's money.
	 */
	@ApiProperty({ type: () => String, enum: SellerPayoutMode, default: SellerPayoutMode.PROVIDER_TRANSFER })
	@IsEnum(SellerPayoutMode)
	@MultiORMColumn({ type: 'varchar', default: SellerPayoutMode.PROVIDER_TRANSFER })
	payoutMode: SellerPayoutMode;

	@ApiProperty({ type: () => String, enum: SellerPayoutSchedule, default: SellerPayoutSchedule.MANUAL })
	@IsEnum(SellerPayoutSchedule)
	@MultiORMColumn({ type: 'varchar', default: SellerPayoutSchedule.MANUAL })
	payoutSchedule: SellerPayoutSchedule;

	/**
	 * Null means the seller is paid per order currency.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	payoutCurrency?: CurrencyCode;

	/**
	 * The minimum balance a payout run will pay out, in the payout currency or per currency when none
	 * is set. A balance below it carries forward, and only three things create a payout below it: the
	 * final offboarding payout, an operator-created payout with a note, and a negative balance, which
	 * is never a payout at all.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, default: 0 })
	payoutThreshold: DecimalString;

	/**
	 * Fraction of the settleable balance withheld at each run. It is a policy applied at run time and
	 * never a stored balance, so lowering it releases the reserve on the next run with nothing to
	 * reconcile.
	 */
	@ApiProperty({ type: () => String, default: '0' })
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, default: 0 })
	reservePercent: DecimalString;

	@ApiProperty({ type: () => Number, default: 0 })
	@MultiORMColumn({ type: 'int', default: 0 })
	reserveHoldDays: number;

	/**
	 * Delays a transaction's inclusion in any payout, so a tenant can hold funds through the
	 * provider's own chargeback window without touching its commission policy.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@MultiORMColumn({ type: 'int', default: 0 })
	payoutHoldDays: number;

	/**
	 * The seller's key in an upstream system; unique per organization when set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * Documents, verification fragments, payout-account notes and tenant extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The seller's party row. Restricted on delete: a seller with ledger rows must not be hard-deleted,
	 * because the ledger is what explains what the seller was owed and paid.
	 */
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'RESTRICT'
	})
	@JoinColumn()
	contact?: OrganizationContact;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: Seller) => it.contact)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	contactId: ID;

	/**
	 * The optional payee-master link. It exists to prevent duplicate data entry and is never read for
	 * commission, split or payout arithmetic.
	 */
	@MultiORMManyToOne(() => Merchant, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	merchant?: Merchant;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: Seller) => it.merchant)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	merchantId?: ID;

	/**
	 * The staff user who administers this seller from inside the platform. It grants that user the
	 * seller-side view of this one seller and nothing platform-wide.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	user?: User;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: Seller) => it.user)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	userId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * What the seller offers. Cascades with the seller, because an offering has no meaning without one.
	 */
	@MultiORMOneToMany(() => SellerOffering, (offering) => offering.seller, {
		onDelete: 'CASCADE'
	})
	offerings?: SellerOffering[];

	/**
	 * The seller's ledger. Restricted: a row of it is evidence of money owed or paid.
	 */
	@MultiORMOneToMany(() => SellerTransaction, (transaction) => transaction.seller, {
		onDelete: 'RESTRICT'
	})
	transactions?: SellerTransaction[];

	@MultiORMOneToMany(() => SellerPayout, (payout) => payout.seller, {
		onDelete: 'RESTRICT'
	})
	payouts?: SellerPayout[];

	@MultiORMOneToMany(() => SellerSettlement, (settlement) => settlement.seller, {
		onDelete: 'RESTRICT'
	})
	settlements?: SellerSettlement[];
}

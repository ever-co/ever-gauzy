import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import {
	CommissionBasis,
	CurrencyCode,
	DecimalString,
	ICommissionTier,
	ID,
	ISellerOffering,
	JsonData,
	OfferingCondition,
	OfferingFulfilmentMode,
	OfferingStatus
} from '@gauzy/contracts';
import {
	ColumnIndex,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	Product,
	ProductVariant,
	TenantOrganizationBaseEntity,
	User,
	Warehouse
} from '@gauzy/core';
import { MikroOrmSellerOfferingRepository } from './repository/mikro-orm-seller-offering.repository';
import { Seller } from '../seller/seller.entity';

/**
 * A seller's right to sell one product variant.
 *
 * The catalogue is unchanged by the marketplace: a product and its variants exist once, in the
 * platform catalogue, and a seller neither owns a product nor holds a private copy of one. This row
 * is the relationship between an existing variant and a seller — at the seller's price, under the
 * seller's own SKU, in a set of channels, for a period, at a commission the offering may override.
 *
 * `(sellerId, variantId)` is unique among live rows, so a seller offers a variant once, while a
 * variant may be offered by many sellers at once: competing offers are the normal case and the winner
 * is decided by the platform's price resolution rather than by a second pricing mechanism here.
 */
@MultiORMEntity('seller_offering', { mikroOrmRepository: () => MikroOrmSellerOfferingRepository })
export class SellerOffering extends TenantOrganizationBaseEntity implements ISellerOffering {
	/**
	 * The seller's own SKU for this listing, unique per seller when set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(128)
	@MultiORMColumn({ type: 'varchar', length: 128, nullable: true })
	sellerSku?: string;

	/**
	 * The seller's own listing title; null uses the catalogue title. It overrides the title for this
	 * seller's listing only and never changes the catalogue.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	title?: string;

	/**
	 * The condition of the goods offered: the same variant may be offered new by one seller and
	 * refurbished by another.
	 */
	@ApiProperty({ type: () => String, enum: OfferingCondition, default: OfferingCondition.NEW })
	@IsEnum(OfferingCondition)
	@MultiORMColumn({ type: 'varchar', default: OfferingCondition.NEW })
	condition: OfferingCondition;

	/**
	 * The seller's price, for the case where it has exactly one price with no tiers and no window.
	 *
	 * It is an authoring convenience: publishing materialises it into a price row with the seller set,
	 * so only one mechanism is ever read at resolution time and there is exactly one place a price can
	 * be wrong. The columns are never read once `productPriceId` is set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, nullable: true })
	priceAmount?: DecimalString;

	/**
	 * Currency of the authored price; mandatory when an amount is set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	priceCurrency?: CurrencyCode;

	/**
	 * The authoritative price row for this offering. A seller-scoped price row wins for this seller's
	 * lines and for no one else's: it is never a candidate for another seller's line and never a
	 * candidate for a platform-owned one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	productPriceId?: ID;

	/**
	 * Commission override for this offering; null inherits the seller's default, which in turn
	 * inherits the platform's. Resolution is field by field down that chain.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ type: 'numeric', precision: 9, scale: 6, nullable: true })
	commissionRate?: DecimalString;

	@ApiPropertyOptional({ type: () => String, enum: CommissionBasis })
	@IsOptional()
	@IsEnum(CommissionBasis)
	@MultiORMColumn({ type: 'varchar', nullable: true })
	commissionBasis?: CommissionBasis;

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonColumn<ICommissionTier[]>({ nullable: true })
	commissionTiers?: ICommissionTier[];

	/**
	 * Whether the offering is sellable. `ACTIVE` is not sufficient on its own: the publication rules
	 * are conjunctive and the seller's own state, the availability window and the catalogue's
	 * publication of the variant all have to hold as well.
	 */
	@ApiProperty({ type: () => String, enum: OfferingStatus, default: OfferingStatus.DRAFT })
	@IsEnum(OfferingStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: OfferingStatus.DRAFT })
	status: OfferingStatus;

	/**
	 * Channels this offering is published to; null inherits the seller's set, and a seller with none is
	 * available on every channel of the organization. Publication is opt-in and additive: nothing
	 * becomes visible on a channel the platform catalogue has not already published to.
	 */
	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonColumn<string[]>({ nullable: true })
	channelIds?: string[];

	@ApiPropertyOptional({ type: () => Array })
	@IsOptional()
	@JsonColumn<string[]>({ nullable: true })
	regionIds?: string[];

	/**
	 * Availability window start; null is open. The window is half open: `availableFrom <= now <
	 * availableTo`.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	availableFrom?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	availableTo?: Date;

	/**
	 * A per-order cap; null means none.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@MultiORMColumn({ type: 'int', nullable: true })
	maxQuantityPerOrder?: number;

	/**
	 * Who ships the goods. It decides which stock locations may be allocated from: a seller shipping
	 * its own goods may only allocate from locations the seller owns, so its stock is never sold by
	 * another seller and never used to fulfil a platform-owned line.
	 */
	@ApiProperty({ type: () => String, enum: OfferingFulfilmentMode, default: OfferingFulfilmentMode.PLATFORM })
	@IsEnum(OfferingFulfilmentMode)
	@MultiORMColumn({ type: 'varchar', default: OfferingFulfilmentMode.PLATFORM })
	fulfilmentMode: OfferingFulfilmentMode;

	/**
	 * Promised handling time, used by the delivery estimate.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@MultiORMColumn({ type: 'int', nullable: true })
	handlingDays?: number;

	/**
	 * Orders competing offers of the same variant in a listing. Merchandising only: it never decides
	 * which offer a buyer gets, which is price resolution's job.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@MultiORMColumn({ type: 'boolean', default: false })
	isFeatured: boolean;

	/**
	 * Per-offering override of the seller's negative-net policy; null inherits it.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@MultiORMColumn({ type: 'boolean', nullable: true })
	allowNegativeNet?: boolean;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	approvedAt?: Date;

	/**
	 * Mandatory when the status is `REJECTED`.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	rejectionReason?: string;

	/**
	 * Unique per seller when set.
	 */
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
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The seller whose right to sell this is.
	 */
	@MultiORMManyToOne(() => Seller, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	seller?: Seller;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerOffering) => it.seller)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	sellerId: ID;

	/**
	 * The catalogue variant: the saleable unit, defined once for the whole platform.
	 */
	@MultiORMManyToOne(() => ProductVariant, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	variant?: ProductVariant;

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@RelationId((it: SellerOffering) => it.variant)
	@MultiORMColumn({ type: 'uuid', relationId: true })
	variantId: ID;

	/**
	 * Derived from the variant and stored so offering reports and filters need no join.
	 */
	@MultiORMManyToOne(() => Product, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	product?: Product;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@RelationId((it: SellerOffering) => it.product)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	productId?: ID;

	/**
	 * The location the goods ship from, for a seller-fulfilled offering. Null lets the allocation
	 * strategy choose among the seller's own locations.
	 */
	@MultiORMManyToOne(() => Warehouse, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	fulfilmentWarehouse?: Warehouse;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: SellerOffering) => it.fulfilmentWarehouse)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	fulfilmentWarehouseId?: ID;

	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	approvedByUser?: User;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@RelationId((it: SellerOffering) => it.approvedByUser)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	approvedByUserId?: ID;
}

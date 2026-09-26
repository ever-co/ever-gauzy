import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IShippingOption, ShippingPriceType } from '@gauzy/contracts';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { ShippingProfile } from '../shipping-profile/shipping-profile.entity';
import { MikroOrmShippingOptionRepository } from './repository/mikro-orm-shipping-option.repository';

/**
 * A configured, sellable delivery choice: what a buyer picks and what it costs.
 *
 * Three shapes are expressible and the service holds each to its own rule: a **flat** option states an
 * amount and a currency, a **calculated** option names the registered provider strategy that will price
 * it at checkout, and a **free** option states neither. An option with a profile is offered for that
 * profile's variants; an option with none is offered for anything.
 *
 * **Eligibility conditions are not columns here.** They are rows of the core `rule` engine with
 * `ownerType = SHIPPING_OPTION`, so the same evaluator that decides a promotion decides whether a
 * delivery is available — and this table stays a description of the option rather than a second rule
 * engine.
 */
@MultiORMEntity('shipping_option', { mikroOrmRepository: () => MikroOrmShippingOptionRepository })
export class ShippingOption extends TenantOrganizationBaseEntity implements IShippingOption {
	/** The option's name as the buyer reads it. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn()
	name: string;

	/** A stable code, unique per organization, that a storefront configuration may name. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 64 })
	code: string;

	/** How the option is priced. */
	@ApiProperty({ type: () => String, enum: ShippingPriceType })
	@IsEnum(ShippingPriceType)
	@MultiORMColumn({ type: 'simple-enum', enum: ShippingPriceType, default: ShippingPriceType.FLAT })
	priceType: ShippingPriceType;

	/** Required for a flat option, ignored otherwise. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	amount?: number;

	/** Required for a flat option. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(3)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 3 })
	currency?: string;

	/** Whether a flat amount is a gross. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/** The tax class the delivery is taxed under. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	taxCategoryId?: ID;

	/**
	 * The registered shipping and rating strategy that prices this option. Required for a calculated
	 * option: the key names a strategy, it is not an integration row.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ nullable: true, type: 'varchar', length: 64 })
	providerKey?: string;

	/** The profile this option is offered for. Null means offered for any profile. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ShippingOption) => it.profile)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	profileId?: ID;

	/** The channel this option is offered on. Null means every channel. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	channelId?: ID;

	/** The region this option serves. Null means every region. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	regionId?: ID;

	/** Display and tie-break order. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 0 })
	priority: number;

	/** The lower bound of the delivery estimate, in days. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ nullable: true, type: 'int' })
	estimatedMinDays?: number;

	/** The upper bound of the delivery estimate, in days. Never below the lower bound. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ nullable: true, type: 'int' })
	estimatedMaxDays?: number;

	/** A pickup option sets this false: the buyer is not asked for a delivery address. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: true })
	requiresShippingAddress: boolean;

	/** Whether the buyer collects the goods rather than receiving them. */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	allowPickup: boolean;

	/** The weight ceiling above which this option is not eligible. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true, type: 'numeric', precision: 12, scale: 4, transformer: new ColumnNumericTransformerPipe() })
	maxWeight?: number;

	/** The item-count ceiling above which this option is not eligible. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ nullable: true, type: 'int' })
	maxItemCount?: number;

	/** Optimistic lock: editing an option takes an entity tag and bumps this counter. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', default: 1 })
	version: number;

	/** Open-ended payload for the calculator's annotations. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/** The profile this option belongs to, when it belongs to one. */
	@MultiORMManyToOne(() => ShippingProfile, (it) => it.shippingOptions, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	profile?: ShippingProfile;
}

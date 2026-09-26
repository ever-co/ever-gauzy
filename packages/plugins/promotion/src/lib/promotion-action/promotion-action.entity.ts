import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
	ColumnIndex,
	ColumnNumericTransformerPipe,
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { MikroOrmPromotionActionRepository } from './repository/mikro-orm-promotion-action.repository';
import {
	IPromotion,
	IPromotionAction,
	PromotionActionAllocation,
	PromotionActionTargetType,
	PromotionActionType
} from '../promotion.types';
import { Promotion } from '../promotion/promotion.entity';

/**
 * What a promotion does when it matches.
 *
 * Which items the action applies to is not a column here: it is a `rule` row with owner type
 * `PROMOTION_ACTION` and scope `TARGET`, and which items must be bought to trigger it is a row with
 * scope `BUY`. The columns below describe the arithmetic of the benefit and nothing else.
 */
@MultiORMEntity('promotion_action', { mikroOrmRepository: () => MikroOrmPromotionActionRepository })
export class PromotionAction extends TenantOrganizationBaseEntity implements IPromotionAction {
	/**
	 * The kind of benefit. The promotion's own `type` decides which values are legal.
	 */
	@ApiProperty({ type: () => String, enum: PromotionActionType })
	@IsEnum(PromotionActionType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 32 })
	type: PromotionActionType;

	/**
	 * What the benefit lands on. An `ORDER` target implies allocation `ACROSS`, because an
	 * order-scoped discount has no per-unit meaning.
	 */
	@ApiProperty({ type: () => String, enum: PromotionActionTargetType })
	@IsEnum(PromotionActionTargetType)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', length: 16, default: PromotionActionTargetType.ORDER })
	targetType: PromotionActionTargetType;

	/**
	 * How the benefit is spread over its targets.
	 */
	@ApiProperty({ type: () => String, enum: PromotionActionAllocation })
	@IsEnum(PromotionActionAllocation)
	@MultiORMColumn({ type: 'varchar', length: 16, default: PromotionActionAllocation.ACROSS })
	allocation: PromotionActionAllocation;

	/**
	 * Amount for `FIXED` and `BUNDLE_PRICE`, a fraction in `(0, 1]` stored as a plain percentage
	 * number for `PERCENTAGE` and `TIERED_PERCENTAGE`, and ignored by the two free actions.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: 'numeric', precision: 20, scale: 6, transformer: new ColumnNumericTransformerPipe() })
	value: DecimalString;

	/**
	 * Required for a fixed-amount action, so that `15.00` can never be applied to a cart in another
	 * currency.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: string;

	/**
	 * Cap on the quantity the action may discount. Required for an `EACH` action: without it an
	 * `EACH` action has no bound at all.
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
	 * Overrides the eligible target quantity before `maxQuantity` is applied.
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
	applyToQuantity?: DecimalString;

	/**
	 * The buy quantity that triggers the action, for a buy-and-get promotion.
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
	buyRulesMinQuantity?: DecimalString;

	/**
	 * Whether the produced adjustment is expressed on the gross basis. The tax split of the discount
	 * follows from it.
	 */
	@ApiProperty({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	isTaxInclusive: boolean;

	/**
	 * Application order inside the promotion. Actions of one promotion see each other's effect on the
	 * remaining discountable amount, so the order is a commercial decision and is explicit.
	 */
	@ApiProperty({ type: () => Number, default: 0 })
	@IsInt()
	@Min(0)
	@MultiORMColumn({ type: 'int', default: 0 })
	position: number;

	/**
	 * Tiers, bundle size, selection rule, shipping option codes, free variant ids and the discount
	 * cap. Open-ended, so a JSON column rather than a column per key.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

	/*
	|--------------------------------------------------------------------------
	| Relations
	|--------------------------------------------------------------------------
	*/

	/**
	 * The promotion the action belongs to. An action has no meaning without its promotion.
	 */
	@MultiORMManyToOne(() => Promotion, (promotion) => promotion.actions, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	promotion?: IPromotion;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: PromotionAction) => it.promotion)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	promotionId: ID;
}

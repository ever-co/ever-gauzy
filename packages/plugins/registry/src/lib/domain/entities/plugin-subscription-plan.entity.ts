import { IUser } from '@gauzy/contracts';
import { BaseEntity, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, MultiORMOneToMany, User } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Min
} from 'class-validator';
import { Index, JoinColumn, Relation, RelationId } from 'typeorm';
import type { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import {
	IPluginSubscriptionPlan,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '../../shared/models/plugin-subscription.model';
import type { IPlugin } from '../../shared/models/plugin.model';
import { PluginSubscription } from './plugin-subscription.entity';
import { Plugin } from './plugin.entity';

@MultiORMEntity('plugin_subscription_plans')
@Index(['pluginId', 'type'], { unique: false })
@Index(['isActive', 'type'], { unique: false })
@Index(['price', 'billingPeriod'], { unique: false })
export class PluginSubscriptionPlan extends BaseEntity implements IPluginSubscriptionPlan {
	@ApiProperty({ type: String, description: 'Plan name' })
	@IsNotEmpty({ message: 'Plan name is required' })
	@IsString({ message: 'Plan name must be a string' })
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: String, description: 'Plan description' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiProperty({ enum: PluginSubscriptionType, description: 'Subscription type/plan level' })
	@IsEnum(PluginSubscriptionType, { message: 'Invalid subscription type' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSubscriptionType,
		default: PluginSubscriptionType.FREE
	})
	type: PluginSubscriptionType;

	@ApiProperty({ type: Number, description: 'Plan price' })
	@IsNumber({}, { message: 'Price must be a valid number' })
	@Min(0, { message: 'Price cannot be negative' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2, default: 0 })
	price: number;

	@ApiProperty({ type: String, description: 'Currency code (e.g., USD, EUR)' })
	@IsNotEmpty({ message: 'Currency is required' })
	@IsString({ message: 'Currency must be a string' })
	@MultiORMColumn({ type: 'varchar', length: 3, default: 'USD' })
	currency: string;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginBillingPeriod,
		default: PluginBillingPeriod.MONTHLY
	})
	billingPeriod: PluginBillingPeriod;

	@ApiProperty({ type: [String], description: 'Plan features list' })
	@IsArray({ message: 'Features must be an array' })
	@IsString({ each: true, message: 'Each feature must be a string' })
	@MultiORMColumn({ type: 'simple-array' })
	features: string[];

	@ApiPropertyOptional({ type: Object, description: 'Plan limitations and quotas' })
	@IsOptional()
	@IsObject({ message: 'Limitations must be an object' })
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	limitations?: Record<string, any>;

	@ApiProperty({ type: Boolean, description: 'Whether the plan is active and available for purchase' })
	@IsBoolean({ message: 'isActive must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: true })
	isActive: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Whether this plan is marked as popular' })
	@IsOptional()
	@IsBoolean({ message: 'isPopular must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: false })
	isPopular?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Whether this plan is recommended' })
	@IsOptional()
	@IsBoolean({ message: 'isRecommended must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: false })
	isRecommended?: boolean;

	@ApiPropertyOptional({ type: Number, description: 'Trial period duration in days' })
	@IsOptional()
	@IsNumber({}, { message: 'Trial days must be a number' })
	@Min(0, { message: 'Trial days cannot be negative' })
	@MultiORMColumn({ type: 'int', nullable: true })
	trialDays?: number;

	@ApiPropertyOptional({ type: Number, description: 'Setup fee for the plan' })
	@IsOptional()
	@IsNumber({}, { message: 'Setup fee must be a number' })
	@Min(0, { message: 'Setup fee cannot be negative' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2, nullable: true })
	setupFee?: number;

	@ApiPropertyOptional({ type: Number, description: 'Discount percentage for the plan' })
	@IsOptional()
	@IsNumber({}, { message: 'Discount percentage must be a number' })
	@Min(0, { message: 'Discount percentage cannot be negative' })
	@MultiORMColumn({ type: 'decimal', precision: 5, scale: 2, nullable: true })
	discountPercentage?: number;

	@ApiPropertyOptional({ type: String, description: 'Plan metadata (JSON string)' })
	@IsOptional()
	@IsObject({ message: 'Metadata must be an object' })
	@MultiORMColumn({ type: 'jsonb', nullable: true })
	metadata?: Record<string, any>;

	@ApiPropertyOptional({ type: Number, description: 'Sort order for displaying plans' })
	@IsOptional()
	@IsNumber({}, { message: 'Sort order must be a number' })
	@MultiORMColumn({ type: 'int', default: 0 })
	sortOrder?: number;

	/*
	 * Plugin relationship
	 */
	@ApiProperty({ type: String, description: 'Plugin ID' })
	@IsNotEmpty({ message: 'Plugin ID is required' })
	@IsUUID(4, { message: 'Plugin ID must be a valid UUID' })
	@RelationId((plan: PluginSubscriptionPlan) => plan.plugin)
	@MultiORMColumn({ type: 'uuid', nullable: false, relationId: true })
	pluginId: string;

	@MultiORMManyToOne(() => Plugin, (plugin) => plugin.subscriptionPlans, {
		onDelete: 'CASCADE',
		nullable: false,
		eager: false
	})
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Created by relationship
	 */
	@ApiPropertyOptional({ type: String, description: 'User who created this plan' })
	@IsOptional()
	@IsUUID(4, { message: 'Created by ID must be a valid UUID' })
	@RelationId((plan: PluginSubscriptionPlan) => plan.createdBy)
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	createdById?: string;

	@MultiORMManyToOne(() => User, {
		onDelete: 'SET NULL',
		nullable: true,
		eager: false
	})
	@JoinColumn()
	createdBy?: Relation<IUser>;

	/*
	 * Subscriptions using this plan
	 */
	@ApiPropertyOptional({ type: () => Array, description: 'Subscriptions using this plan' })
	@MultiORMOneToMany(() => PluginSubscription, (subscription) => subscription.plan, {
		onDelete: 'SET NULL'
	})
	subscriptions?: Relation<IPluginSubscription[]>;

	/*
	 * Computed properties and helper methods
	 */

	/**
	 * Check if the plan is free
	 */
	get isFree(): boolean {
		return this.type === PluginSubscriptionType.FREE || this.price === 0;
	}

	/**
	 * Check if the plan offers a trial
	 */
	get hasTrial(): boolean {
		return this.trialDays !== null && this.trialDays !== undefined && this.trialDays > 0;
	}

	/**
	 * Get the effective price (with discount applied)
	 */
	get effectivePrice(): number {
		if (!this.discountPercentage) {
			return this.price;
		}
		return this.price * (1 - this.discountPercentage / 100);
	}

	/**
	 * Get discount amount
	 */
	get discountAmount(): number {
		if (!this.discountPercentage) {
			return 0;
		}
		return this.price * (this.discountPercentage / 100);
	}

	/**
	 * Get total price including setup fee
	 */
	get totalPrice(): number {
		return this.effectivePrice + (this.setupFee || 0);
	}

	/**
	 * Check if plan has any limitations
	 */
	get hasLimitations(): boolean {
		return this.limitations && Object.keys(this.limitations).length > 0;
	}

	/**
	 * Get formatted price string
	 */
	getFormattedPrice(): string {
		return `${this.effectivePrice.toFixed(2)} ${this.currency}`;
	}

	/**
	 * Get billing period display text
	 */
	getBillingPeriodText(): string {
		const periodMap = {
			[PluginBillingPeriod.DAILY]: 'daily',
			[PluginBillingPeriod.WEEKLY]: 'weekly',
			[PluginBillingPeriod.MONTHLY]: 'monthly',
			[PluginBillingPeriod.QUARTERLY]: 'quarterly',
			[PluginBillingPeriod.YEARLY]: 'yearly',
			[PluginBillingPeriod.ONE_TIME]: 'one-time'
		};
		return periodMap[this.billingPeriod] || 'monthly';
	}
}

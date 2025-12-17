import { isMySQL, isPostgres } from '@gauzy/config';
import {
	CurrenciesEnum,
	IUser,
	PluginBillingPeriod,
	PluginSubscriptionType
} from '@gauzy/contracts';
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
import type { IPluginSubscription, IPluginSubscriptionPlan } from '../../shared/';
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
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
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
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
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
	@MultiORMColumn({ type: 'uuid', nullable: false, relationId: true })
	@RelationId((plan: PluginSubscriptionPlan) => plan.plugin)
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
	@MultiORMColumn({ type: 'uuid', nullable: true, relationId: true })
	@RelationId((plan: PluginSubscriptionPlan) => plan.createdBy)
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

	/*
	 * Static helper methods
	 */

	/**
	 * Create a new subscription plan instance
	 */
	static create(plan: Partial<IPluginSubscriptionPlan>): PluginSubscriptionPlan {
		// ---- 1. Validate required fields -----------------------------------------------------
		const name = plan.name?.trim();
		const pluginId = plan.pluginId?.trim();

		if (!name) {
			throw new Error('Plan name is required');
		}
		if (!pluginId) {
			throw new Error('Plugin ID is required');
		}

		// ---- 2. Normalize + resolve defaults -------------------------------------------------
		const normalized: Pick<
			IPluginSubscriptionPlan,
			| 'name'
			| 'pluginId'
			| 'type'
			| 'price'
			| 'currency'
			| 'billingPeriod'
			| 'isActive'
			| 'isPopular'
			| 'isRecommended'
			| 'sortOrder'
		> &
			Partial<IPluginSubscriptionPlan> = {
			// Required
			name,
			pluginId,

			// Defaults
			type: plan.type ?? PluginSubscriptionType.FREE,
			price: plan.price ?? 0,
			currency: plan.currency ?? CurrenciesEnum.USD,
			billingPeriod: plan.billingPeriod ?? PluginBillingPeriod.MONTHLY,
			isActive: plan.isActive ?? true,
			isPopular: plan.isPopular ?? false,
			isRecommended: plan.isRecommended ?? false,
			sortOrder: this.getSortOrderByType(plan.type),

			// Optionals (preserve null/undefined as given)
			description: plan.description,
			features: plan.features ?? [],
			limitations: plan.limitations,
			trialDays: plan.trialDays,
			setupFee: plan.setupFee,
			discountPercentage: plan.discountPercentage,
			metadata: plan.metadata,
			createdById: plan.createdById
		};

		// ---- 3. Validate pricing rules -------------------------------------------------------
		if (!this.validatePricing(normalized.price, normalized.billingPeriod, normalized.setupFee)) {
			throw new Error('Invalid pricing configuration');
		}

		// ---- 4. Create the instance (single source of truth) ---------------------------------
		return Object.assign(new PluginSubscriptionPlan(), normalized);
	}

	/**
	 * Create a free plan template
	 */
	static createFreePlan(pluginId: string, features: string[] = [], name = 'Free'): PluginSubscriptionPlan {
		return this.create({
			name,
			type: PluginSubscriptionType.FREE,
			price: 0,
			currency: CurrenciesEnum.USD,
			billingPeriod: PluginBillingPeriod.MONTHLY,
			features: features.length > 0 ? features : ['Basic features', 'Community support'],
			isActive: true,
			pluginId
		});
	}

	/**
	 * Create a basic plan template
	 */
	static createBasicPlan(
		pluginId: string,
		price: number,
		currency: string = CurrenciesEnum.USD,
		features: string[] = [],
		name = 'Basic'
	): PluginSubscriptionPlan {
		return this.create({
			name,
			type: PluginSubscriptionType.BASIC,
			price,
			currency,
			billingPeriod: PluginBillingPeriod.MONTHLY,
			features: features.length > 0 ? features : ['Standard features', 'Email support', 'Basic integrations'],
			isActive: true,
			pluginId
		});
	}

	/**
	 * Create a pro plan template
	 */
	static createProPlan(
		pluginId: string,
		price: number,
		currency: string = CurrenciesEnum.USD,
		features: string[] = [],
		name = 'Pro'
	): PluginSubscriptionPlan {
		return this.create({
			name,
			type: PluginSubscriptionType.PREMIUM,
			price,
			currency,
			billingPeriod: PluginBillingPeriod.MONTHLY,
			features:
				features.length > 0
					? features
					: [
							'All Basic features',
							'Advanced features',
							'Priority support',
							'Advanced integrations',
							'Custom workflows'
					  ],
			isActive: true,
			isPopular: true,
			pluginId
		});
	}

	/**
	 * Create an enterprise plan template
	 */
	static createEnterprisePlan(
		pluginId: string,
		price: number,
		currency: string = CurrenciesEnum.USD,
		features: string[] = [],
		name = 'Enterprise'
	): PluginSubscriptionPlan {
		return this.create({
			name,
			type: PluginSubscriptionType.ENTERPRISE,
			price,
			currency,
			billingPeriod: PluginBillingPeriod.YEARLY,
			features:
				features.length > 0
					? features
					: [
							'All Pro features',
							'Unlimited usage',
							'Dedicated support',
							'Custom development',
							'SLA guarantee',
							'On-premise deployment'
					  ],
			isActive: true,
			isRecommended: true,
			pluginId
		});
	}

	/**
	 * Calculate monthly equivalent price for any billing period
	 */
	static calculateMonthlyEquivalent(price: number, billingPeriod: PluginBillingPeriod): number {
		const daysInMonth = 30;
		const monthsInYear = 12;
		const monthsInQuarter = 3;
		const weeksInMonth = 4.33;

		switch (billingPeriod) {
			case PluginBillingPeriod.DAILY:
				return price * daysInMonth;
			case PluginBillingPeriod.WEEKLY:
				return price * weeksInMonth;
			case PluginBillingPeriod.MONTHLY:
				return price;
			case PluginBillingPeriod.QUARTERLY:
				return price / monthsInQuarter;
			case PluginBillingPeriod.YEARLY:
				return price / monthsInYear;
			case PluginBillingPeriod.ONE_TIME:
				return price; // One-time payments don't have a monthly equivalent
			default:
				return price;
		}
	}

	/**
	 * Compare plans by effective monthly price
	 */
	static comparePlans(plan1: IPluginSubscriptionPlan, plan2: IPluginSubscriptionPlan): number {
		const monthly1 = this.calculateMonthlyEquivalent(plan1.price, plan1.billingPeriod);
		const monthly2 = this.calculateMonthlyEquivalent(plan2.price, plan2.billingPeriod);
		return monthly1 - monthly2;
	}

	/**
	 * Sort plans by type order
	 */
	static getSortOrderByType(type: PluginSubscriptionType): number {
		const typeOrder = {
			[PluginSubscriptionType.FREE]: 0,
			[PluginSubscriptionType.BASIC]: 1,
			[PluginSubscriptionType.PREMIUM]: 2,
			[PluginSubscriptionType.ENTERPRISE]: 3,
			[PluginSubscriptionType.CUSTOM]: 4
		};
		return typeOrder[type] ?? 0;
	}

	/**
	 * Validate plan pricing
	 */
	static validatePricing(price: number, billingPeriod: PluginBillingPeriod, setupFee?: number): boolean {
		if (price < 0) return false;
		if (setupFee !== undefined && setupFee < 0) return false;

		// Additional business rules
		if (billingPeriod === PluginBillingPeriod.YEARLY && price < 1) {
			return false; // Yearly plans should have meaningful pricing
		}

		return true;
	}

	/**
	 * Check if a plan offers better value than another (based on monthly equivalent)
	 */
	static isBetterValue(plan1: IPluginSubscriptionPlan, plan2: IPluginSubscriptionPlan): boolean {
		const monthly1 = this.calculateMonthlyEquivalent(plan1.price, plan1.billingPeriod);
		const monthly2 = this.calculateMonthlyEquivalent(plan2.price, plan2.billingPeriod);

		// Better value if same or higher tier at lower monthly cost
		const typeOrder = {
			[PluginSubscriptionType.FREE]: 0,
			[PluginSubscriptionType.BASIC]: 1,
			[PluginSubscriptionType.PREMIUM]: 2,
			[PluginSubscriptionType.ENTERPRISE]: 3,
			[PluginSubscriptionType.CUSTOM]: 4
		};

		return (typeOrder[plan1.type] ?? 0) >= (typeOrder[plan2.type] ?? 0) && monthly1 < monthly2;
	}

	/**
	 * Calculate annual savings for yearly vs monthly billing
	 */
	static calculateAnnualSavings(yearlyPlan: IPluginSubscriptionPlan, monthlyPlan: IPluginSubscriptionPlan): number {
		if (yearlyPlan.billingPeriod !== PluginBillingPeriod.YEARLY) {
			throw new Error('First plan must be a yearly plan');
		}
		if (monthlyPlan.billingPeriod !== PluginBillingPeriod.MONTHLY) {
			throw new Error('Second plan must be a monthly plan');
		}

		const yearlyTotal = yearlyPlan.price;
		const monthlyAnnualTotal = monthlyPlan.price * 12;

		return monthlyAnnualTotal - yearlyTotal;
	}

	/**
	 * Calculate savings percentage for yearly vs monthly
	 */
	static calculateSavingsPercentage(
		yearlyPlan: IPluginSubscriptionPlan,
		monthlyPlan: IPluginSubscriptionPlan
	): number {
		const savings = this.calculateAnnualSavings(yearlyPlan, monthlyPlan);
		const monthlyAnnualTotal = monthlyPlan.price * 12;

		return monthlyAnnualTotal > 0 ? (savings / monthlyAnnualTotal) * 100 : 0;
	}

	/**
	 * Check if plan has a specific feature
	 */
	static hasFeature(plan: IPluginSubscriptionPlan, feature: string): boolean {
		return plan.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()));
	}

	/**
	 * Create a custom plan builder
	 */
	static builder(pluginId: string): PluginSubscriptionPlanBuilder {
		return new PluginSubscriptionPlanBuilder(pluginId);
	}
}

/**
 * Builder class for creating subscription plans
 */
export class PluginSubscriptionPlanBuilder {
	private plan: Partial<IPluginSubscriptionPlan>;

	constructor(pluginId: string) {
		this.plan = {
			pluginId,
			type: PluginSubscriptionType.BASIC,
			price: 0,
			currency: CurrenciesEnum.USD,
			billingPeriod: PluginBillingPeriod.MONTHLY,
			features: [],
			isActive: true,
			isPopular: false,
			isRecommended: false,
			sortOrder: 0
		};
	}

	withName(name: string): this {
		this.plan.name = name;
		return this;
	}

	withDescription(description: string): this {
		this.plan.description = description;
		return this;
	}

	withType(type: PluginSubscriptionType): this {
		this.plan.type = type;
		return this;
	}

	withPrice(price: number): this {
		this.plan.price = price;
		return this;
	}

	withCurrency(currency: string): this {
		this.plan.currency = currency;
		return this;
	}

	withBillingPeriod(period: PluginBillingPeriod): this {
		this.plan.billingPeriod = period;
		return this;
	}

	withFeatures(features: string[]): this {
		this.plan.features = features;
		return this;
	}

	addFeature(feature: string): this {
		if (!this.plan.features) {
			this.plan.features = [];
		}
		this.plan.features.push(feature);
		return this;
	}

	withLimitations(limitations: Record<string, any>): this {
		this.plan.limitations = limitations;
		return this;
	}

	withTrialDays(days: number): this {
		this.plan.trialDays = days;
		return this;
	}

	withSetupFee(fee: number): this {
		this.plan.setupFee = fee;
		return this;
	}

	withDiscount(percentage: number): this {
		this.plan.discountPercentage = percentage;
		return this;
	}

	asPopular(): this {
		this.plan.isPopular = true;
		return this;
	}

	asRecommended(): this {
		this.plan.isRecommended = true;
		return this;
	}

	withSortOrder(order: number): this {
		this.plan.sortOrder = order;
		return this;
	}

	withMetadata(metadata: Record<string, any>): this {
		this.plan.metadata = metadata;
		return this;
	}

	setActive(active: boolean): this {
		this.plan.isActive = active;
		return this;
	}

	build(): PluginSubscriptionPlan {
		return PluginSubscriptionPlan.create(this.plan);
	}
}

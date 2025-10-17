import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Min,
	ValidateIf
} from 'class-validator';
import { JoinColumn, Relation, RelationId } from 'typeorm';
import {
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	MultiORMOneToMany,
	TenantOrganizationBaseEntity,
	User
} from '@gauzy/core';
import { IUser } from '@gauzy/contracts';
import { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import { IPlugin } from '../../shared/models/plugin.model';
import { IPluginTenant } from '../../shared/models/plugin-tenant.model';
import {
	PluginSubscriptionStatus,
	PluginSubscriptionType,
	PluginBillingPeriod
} from '../../shared/models/plugin-subscription.model';
import { PluginScope } from '../../shared/models/plugin-scope.model';
import { Plugin } from './plugin.entity';
import { PluginTenant } from './plugin-tenant.entity';

@MultiORMEntity('plugin_subscriptions')
export class PluginSubscription extends TenantOrganizationBaseEntity implements IPluginSubscription {
	@ApiProperty({ enum: PluginSubscriptionStatus, description: 'Subscription status' })
	@IsEnum(PluginSubscriptionStatus, { message: 'Invalid subscription status' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSubscriptionStatus,
		default: PluginSubscriptionStatus.PENDING
	})
	status: PluginSubscriptionStatus;

	@ApiProperty({ enum: PluginSubscriptionType, description: 'Subscription type/plan' })
	@IsEnum(PluginSubscriptionType, { message: 'Invalid subscription type' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginSubscriptionType,
		default: PluginSubscriptionType.FREE
	})
	subscriptionType: PluginSubscriptionType;

	@ApiProperty({ enum: PluginScope, description: 'Subscription scope' })
	@IsEnum(PluginScope, { message: 'Invalid plugin scope' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginScope, default: PluginScope.TENANT })
	scope: PluginScope;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginBillingPeriod,
		default: PluginBillingPeriod.MONTHLY
	})
	billingPeriod: PluginBillingPeriod;

	@ApiProperty({ type: Number, description: 'Price per billing period' })
	@IsNumber({}, { message: 'Price must be a number' })
	@Min(0, { message: 'Price must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2, default: 0 })
	price: number;

	@ApiProperty({ type: String, description: 'Currency code' })
	@IsNotEmpty({ message: 'Currency is required' })
	@IsString({ message: 'Currency must be a string' })
	@MultiORMColumn({ default: 'USD' })
	currency: string;

	@ApiProperty({ type: Date, description: 'Start date of subscription' })
	@IsDate({ message: 'Start date must be a valid date' })
	@MultiORMColumn()
	startDate: Date;

	@ApiPropertyOptional({ type: Date, description: 'End date of subscription' })
	@IsOptional()
	@IsDate({ message: 'End date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ type: Date, description: 'Next billing date' })
	@IsOptional()
	@IsDate({ message: 'Next billing date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	nextBillingDate?: Date;

	@ApiPropertyOptional({ type: Date, description: 'Trial end date' })
	@IsOptional()
	@IsDate({ message: 'Trial end date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	trialEndDate?: Date;

	@ApiProperty({ type: Boolean, description: 'Whether auto-renewal is enabled' })
	@IsBoolean({ message: 'autoRenew must be a boolean' })
	@MultiORMColumn({ type: 'boolean', default: true })
	autoRenew: boolean;

	@ApiPropertyOptional({ type: Date, description: 'Cancellation date' })
	@IsOptional()
	@IsDate({ message: 'Cancelled date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	cancelledAt?: Date;

	@ApiPropertyOptional({ type: String, description: 'Cancellation reason' })
	@IsOptional()
	@IsString({ message: 'Cancellation reason must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	cancellationReason?: string;

	@ApiPropertyOptional({ type: String, description: 'Subscription metadata (JSON string)' })
	@IsOptional()
	@IsString({ message: 'Metadata must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	metadata?: string;

	/*
	 * Plugin relationship
	 */
	@MultiORMColumn({ type: 'uuid' })
	@RelationId((pluginSubscription: PluginSubscription) => pluginSubscription.plugin)
	pluginId: string;

	@MultiORMManyToOne(() => Plugin, { onDelete: 'CASCADE' })
	@JoinColumn()
	plugin: Relation<IPlugin>;

	/*
	 * Plugin Tenant relationship
	 */
	@MultiORMColumn({ type: 'uuid' })
	@RelationId((pluginSubscription: PluginSubscription) => pluginSubscription.pluginTenant)
	pluginTenantId: string;

	@MultiORMManyToOne(() => PluginTenant, { onDelete: 'CASCADE' })
	@JoinColumn()
	pluginTenant: Relation<IPluginTenant>;

	/*
	 * Subscriber (User) relationship - optional for user-level subscriptions
	 */
	@ApiPropertyOptional({ type: String, description: 'Subscriber user ID' })
	@IsOptional()
	@IsUUID()
	@ValidateIf((object, value) => value !== null)
	@MultiORMColumn({ type: 'uuid', nullable: true })
	@RelationId((pluginSubscription: PluginSubscription) => pluginSubscription.subscriber)
	subscriberId?: string;

	@MultiORMManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
	@JoinColumn()
	subscriber?: Relation<IUser>;

	/*
	 * Payment relationships - will be added when Payment entity is available
	 * @MultiORMOneToMany(() => Payment, (payment) => payment.pluginSubscription, { onDelete: 'SET NULL' })
	 * payments?: IPayment[];
	 */
}

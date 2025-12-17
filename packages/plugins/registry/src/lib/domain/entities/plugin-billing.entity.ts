import { isMySQL, isPostgres } from '@gauzy/config';
import { ID, PluginBillingPeriod, PluginBillingStatus } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JoinColumn, Relation, RelationId } from 'typeorm';
import { IPluginBilling } from '../../shared/models/plugin-billing.model';
import { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import { PluginSubscription } from './plugin-subscription.entity';

@MultiORMEntity('plugin_billings')
export class PluginBilling extends TenantOrganizationBaseEntity implements IPluginBilling {
	@ApiProperty({ type: Number, description: 'Billing amount' })
	@IsNumber({}, { message: 'Amount must be a number' })
	@Min(0, { message: 'Amount must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2 })
	amount: number;

	@ApiProperty({ type: String, description: 'Currency code' })
	@IsNotEmpty({ message: 'Currency is required' })
	@IsString({ message: 'Currency must be a string' })
	@MultiORMColumn({ default: 'USD' })
	currency: string;

	@ApiProperty({ type: Date, description: 'Billing date' })
	@IsDate({ message: 'Billing date must be a valid date' })
	@MultiORMColumn()
	billingDate: Date;

	@ApiProperty({ type: Date, description: 'Due date for payment' })
	@IsDate({ message: 'Due date must be a valid date' })
	@MultiORMColumn()
	dueDate: Date;

	@ApiProperty({ enum: PluginBillingStatus, description: 'Billing status' })
	@IsEnum(PluginBillingStatus, { message: 'Invalid billing status' })
	@MultiORMColumn({
		type: 'simple-enum',
		enum: PluginBillingStatus,
		default: PluginBillingStatus.PENDING
	})
	status: PluginBillingStatus;

	@ApiProperty({ enum: PluginBillingPeriod, description: 'Billing period' })
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	@MultiORMColumn({ type: 'simple-enum', enum: PluginBillingPeriod })
	billingPeriod: PluginBillingPeriod;

	@ApiProperty({ type: Date, description: 'Billing period start date' })
	@IsDate({ message: 'Billing period start must be a valid date' })
	@MultiORMColumn()
	billingPeriodStart: Date;

	@ApiProperty({ type: Date, description: 'Billing period end date' })
	@IsDate({ message: 'Billing period end must be a valid date' })
	@MultiORMColumn()
	billingPeriodEnd: Date;

	@ApiPropertyOptional({ type: String, description: 'Billing description/notes' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: Object, description: 'Billing metadata' })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	metadata?: Record<string, any>;

	/*
	 * Plugin Subscription relationship
	 */
	@ApiProperty({ type: String, description: 'Associated subscription ID' })
	@IsUUID(4, { message: 'Subscription ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid', relationId: true })
	@RelationId((billing: PluginBilling) => billing.subscription)
	subscriptionId: ID;

	@MultiORMManyToOne(() => PluginSubscription, (subscription) => subscription.billings, { onDelete: 'CASCADE' })
	@JoinColumn()
	subscription: Relation<IPluginSubscription>;

	/*
	 * Computed properties and helper methods
	 */

	/**
	 * Check if billing is overdue
	 */
	get isOverdue(): boolean {
		return this.status === PluginBillingStatus.PENDING && this.dueDate < new Date();
	}

	/**
	 * Check if billing is pending
	 */
	get isPending(): boolean {
		return this.status === PluginBillingStatus.PENDING;
	}

	/**
	 * Get days until due date
	 */
	get daysUntilDue(): number {
		const now = new Date();
		const timeDiff = this.dueDate.getTime() - now.getTime();
		return Math.ceil(timeDiff / (1000 * 3600 * 24));
	}
}

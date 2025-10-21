import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';
import { JoinColumn, Relation, RelationId } from 'typeorm';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { IPluginBilling, PluginBillingStatus } from '../../shared/models/plugin-billing.model';
import { IPluginSubscription, PluginBillingPeriod } from '../../shared/models/plugin-subscription.model';
import { PluginSubscription } from './plugin-subscription.entity';
import { ID } from '@gauzy/contracts';

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

	@ApiPropertyOptional({ type: Date, description: 'Payment due date' })
	@IsOptional()
	@IsDate({ message: 'Payment due date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	paymentDueDate?: Date;

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

	@ApiPropertyOptional({ type: String, description: 'Invoice number' })
	@IsOptional()
	@IsString({ message: 'Invoice number must be a string' })
	@MultiORMColumn({ nullable: true })
	invoiceNumber?: string;

	@ApiPropertyOptional({ type: String, description: 'Invoice URL' })
	@IsOptional()
	@IsString({ message: 'Invoice URL must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	invoiceUrl?: string;

	@ApiPropertyOptional({ type: Number, description: 'Tax amount' })
	@IsOptional()
	@IsNumber({}, { message: 'Tax amount must be a number' })
	@Min(0, { message: 'Tax amount must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2, nullable: true })
	taxAmount?: number;

	@ApiPropertyOptional({ type: Number, description: 'Tax rate' })
	@IsOptional()
	@IsNumber({}, { message: 'Tax rate must be a number' })
	@Min(0, { message: 'Tax rate must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'decimal', precision: 5, scale: 4, nullable: true })
	taxRate?: number;

	@ApiPropertyOptional({ type: Number, description: 'Discount amount' })
	@IsOptional()
	@IsNumber({}, { message: 'Discount amount must be a number' })
	@Min(0, { message: 'Discount amount must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2, nullable: true })
	discountAmount?: number;

	@ApiPropertyOptional({ type: String, description: 'Discount code' })
	@IsOptional()
	@IsString({ message: 'Discount code must be a string' })
	@MultiORMColumn({ nullable: true })
	discountCode?: string;

	@ApiProperty({ type: Number, description: 'Total amount (amount + tax - discount)' })
	@IsNumber({}, { message: 'Total amount must be a number' })
	@Min(0, { message: 'Total amount must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'decimal', precision: 10, scale: 2 })
	totalAmount: number;

	@ApiPropertyOptional({ type: String, description: 'Billing description/notes' })
	@IsOptional()
	@IsString({ message: 'Description must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	description?: string;

	@ApiPropertyOptional({ type: String, description: 'Payment reference' })
	@IsOptional()
	@IsString({ message: 'Payment reference must be a string' })
	@MultiORMColumn({ nullable: true })
	paymentReference?: string;

	@ApiPropertyOptional({ type: String, description: 'Billing metadata (JSON string)' })
	@IsOptional()
	@IsString({ message: 'Metadata must be a string' })
	@MultiORMColumn({ type: 'text', nullable: true })
	metadata?: string;

	@ApiPropertyOptional({ type: Number, description: 'Retry count for failed billings' })
	@IsOptional()
	@IsNumber({}, { message: 'Retry count must be a number' })
	@Min(0, { message: 'Retry count must be greater than or equal to 0' })
	@MultiORMColumn({ type: 'int', default: 0, nullable: true })
	retryCount?: number;

	@ApiPropertyOptional({ type: Date, description: 'Last retry attempt date' })
	@IsOptional()
	@IsDate({ message: 'Last retry date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	lastRetryAt?: Date;

	@ApiPropertyOptional({ type: Date, description: 'Next retry attempt date' })
	@IsOptional()
	@IsDate({ message: 'Next retry date must be a valid date' })
	@MultiORMColumn({ nullable: true })
	nextRetryAt?: Date;

	/*
	 * Plugin Subscription relationship
	 */
	@ApiProperty({ type: String, description: 'Associated subscription ID' })
	@IsUUID(4, { message: 'Subscription ID must be a valid UUID' })
	@MultiORMColumn({ type: 'uuid' })
	@RelationId((pluginBilling: PluginBilling) => pluginBilling.subscription)
	subscriptionId: ID;

	@MultiORMManyToOne(() => PluginSubscription, (subscription) => subscription.billings, { onDelete: 'CASCADE' })
	@JoinColumn()
	subscription: Relation<IPluginSubscription>;
}

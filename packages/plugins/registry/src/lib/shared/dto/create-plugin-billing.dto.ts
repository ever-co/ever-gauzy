import { PluginBillingPeriod, PluginBillingStatus } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { IPluginBillingCreateInput } from '../models';

export class CreatePluginBillingDTO implements IPluginBillingCreateInput {
	@ApiProperty({
		description: 'Associated subscription ID',
		example: 'uuid-string'
	})
	@IsUUID(4, { message: 'Subscription ID must be a valid UUID' })
	readonly subscriptionId: string;

	@ApiProperty({
		description: 'Billing amount',
		example: 99.99,
		minimum: 0
	})
	@Type(() => Number)
	@IsNumber({}, { message: 'Amount must be a valid number' })
	@Min(0, { message: 'Amount must be greater than or equal to 0' })
	readonly amount: number;

	@ApiProperty({
		description: 'Currency code',
		example: 'USD',
		default: 'USD'
	})
	@IsString()
	@IsNotEmpty({ message: 'Currency is required' })
	readonly currency: string;

	@ApiProperty({
		description: 'Billing date',
		example: '2025-01-01T00:00:00Z'
	})
	@Type(() => Date)
	@IsDate({ message: 'Billing date must be a valid date' })
	readonly billingDate: Date;

	@ApiProperty({
		description: 'Due date for payment',
		example: '2025-01-15T00:00:00Z'
	})
	@Type(() => Date)
	@IsDate({ message: 'Due date must be a valid date' })
	readonly dueDate: Date;

	@ApiPropertyOptional({
		description: 'Payment due date',
		example: '2025-01-30T00:00:00Z'
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate({ message: 'Payment due date must be a valid date' })
	readonly paymentDueDate?: Date;

	@ApiProperty({
		enum: PluginBillingStatus,
		description: 'Billing status',
		default: PluginBillingStatus.PENDING
	})
	@IsEnum(PluginBillingStatus, { message: 'Invalid billing status' })
	readonly status: PluginBillingStatus;

	@ApiProperty({
		enum: PluginBillingPeriod,
		description: 'Billing period',
		example: PluginBillingPeriod.MONTHLY
	})
	@IsEnum(PluginBillingPeriod, { message: 'Invalid billing period' })
	readonly billingPeriod: PluginBillingPeriod;

	@ApiProperty({
		description: 'Billing period start date',
		example: '2025-01-01T00:00:00Z'
	})
	@Type(() => Date)
	@IsDate({ message: 'Billing period start must be a valid date' })
	readonly billingPeriodStart: Date;

	@ApiProperty({
		description: 'Billing period end date',
		example: '2025-01-31T23:59:59Z'
	})
	@Type(() => Date)
	@IsDate({ message: 'Billing period end must be a valid date' })
	readonly billingPeriodEnd: Date;

	@ApiPropertyOptional({
		description: 'Invoice number',
		example: 'INV-202501-0001'
	})
	@IsOptional()
	@IsString()
	readonly invoiceNumber?: string;

	@ApiPropertyOptional({
		description: 'Invoice URL',
		example: 'https://example.com/invoices/inv-123'
	})
	@IsOptional()
	@IsString()
	readonly invoiceUrl?: string;

	@ApiPropertyOptional({
		description: 'Tax amount',
		example: 9.99,
		minimum: 0
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Tax amount must be a valid number' })
	@Min(0, { message: 'Tax amount must be greater than or equal to 0' })
	readonly taxAmount?: number;

	@ApiPropertyOptional({
		description: 'Tax rate (as decimal)',
		example: 0.1,
		minimum: 0,
		maximum: 1
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Tax rate must be a valid number' })
	@Min(0, { message: 'Tax rate must be greater than or equal to 0' })
	@Max(1, { message: 'Tax rate must be less than or equal to 1' })
	readonly taxRate?: number;

	@ApiPropertyOptional({
		description: 'Discount amount',
		example: 5.0,
		minimum: 0
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber({}, { message: 'Discount amount must be a valid number' })
	@Min(0, { message: 'Discount amount must be greater than or equal to 0' })
	readonly discountAmount?: number;

	@ApiPropertyOptional({
		description: 'Discount code',
		example: 'SAVE10'
	})
	@IsOptional()
	@IsString()
	readonly discountCode?: string;

	@ApiPropertyOptional({
		description: 'Billing description/notes',
		example: 'Monthly subscription fee for Premium plan'
	})
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({
		description: 'Payment reference',
		example: 'PAY_12345'
	})
	@IsOptional()
	@IsString()
	readonly paymentReference?: string;

	@ApiPropertyOptional({
		description: 'Billing metadata',
		example: { source: 'automated', campaign: 'summer2025' }
	})
	@IsOptional()
	readonly metadata?: Record<string, any>;

	@ApiProperty({
		description: 'Tenant ID',
		example: 'uuid-string'
	})
	@IsUUID(4, { message: 'Tenant ID must be a valid UUID' })
	readonly tenantId: string;

	@ApiPropertyOptional({
		description: 'Organization ID',
		example: 'uuid-string'
	})
	@IsOptional()
	@IsUUID(4, { message: 'Organization ID must be a valid UUID' })
	readonly organizationId?: string;
}

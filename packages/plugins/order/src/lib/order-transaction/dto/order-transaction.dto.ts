import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { OrderTransactionType } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of an order transaction.
 *
 * A row of this ledger is written by the flow that owns the money — a capture, a refund, a credit line,
 * an operator's manual movement — and never edited afterwards. A reversal is a new row of the opposite
 * type, which is what keeps the ledger reconcilable.
 */
export class OrderTransactionDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	readonly amount: number;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(3)
	readonly currency: string;

	@ApiProperty({ type: () => String, enum: OrderTransactionType })
	@IsEnum(OrderTransactionType)
	readonly type: OrderTransactionType;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly referenceType: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly referenceId: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly description: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

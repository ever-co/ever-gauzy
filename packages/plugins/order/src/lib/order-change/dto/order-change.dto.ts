import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrderChangeActionType, OrderChangeType } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * One action of a change, as a caller states it.
 *
 * `ordering` is assigned by the service from the order the actions are submitted in, so a caller
 * cannot make the application order disagree with the list it sent.
 */
export class OrderChangeActionInputDTO {
	@ApiProperty({ type: () => String, enum: OrderChangeActionType })
	@IsEnum(OrderChangeActionType)
	readonly action: OrderChangeActionType;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly details: Record<string, unknown>;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	readonly amount: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly referenceType: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly referenceId: string;
}

/**
 * The writable surface of an order change.
 *
 * The status is absent: a change is created `PENDING` and moves through confirm, decline or cancel.
 * That is what makes the exclusivity rule expressible — the slot is held while the change is in a
 * non-terminal status, and released when it reaches a terminal one.
 */
export class OrderChangeDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	@ApiProperty({ type: () => String, enum: OrderChangeType })
	@IsEnum(OrderChangeType)
	readonly changeType: OrderChangeType;

	@ApiPropertyOptional({ type: () => [OrderChangeActionInputDTO] })
	@IsOptional()
	@IsArray()
	readonly actions: OrderChangeActionInputDTO[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly requireApproval: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly version: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

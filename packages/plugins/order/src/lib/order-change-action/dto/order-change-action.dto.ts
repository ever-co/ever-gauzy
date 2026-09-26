import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrderChangeActionType } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of one action inside a change.
 *
 * `applied` and `appliedAt` are absent: they are written by the apply step, and `applied = true` always
 * implies `appliedAt` is set rather than being two facts a caller could contradict.
 */
export class OrderChangeActionDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly changeId: string;

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

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	readonly ordering: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly applied: boolean;
}

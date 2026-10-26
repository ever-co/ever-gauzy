import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * The writable surface of an order timeline entry.
 *
 * A history row is written by the order's own subscribers, never by a controller, so that every state
 * transition produces an entry regardless of which surface caused it. This DTO exists for reads and
 * for the `NOTE_ADD` action, which is the one entry a person writes deliberately.
 */
export class OrderHistoryDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderId: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@MaxLength(64)
	readonly action: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly title: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description: string;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata: Record<string, unknown>;
}

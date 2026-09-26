import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * A governed return reason as a caller sees it.
 */
export class OrderReturnReasonDTO extends TenantOrganizationBaseDTO {
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	readonly code?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly label?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly parentId?: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	readonly isActive?: boolean;
}

/**
 * A reason created by an operator. The code is the tenant's own key and is required, because a reason
 * without a stable code cannot be reported on.
 */
export class CreateOrderReturnReasonDTO extends OrderReturnReasonDTO {
	@ApiProperty({ type: () => String, maxLength: 64 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(64)
	readonly code: string;

	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly label: string;
}

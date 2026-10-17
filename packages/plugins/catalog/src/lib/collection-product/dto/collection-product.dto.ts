import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Collection product membership request DTO validation.
 */
export class CollectionProductDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly collectionId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly productId: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly position?: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly addedAt?: Date;
}

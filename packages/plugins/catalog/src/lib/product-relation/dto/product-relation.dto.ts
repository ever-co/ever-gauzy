import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { ProductRelationType } from '../../catalog.types';

/**
 * Product relation request DTO validation.
 */
export class ProductRelationDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly productId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly relatedProductId: string;

	@ApiProperty({ type: () => String, enum: ProductRelationType })
	@IsEnum(ProductRelationType)
	readonly type: ProductRelationType;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly position?: number;
}

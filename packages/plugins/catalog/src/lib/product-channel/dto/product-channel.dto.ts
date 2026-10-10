import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PublicationStatus } from '../../catalog.types';

/**
 * Product publication request DTO validation.
 */
export class ProductChannelDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly productId: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly channelId: string;

	@ApiProperty({ type: () => String, enum: PublicationStatus })
	@IsEnum(PublicationStatus)
	readonly status: PublicationStatus;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly publishedAt?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	readonly unpublishedAt?: Date;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@Min(0)
	readonly sortOrder?: number;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isFeatured?: boolean;
}

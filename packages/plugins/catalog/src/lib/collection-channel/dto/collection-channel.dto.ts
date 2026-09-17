import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PublicationStatus } from '../../catalog.types';

/**
 * Collection channel publication request DTO validation.
 */
export class CollectionChannelDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly collectionId: string;

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
}

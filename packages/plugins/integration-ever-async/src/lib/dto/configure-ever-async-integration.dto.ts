import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsNotEmpty,
	ValidateIf,
	IsString,
	IsUrl,
	IsUUID,
	ValidateNested
} from 'class-validator';
import { EverAsyncUserMappingDto } from './ever-async-user-mapping.dto';

export class ConfigureEverAsyncIntegrationDto {
	@ApiProperty({ description: 'Public HTTPS URL of the Ever Async server', example: 'https://api-async.ever.co' })
	@IsNotEmpty()
	@IsString()
	@IsUrl({ protocols: ['https'], require_protocol: true })
	readonly serverUrl!: string;

	@ApiPropertyOptional({ type: [EverAsyncUserMappingDto] })
	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(1000)
	@ValidateNested({ each: true })
	@Type(() => EverAsyncUserMappingDto)
	readonly userMappings?: EverAsyncUserMappingDto[];

	@ApiPropertyOptional({ description: 'Projects whose tasks may be read. Empty means no tasks.', type: [String] })
	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(1000)
	@ArrayUnique()
	@IsUUID('all', { each: true })
	readonly projectIds?: string[];
}

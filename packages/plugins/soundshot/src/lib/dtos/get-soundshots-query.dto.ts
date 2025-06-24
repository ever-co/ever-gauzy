import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { FindOptionsWhere } from 'typeorm';
import { ISoundshot } from '../models/soundshot.model';

export class GetSoundshotsQueryDTO extends OmitType(BaseQueryDTO<ISoundshot>, ['where']) {
	@ApiPropertyOptional({
		description: 'The start date for filtering soundshot records.',
		type: 'string',
		format: 'date-time',
		nullable: true
	})
	@IsOptional()
	@IsISO8601({ strict: true }, { message: 'startDate must be a valid ISO 8601 date string' })
	@Type(() => Date)
	startDate?: Date | string;

	@ApiPropertyOptional({
		description: 'The end date for filtering soundshot records.',
		type: 'string',
		format: 'date-time',
		nullable: true
	})
	@IsOptional()
	@IsISO8601({ strict: true }, { message: 'endDate must be a valid ISO 8601 date string' })
	@Type(() => Date)
	endDate?: Date | string;

	@ApiPropertyOptional({
		description: 'The ID of the tenant.',
		type: String
	})
	@IsOptional()
	@IsUUID('4', { message: 'tenantId must be a valid UUID' })
	tenantId?: ID;

	@ApiPropertyOptional({
		description: 'The ID of the organization within the tenant.',
		type: String
	})
	@IsOptional()
	@IsUUID('4', { message: 'organizationId must be a valid UUID' })
	organizationId?: ID;

	@ApiPropertyOptional({
		description: 'List of employee IDs to filter soundshots by.',
		type: [String]
	})
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true, message: 'Each employeeId must be a valid UUID' })
	employeeIds?: ID[];

	@ApiPropertyOptional({
		description: 'The timezone for date filtering, e.g., "UTC", "America/New_York".',
		type: String
	})
	@IsOptional()
	@IsString({ message: 'timeZone must be a string' })
	timeZone?: string;

	@IsOptional()
	readonly where?: FindOptionsWhere<ISoundshot>;
}

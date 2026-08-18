import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployeePresetInput, JobPostSourceEnum } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * POST /job-preset/employee body.
 *
 * `employeeId` MUST be a real UUID: the handler deletes the employee's existing search criteria by
 * `{ employeeId }`, and a missing / null value used to be dropped from the SQL, turning that into an
 * unfiltered DELETE across every tenant (GHSA-44pv-34gx-q9p4 class).
 */
export class SaveEmployeePresetDTO extends TenantOrganizationBaseDTO implements IEmployeePresetInput {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly employeeId: ID;

	@ApiProperty({ type: () => Array, isArray: true })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID('all', { each: true })
	readonly jobPresetIds: ID[];

	@ApiPropertyOptional({ type: () => String, enum: JobPostSourceEnum })
	@IsOptional()
	@IsEnum(JobPostSourceEnum)
	readonly source?: JobPostSourceEnum;
}

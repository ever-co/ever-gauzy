import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { IProcessTrackingDataInput, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';

/**
 * DTO for processing custom tracking data
 */
export class ProcessTrackingDataDTO extends TenantOrganizationBaseDTO implements IProcessTrackingDataInput {
	@ApiProperty({
		type: String,
		description: 'Encoded tracking data payload'
	})
	@IsString()
	readonly payload: string;

	@ApiPropertyOptional({
		type: String,
		format: 'date-time',
		description: 'Start time for the tracking data. If not provided, current time will be used.'
	})
	@IsOptional()
	@Transform(({ value }) => (value ? new Date(value) : undefined))
	readonly startTime?: Date;

	@ApiPropertyOptional({
		type: String,
		description: 'Employee ID. If not provided, current user employee ID will be used.'
	})
	@IsOptional()
	@IsUUID()
	readonly employeeId?: ID;
}

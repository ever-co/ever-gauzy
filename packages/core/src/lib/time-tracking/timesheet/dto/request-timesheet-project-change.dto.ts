import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { ID, IRequestTimesheetProjectChange } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

/**
 * Payload an employee sends to ask for the time logged against `previousProjectId`
 * in `timesheetId` to be moved to `requestedProjectId`.
 */
export class RequestTimesheetProjectChangeDTO
	extends TenantOrganizationBaseDTO
	implements IRequestTimesheetProjectChange
{
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly timesheetId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly requestedProjectId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly previousProjectId: ID;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@Transform(({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value))
	@IsNotEmpty()
	@IsString()
	@MinLength(3)
	@MaxLength(500)
	readonly reason: string;
}

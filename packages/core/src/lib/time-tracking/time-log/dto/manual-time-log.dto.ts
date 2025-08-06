import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IEmployee, IManualTimeInput, TimeLogPartialStatus } from '@gauzy/contracts';
import { IsBeforeDate } from './../../../shared/validators';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

/**
 * Data transfer object for creating or updating ManualTimeLog entities.
 */
export class ManualTimeLogDTO extends TenantOrganizationBaseDTO implements IManualTimeInput {
	/**
	 * The start date and time of the manual time log.
	 */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty({ message: 'Started date should not be empty' })
	@IsBeforeDate(ManualTimeLogDTO, (it) => it.stoppedAt, {
		message: 'Started date must be before stopped date'
	})
	startedAt: Date;

	/**
	 * The end date and time of the manual time log.
	 */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty({ message: 'Stopped date should not be empty' })
	stoppedAt: Date;

	/**
	 * Time zone in IANA format (e.g., 'Europe/Warsaw')
	 */
	@ApiPropertyOptional({ example: 'Europe/Warsaw' })
	@IsOptional()
	@IsString()
	readonly timeZone?: string;

	/**
	 * The ID of the employee associated with the manual time log.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	employeeId: IEmployee['id'];

	@ApiProperty({ type: () => Number })
	@IsEnum(TimeLogPartialStatus)
	@IsNotEmpty()
	readonly partialStatus: TimeLogPartialStatus;

	@ApiProperty({ type: () => Date })
	@IsDateString()
	@IsNotEmpty()
	readonly referenceDate: Date;
}

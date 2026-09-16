import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';
import { IUpdateTimesheetProjectChangeStatus, TimesheetProjectChangeStatus } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

/**
 * Payload an approver sends to approve or reject a pending project change request.
 *
 * `PENDING` is deliberately NOT accepted — a review always moves the request out of
 * the pending state.
 */
export class ReviewTimesheetProjectChangeDTO
	extends TenantOrganizationBaseDTO
	implements IUpdateTimesheetProjectChangeStatus
{
	@ApiProperty({ enum: [TimesheetProjectChangeStatus.APPROVED, TimesheetProjectChangeStatus.REJECTED] })
	@IsIn([TimesheetProjectChangeStatus.APPROVED, TimesheetProjectChangeStatus.REJECTED])
	readonly status: TimesheetProjectChangeStatus.APPROVED | TimesheetProjectChangeStatus.REJECTED;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@Transform(({ value }: TransformFnParams) => (typeof value === 'string' ? value.trim() : value))
	@IsOptional()
	@IsString()
	@MaxLength(500)
	readonly reviewNote?: string;
}

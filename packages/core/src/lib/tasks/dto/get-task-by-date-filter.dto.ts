import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, Matches, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ITaskDateFilterInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { IsBeforeDate } from './../../shared/validators';

export class TaskDateFilterInputDTO extends TenantOrganizationBaseDTO implements ITaskDateFilterInput {
	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@IsBeforeDate(TaskDateFilterInputDTO, (it) => it.startDateTo, {
		message: 'Start date from must be before the start date to'
	})
	startDateFrom?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@ValidateIf((o) => o.startDateFrom != null)
	startDateTo?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@IsBeforeDate(TaskDateFilterInputDTO, (it) => it.dueDateTo, {
		message: 'Due date from must be before the due date to'
	})
	dueDateFrom?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@ValidateIf((o) => o.dueDateFrom != null)
	dueDateTo?: Date;

	@ApiPropertyOptional({
		type: () => String,
		example: '2026-11-18',
		description:
			'The calendar day startDateFrom starts in the reader’s zone: a date-only start date is compared with it.'
	})
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	startDateFromDay?: string;

	@ApiPropertyOptional({
		type: () => String,
		example: '2026-11-18',
		description:
			'The calendar day startDateTo ends in the reader’s zone: a date-only start date is compared with it.'
	})
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	startDateToDay?: string;

	@ApiPropertyOptional({
		type: () => String,
		example: '2026-11-18',
		description:
			'The calendar day dueDateFrom starts in the reader’s zone: a date-only due date is compared with it.'
	})
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	dueDateFromDay?: string;

	@ApiPropertyOptional({
		type: () => String,
		example: '2026-11-18',
		description: 'The calendar day dueDateTo ends in the reader’s zone: a date-only due date is compared with it.'
	})
	@IsOptional()
	@Matches(/^\d{4}-\d{2}-\d{2}$/)
	dueDateToDay?: string;
}

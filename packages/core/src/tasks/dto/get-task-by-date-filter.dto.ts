import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, ValidateIf } from 'class-validator';
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
}

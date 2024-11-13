import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ITaskDateFilterInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export class TaskDateFilterInputDTO extends TenantOrganizationBaseDTO implements ITaskDateFilterInput {
	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
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
	dueDateFrom?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@ValidateIf((o) => o.dueDateFrom != null)
	dueDateTo?: Date;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EmployeeKindEnum } from '@gauzy/contracts';
import { BaseQueryDTO } from '../../core/crud';
import { Employee } from '../employee.entity';

/**
 * Query of `GET /employee`: the shared find options, plus `kind` to list only people (`human`) or only
 * agents (`agent`). Without `kind` the list is what it always was.
 */
export class EmployeeListQueryDTO extends BaseQueryDTO<Employee> {
	@ApiPropertyOptional({ type: () => String, enum: EmployeeKindEnum })
	@IsOptional()
	@IsEnum(EmployeeKindEnum)
	readonly kind?: EmployeeKindEnum;
}

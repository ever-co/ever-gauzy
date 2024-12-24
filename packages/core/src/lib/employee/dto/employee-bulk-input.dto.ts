import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateEmployeeDTO } from './create-employee.dto';

export class EmployeeBulkInputDTO {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateEmployeeDTO)
	list: CreateEmployeeDTO[];
}

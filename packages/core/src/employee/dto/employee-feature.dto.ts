import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsString, ValidateIf } from 'class-validator';
import { ID, IEmployee, IRelationalEmployee } from '@gauzy/contracts';
import { Employee } from './../employee.entity';
import { IsEmployeeBelongsToOrganization } from './../../shared/validators';

export class EmployeeFeatureDTO implements IRelationalEmployee {
	@ApiPropertyOptional({ type: () => Employee })
	@ValidateIf((it) => !it.employeeId || it.employee)
	@IsObject()
	@IsEmployeeBelongsToOrganization()
	readonly employee: IEmployee;

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => !it.employee || it.employeeId)
	@IsString()
	@IsEmployeeBelongsToOrganization()
	readonly employeeId: ID;
}

import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { IEmployeeAward } from '@gauzy/models';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('employee_award')
export class EmployeeAward extends TenantOrganizationBase
	implements IEmployeeAward {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	year: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	employeeId: string;

	@ManyToOne((type) => Employee, (employee) => employee.id)
	employee: Employee;
}

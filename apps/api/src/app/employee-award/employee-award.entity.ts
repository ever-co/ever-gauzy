import { Column, Entity, Index, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { IEmployeeAward } from '@gauzy/models';
import { TenantBase } from '../core/entities/tenant-base';

@Entity('employee_award')
export class EmployeeAward extends TenantBase implements IEmployeeAward {
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

	@ApiProperty({ type: String })
	@Column()
	organization: string;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((employeeAward: EmployeeAward) => employeeAward.organization)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}

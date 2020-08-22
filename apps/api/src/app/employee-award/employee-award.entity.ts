import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { Employee } from '../employee/employee.entity';
import { IEmployeeAward } from '@gauzy/models';

@Entity('employee_award')
export class EmployeeAward extends Base implements IEmployeeAward {
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

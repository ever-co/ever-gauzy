import { EmployeeAppointment as IEmployeeAppointment } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDate } from 'class-validator';
import { Column, Entity, OneToMany } from 'typeorm';
import { Base } from '../core/entities/base';
import { Employee } from '../employee/employee.entity';
import { AppointmentEmployees } from '../appointment-employees/appointment-employees.entity';

@Entity('employee_appointment')
export class EmployeeAppointment extends Base implements IEmployeeAppointment {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	agenda: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	location?: string;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	startDateTime: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	endDateTime: Date;

	@ApiProperty({ type: Employee })
	@OneToMany(
		(type) => AppointmentEmployees,
		(entity) => entity.employeeId
	)
	invitees: Employee[];
}

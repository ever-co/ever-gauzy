import { EmployeeAppointment as IEmployeeAppointment } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsDate,
	IsBoolean,
	IsNumber
} from 'class-validator';
import {
	Column,
	Entity,
	OneToMany,
	JoinColumn,
	ManyToOne,
	RelationId
} from 'typeorm';
import { Base } from '../core/entities/base';
import { AppointmentEmployees } from '../appointment-employees/appointment-employees.entity';
import { Employee } from '../employee/employee.entity';

@Entity('employee_appointment')
export class EmployeeAppointment extends Base implements IEmployeeAppointment {
	@ApiProperty({ type: Employee })
	@ManyToOne((type) => Employee, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	employee?: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(employeeAppointment: EmployeeAppointment) =>
			employeeAppointment.employee
	)
	@Column({ nullable: true })
	readonly employeeId?: string;

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

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	bufferTimeStart?: Boolean;

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column({ nullable: true })
	bufferTimeEnd?: Boolean;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	bufferTimeInMins?: Number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ nullable: true })
	breakTimeInMins?: Number;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column({ nullable: true })
	breakStartTime?: Date;

	@ApiProperty({ type: AppointmentEmployees, isArray: true })
	@OneToMany(
		(type) => AppointmentEmployees,
		(entity) => entity.employeeId,
		{ onDelete: 'SET NULL' }
	)
	@JoinColumn()
	invitees: AppointmentEmployees[];
}

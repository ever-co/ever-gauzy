import { EmployeeAppointment as IEmployeeAppointment } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsDate,
	IsBoolean,
	IsNumber
} from 'class-validator';
import { Column, Entity, OneToMany, JoinColumn } from 'typeorm';
import { Base } from '../core/entities/base';
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

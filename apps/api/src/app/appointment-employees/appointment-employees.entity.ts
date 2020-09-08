import { AppointmentEmployees as IAppointmentEmployees } from '@gauzy/models';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { EmployeeAppointment } from '../employee-appointment';
import { Base } from '../core/entities/base';

@Entity('appointment_employees')
export class AppointmentEmployees extends Base
	implements IAppointmentEmployees {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public appointmentId!: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public employeeId!: string;

	@ApiProperty({ type: EmployeeAppointment })
	@ManyToOne(
		(type) => EmployeeAppointment,
		(employeeAppointment) => employeeAppointment,
		{ onDelete: 'SET NULL' }
	)
	@JoinColumn()
	employeeAppointment: EmployeeAppointment;
}

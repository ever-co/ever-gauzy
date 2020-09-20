import { IAppointmentEmployee, IEmployeeAppointment } from '@gauzy/models';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { EmployeeAppointment } from '../employee-appointment';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('appointment_employees')
export class AppointmentEmployee extends TenantOrganizationBase
	implements IAppointmentEmployee {
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
	employeeAppointment: IEmployeeAppointment;
}

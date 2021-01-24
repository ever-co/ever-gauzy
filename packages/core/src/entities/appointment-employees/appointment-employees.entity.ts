import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IAppointmentEmployee, IEmployeeAppointment } from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { EmployeeAppointment, TenantOrganizationBaseEntity } from '../internal';

@Entity('appointment_employee')
export class AppointmentEmployee
	extends TenantOrganizationBaseEntity
	implements IAppointmentEmployee {
	constructor(input?: DeepPartial<AppointmentEmployee>) {
		super(input);
	}

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
		() => EmployeeAppointment,
		(employeeAppointment) => employeeAppointment,
		{ onDelete: 'SET NULL' }
	)
	@JoinColumn()
	employeeAppointment: IEmployeeAppointment;
}

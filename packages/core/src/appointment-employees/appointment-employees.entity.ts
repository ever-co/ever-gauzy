import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, ManyToOne, RelationId, Index } from 'typeorm';
import { IAppointmentEmployee, IEmployee, IEmployeeAppointment } from '@gauzy/contracts';
import { IsString, IsNotEmpty } from 'class-validator';
import {
	Employee,
	EmployeeAppointment,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('appointment_employee')
export class AppointmentEmployee
	extends TenantOrganizationBaseEntity
	implements IAppointmentEmployee {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column()
	public appointmentId!: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	public employee?: IEmployee

	@ApiProperty({ type: () => String })
	@RelationId((it: AppointmentEmployee) => it.employee)
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	public employeeId?: string;

	/**
	 * EmployeeAppointment
	 */
	@ApiProperty({ type: () => EmployeeAppointment })
	@ManyToOne(() => EmployeeAppointment, (employeeAppointment) => employeeAppointment, {
		onDelete: 'SET NULL'
	})
	public employeeAppointment?: IEmployeeAppointment;

	@ApiProperty({ type: () => String })
	@RelationId((it: AppointmentEmployee) => it.employeeAppointment)
	@IsString()
	@Index()
	@Column()
	public employeeAppointmentId?: string;
}

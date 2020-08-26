import { AppointmentEmployees as IAppointmentEmployees } from '@gauzy/models';
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { EmployeeAppointment } from '../employee-appointment';
import { TenantBase } from '../core/entities/tenant-base';
import { Organization } from '../organization/organization.entity';

@Entity('appointment_employees')
export class AppointmentEmployees extends TenantBase
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

	@ApiProperty({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	organization: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(appointmentEmployees: AppointmentEmployees) =>
			appointmentEmployees.organization
	)
	@IsString()
	@Column({ nullable: true })
	organizationId: string;
}

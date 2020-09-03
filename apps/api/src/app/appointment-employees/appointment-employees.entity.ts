import { AppointmentEmployees as IAppointmentEmployees } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { EmployeeAppointment } from '../employee-appointment';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

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

  @ApiProperty({ type: Organization })
  @ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  organization: Organization;

  @ApiProperty({ type: String, readOnly: true })
  @RelationId((appointmentEmployees: AppointmentEmployees) => appointmentEmployees.organization)
  @IsString()
  @Column({ nullable: true })
  organizationId: string;

  @ApiProperty({ type: Tenant })
  @ManyToOne((type) => Tenant, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn()
  tenant: Tenant;

  @ApiProperty({ type: String, readOnly: true })
  @RelationId((appointmentEmployees: AppointmentEmployees) => appointmentEmployees.tenant)
  @IsString()
  @Column({ nullable: true })
  tenantId: string;
}

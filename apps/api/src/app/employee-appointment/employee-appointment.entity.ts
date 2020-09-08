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
import { AppointmentEmployees } from '../appointment-employees/appointment-employees.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('employee_appointment')
export class EmployeeAppointment extends TenantOrganizationBase implements IEmployeeAppointment {
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

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	emails?: string;

	@ApiProperty({ type: String })
	@IsString()
	@Column({ nullable: true })
	status?: string;

	@ApiProperty({ type: AppointmentEmployees, isArray: true })
	@OneToMany(
		(type) => AppointmentEmployees,
		(entity) => entity.employeeAppointment,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	invitees?: AppointmentEmployees[];
}

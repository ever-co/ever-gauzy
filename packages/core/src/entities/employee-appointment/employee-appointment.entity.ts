import { DeepPartial } from '@gauzy/common';
import { IEmployeeAppointment } from '@gauzy/contracts';
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
import {
	AppointmentEmployee,
	Employee,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('employee_appointment')
export class EmployeeAppointment
	extends TenantOrganizationBaseEntity
	implements IEmployeeAppointment {
	constructor(input?: DeepPartial<EmployeeAppointment>) {
		super(input);
	}

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee, { nullable: true, onDelete: 'CASCADE' })
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

	@ApiProperty({ type: AppointmentEmployee, isArray: true })
	@OneToMany(
		() => AppointmentEmployee,
		(entity) => entity.employeeAppointment,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	invitees?: AppointmentEmployee[];
}

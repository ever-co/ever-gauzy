import { ApiProperty } from '@nestjs/swagger';
import { RelationId, Index } from 'typeorm';
import { IAppointmentEmployee, IEmployee, IEmployeeAppointment } from '@gauzy/contracts';
import { IsString, IsNotEmpty } from 'class-validator';
import {
	Employee,
	EmployeeAppointment,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmAppointmentEmployeeRepository } from './repository/mikro-orm-appointment-employee.repository';
import { MultiORMManyToOne } from './../core/decorators/entity/relations';

@MultiORMEntity('appointment_employee', { mikroOrmRepository: () => MikroOrmAppointmentEmployeeRepository })
export class AppointmentEmployee extends TenantOrganizationBaseEntity implements IAppointmentEmployee {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	public appointmentId!: string;


	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	public employee?: IEmployee

	@ApiProperty({ type: () => String })
	@RelationId((it: AppointmentEmployee) => it.employee)
	@IsString()
	@IsNotEmpty()
	@Index()
	@MultiORMColumn({ relationId: true })
	public employeeId?: string;

	/**
	 * EmployeeAppointment
	 */
	@ApiProperty({ type: () => EmployeeAppointment })
	@MultiORMManyToOne(() => EmployeeAppointment, (employeeAppointment) => employeeAppointment?.invitees, {
		onDelete: 'SET NULL'
	})
	public employeeAppointment?: IEmployeeAppointment;

	@ApiProperty({ type: () => String })
	@RelationId((it: AppointmentEmployee) => it.employeeAppointment)
	@IsString()
	@Index()
	@MultiORMColumn({ nullable: true, relationId: true })
	public employeeAppointmentId?: string;
}

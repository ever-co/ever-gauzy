import { AppointmentEmployees as IAppointmentEmployees } from '@gauzy/models';
import { Base } from '../core/entities/base';
import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

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
}

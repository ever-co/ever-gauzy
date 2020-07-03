import {
	Entity,
	Column,
	JoinColumn,
	ManyToMany,
	JoinTable,
	OneToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeOff as ITimeOffRequest, StatusTypesEnum } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDate } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';

@Entity('time_off_request')
export class TimeOffRequest extends Base implements ITimeOffRequest {
	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	holidayName?: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'time_off_request_employee'
	})
	employees?: Employee[];

	@ApiProperty({ type: String })
	@IsString()
	@Column()
	organizationId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	description?: string;

	@ApiProperty({ type: TimeOffPolicy })
	@IsOptional()
	@OneToOne((type) => TimeOffPolicy, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn()
	policy?: TimeOffPolicy;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	start: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	end: Date;

	@ApiProperty({ type: Date })
	@IsDate()
	@Column()
	requestDate: Date;

	@ApiProperty({ type: String, enum: StatusTypesEnum })
	@IsEnum(StatusTypesEnum)
	@Column({ nullable: false })
	status?: string;
}

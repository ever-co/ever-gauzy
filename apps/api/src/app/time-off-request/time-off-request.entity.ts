import {
	Entity,
	Column,
	JoinColumn,
	ManyToMany,
	JoinTable,
	ManyToOne
} from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeOff as ITimeOffRequest, StatusTypesEnum } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsDate,
	IsBoolean
} from 'class-validator';
import { Employee } from '../employee/employee.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';

@Entity('time_off_request')
export class TimeOffRequest extends Base implements ITimeOffRequest {
	@ManyToMany((type) => Employee, { cascade: true })
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
	@ManyToOne((type) => TimeOffPolicy, {
		nullable: false,
		onDelete: 'CASCADE'
	})
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

	@ApiProperty({ type: Boolean })
	@IsBoolean()
	@Column()
	isHoliday?: boolean;
}

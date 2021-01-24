import {
	Entity,
	Column,
	JoinColumn,
	ManyToMany,
	JoinTable,
	ManyToOne
} from 'typeorm';
import {
	IEmployee,
	ITimeOff as ITimeOffRequest,
	ITimeOffPolicy,
	StatusTypesEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsString,
	IsEnum,
	IsOptional,
	IsDate,
	IsBoolean
} from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity,
	TimeOffPolicy
} from '../core/entities/internal';

@Entity('time_off_request')
export class TimeOffRequest
	extends TenantOrganizationBaseEntity
	implements ITimeOffRequest {
	constructor(input?: DeepPartial<TimeOffRequest>) {
		super(input);
	}

	@ManyToMany(() => Employee, { cascade: true })
	@JoinTable({
		name: 'time_off_request_employee'
	})
	employees?: IEmployee[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	documentUrl?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: TimeOffPolicy })
	@IsOptional()
	@ManyToOne(() => TimeOffPolicy, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	policy?: ITimeOffPolicy;

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

	@ApiPropertyOptional({ type: Boolean })
	@IsBoolean()
	@IsOptional()
	@Column({ nullable: true })
	isArchived?: boolean;
}

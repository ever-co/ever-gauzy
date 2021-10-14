import {
	Entity,
	Column,
	JoinColumn,
	ManyToMany,
	ManyToOne,
	RelationId,
	Index
} from 'typeorm';
import {
	IEmployee,
	ITimeOff as ITimeOffRequest,
	ITimeOffPolicy,
	StatusTypesEnum
} from '@gauzy/contracts';
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
	
	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	documentUrl?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	start: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	end: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column()
	requestDate: Date;

	@ApiProperty({ type: () => String, enum: StatusTypesEnum })
	@IsEnum(StatusTypesEnum)
	@Column({ nullable: false })
	status?: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column()
	isHoliday?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsBoolean()
	@IsOptional()
	@Column({ nullable: true })
	isArchived?: boolean;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	// TimeOff Policy
	@ApiProperty({ type: () => TimeOffPolicy })
	@ManyToOne(() => TimeOffPolicy, (policy) => policy.timeOffRequests, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	policy?: ITimeOffPolicy;

	@ApiProperty({ type: () => String })
	@RelationId((it: TimeOffRequest) => it.policy)
	@IsString()
	@Index()
	@Column()
	policyId?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Employee })
	@ManyToMany(() => Employee, (employee) => employee.timeOffRequests, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];
}
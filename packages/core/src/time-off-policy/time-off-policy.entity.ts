import { Entity, Index, Column, ManyToMany, OneToMany } from 'typeorm';
import {
	IEmployee,
	ITimeOff as ITimeOffRequest,
	ITimeOffPolicy
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity,
	TimeOffRequest
} from '../core/entities/internal';

@Entity('time_off_policy')
export class TimeOffPolicy
	extends TenantOrganizationBaseEntity
	implements ITimeOffPolicy {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column()
	requiresApproval: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@Column()
	paid: boolean;

	/**
	 * TimeOffRequest
	 */
	@ApiPropertyOptional({ type: () => TimeOffRequest, isArray: true })
	@OneToMany(() => TimeOffRequest, (it) => it.policy, {
		onDelete: 'SET NULL' 
	})
	timeOffRequests?: ITimeOffRequest[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	@ApiProperty({ type: () => Employee })
	@ManyToMany(() => Employee, (employee) => employee.timeOffPolicies, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];
}

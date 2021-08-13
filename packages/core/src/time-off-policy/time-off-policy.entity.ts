import { Entity, Index, Column, ManyToMany } from 'typeorm';
import { IEmployee, ITimeOffPolicy } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import {
	Employee,
	TenantOrganizationBaseEntity
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

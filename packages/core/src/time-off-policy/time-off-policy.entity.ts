import { Index } from 'typeorm';
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
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmTimeOffPolicyRepository } from './repository/mikro-orm-time-off-policy.repository';
import { MultiORMManyToMany, MultiORMOneToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('time_off_policy', { mikroOrmRepository: () => MikroOrmTimeOffPolicyRepository })
export class TimeOffPolicy extends TenantOrganizationBaseEntity implements ITimeOffPolicy {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn()
	requiresApproval: boolean;

	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	@MultiORMColumn()
	paid: boolean;

	/**
	 * TimeOffRequest
	 */
	@ApiPropertyOptional({ type: () => TimeOffRequest, isArray: true })
	@MultiORMOneToMany(() => TimeOffRequest, (it) => it.policy, {
		onDelete: 'SET NULL'
	})
	timeOffRequests?: ITimeOffRequest[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ApiProperty({ type: () => Employee })
	@MultiORMManyToMany(() => Employee, (employee) => employee.timeOffPolicies, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];
}

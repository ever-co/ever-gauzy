import { IEmployee, ITimeOff as ITimeOffRequest, ITimeOffPolicy } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { Employee, TenantOrganizationBaseEntity, TimeOffRequest } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmTimeOffPolicyRepository } from './repository/mikro-orm-time-off-policy.repository';

@MultiORMEntity('time_off_policy', { mikroOrmRepository: () => MikroOrmTimeOffPolicyRepository })
export class TimeOffPolicy extends TenantOrganizationBaseEntity implements ITimeOffPolicy {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
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
	@MultiORMOneToMany(() => TimeOffRequest, (it) => it.policy, {
		onDelete: 'SET NULL'
	})
	timeOffRequests?: ITimeOffRequest[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToMany(() => Employee, (employee) => employee.timeOffPolicies, {
		// Defines the database action to perform on update.
		onUpdate: 'CASCADE',
		// Defines the database cascade action on delete.
		onDelete: 'CASCADE'
	})
	employees?: IEmployee[];
}

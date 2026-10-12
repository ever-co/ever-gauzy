import {
	IEmployee,
	ITimeOff as ITimeOffRequest,
	ITimeOffPolicy,
	LeaveAccrualFrequencyEnum,
	LeaveTypeEnum
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { Employee, TenantOrganizationBaseEntity, TimeOffRequest } from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
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
	 * Leave category, used for grouping and reporting (issue #314).
	 */
	@ApiPropertyOptional({ enum: LeaveTypeEnum })
	@IsOptional()
	@IsEnum(LeaveTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', nullable: true })
	leaveType?: LeaveTypeEnum;

	/**
	 * Upper bound on the days an employee may take in a year under this policy.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	maxDaysPerYear?: number;

	/**
	 * Whether unused days roll over into the next year.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	allowCarryForward?: boolean;

	/**
	 * Upper bound on the days that may roll over. `0` or unset means no cap.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	maxCarryForwardDays?: number;

	/**
	 * Days accrued per accrual period.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	accrualRate?: number;

	/**
	 * How often `accrualRate` is granted.
	 */
	@ApiPropertyOptional({ enum: LeaveAccrualFrequencyEnum })
	@IsOptional()
	@IsEnum(LeaveAccrualFrequencyEnum)
	@MultiORMColumn({ type: 'varchar', nullable: true })
	accrualFrequency?: LeaveAccrualFrequencyEnum;

	/**
	 * Whether this is the organization's default policy.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, default: false })
	isDefault?: boolean;

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

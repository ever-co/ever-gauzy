import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ID, IEmployee, ITimeOffBalance, ITimeOffPolicy } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity, TimeOffPolicy } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmTimeOffBalanceRepository } from './repository/mikro-orm-time-off-balance.repository';

/**
 * Leave balance of one employee, under one Time Off policy, for one year (issue #314).
 *
 * `(tenantId, organizationId, employeeId, policyId, year)` is UNIQUE. That is a correctness
 * control, not a hint: without it two concurrent "find or create" calls would each insert a row
 * and the employee would end up with two balances, so days deducted from one would still look
 * available on the other.
 *
 * `carriedOut` is what makes the ledger honest across a year boundary: once days are rolled into
 * the next year they stop counting as remaining in this one, instead of being available twice.
 *
 * The day counts are `numeric` with a numeric transformer, matching every other money/quantity
 * column in the codebase — a bare `decimal` column comes back from PostgreSQL as a string, and
 * `'5' + 1` is `'51'`.
 */
@ColumnIndex('IDX_time_off_balance_unique', ['tenantId', 'organizationId', 'employeeId', 'policyId', 'year'], {
	unique: true
})
@MultiORMEntity('time_off_balance', { mikroOrmRepository: () => MikroOrmTimeOffBalanceRepository })
export class TimeOffBalance extends TenantOrganizationBaseEntity implements ITimeOffBalance {
	@ApiProperty({ type: () => Number, description: 'Fiscal/calendar year the balance applies to' })
	@IsNotEmpty()
	@IsInt()
	@Min(1900)
	@Max(2999)
	@ColumnIndex()
	@MultiORMColumn({ type: 'int' })
	year: number;

	@ApiProperty({ type: () => Number, description: 'Days accrued so far this year' })
	@IsNotEmpty()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	accrued: number;

	@ApiProperty({ type: () => Number, description: 'Days taken through approved time off requests' })
	@IsNotEmpty()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	taken: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Days carried forward from the previous year' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	carriedForward: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Days already rolled into the next year' })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	carriedOut: number;

	@ApiProperty({ type: () => Number, description: 'accrued + carriedForward - taken - carriedOut' })
	@IsNotEmpty()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	remaining: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee the balance belongs to.
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeOffBalance) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/**
	 * Policy the balance is tracked against.
	 */
	@MultiORMManyToOne(() => TimeOffPolicy, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	policy?: ITimeOffPolicy;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeOffBalance) => it.policy)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	policyId: ID;
}

import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';
import { ID, ITimeOff, ITimeOffBalance, ITimeOffBalanceDeduction } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, TimeOffBalance, TimeOffRequest } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmTimeOffBalanceDeductionRepository } from './repository/mikro-orm-time-off-balance-deduction.repository';

/**
 * The days one approved time-off request took from one balance (issue #10183).
 *
 * An approval writes one row per balance it took days from (one per employee of the request and per calendar year
 * it spans); taking the approval back gives exactly those days back and removes the rows. That is what makes the
 * balance side of a decision exact and repeatable:
 *
 *  - a reversal gives back what was taken, not what a recount finds today (holidays added since, a balance
 *    allocated after the approval, a request approved before balances were connected to approvals, or through a
 *    route that does not deduct yet, all give back nothing they did not take);
 *  - an approval that finds rows for its request has already taken its days and takes none again.
 *
 * `(timeOffRequestId, balanceId)` is UNIQUE: the last line of defence against one request being deducted twice from
 * the same balance, should two approvals ever get past the request's row lock.
 *
 * Both relations cascade on delete: deleting a request or a balance must never be refused because of this record.
 */
@ColumnIndex('IDX_time_off_balance_deduction_unique', ['timeOffRequestId', 'balanceId'], { unique: true })
@MultiORMEntity('time_off_balance_deduction', {
	mikroOrmRepository: () => MikroOrmTimeOffBalanceDeductionRepository
})
export class TimeOffBalanceDeduction extends TenantOrganizationBaseEntity implements ITimeOffBalanceDeduction {
	@ApiProperty({ type: () => Number, description: 'Working days taken from the balance' })
	@IsNotEmpty()
	@IsNumber()
	@Min(0)
	@MultiORMColumn({
		type: 'numeric',
		precision: 10,
		scale: 2,
		transformer: new ColumnNumericTransformerPipe()
	})
	days: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The approved time-off request the days were taken for.
	 */
	@MultiORMManyToOne(() => TimeOffRequest, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timeOffRequest?: ITimeOff;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeOffBalanceDeduction) => it.timeOffRequest)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	timeOffRequestId: ID;

	/**
	 * The balance the days were taken from.
	 */
	@MultiORMManyToOne(() => TimeOffBalance, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	balance?: ITimeOffBalance;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimeOffBalanceDeduction) => it.balance)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	balanceId: ID;
}

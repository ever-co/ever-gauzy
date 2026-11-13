import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, ITimeLog, ITimeLogReminder } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity, TimeLog } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';

/**
 * A reminder the platform sent about a running time log: level 1 once the timer ran for the employee's threshold,
 * level 2 at twice it (ever-co/ever-teams#5022).
 *
 * The row is the claim: the sweep inserts it before it files the notification, and the unique key on the log and the
 * level lets one insert through, whatever the processes or instances that run the sweep at the same moment. The one
 * that loses gets a unique violation and files nothing. A log's reminders go with it.
 *
 * The claim names the id the notification is filed under, and when it was filed. A process that stopped between its
 * claim and its filing leaves it unfiled: a later sweep takes it over and files it under that same id, so a
 * notification written just before the stop is found by its id rather than filed twice.
 */
@MultiORMEntity('time_log_reminder')
@ColumnIndex('IDX_time_log_reminder_time_log_level', ['timeLogId', 'level'], { unique: true })
export class TimeLogReminder extends TenantOrganizationBaseEntity implements ITimeLogReminder {
	/** 1: the timer ran for the employee's threshold; 2: for twice it. */
	@ApiProperty({ type: () => Number })
	@IsIn([1, 2])
	@MultiORMColumn()
	level: number;

	/** The id the reminder's notification is filed under, chosen with the claim (no key: the notification may go). */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMColumn()
	employeeNotificationId: ID;

	/** When the claim was taken, or taken over: one left unfiled for a while is filed by a later sweep. */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	claimedAt: Date;

	/** When the notification was filed; unset while it is not. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	filedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/** The running log the reminder was about. */
	@MultiORMManyToOne(() => TimeLog, { onDelete: 'CASCADE' })
	timeLog?: ITimeLog;

	/** Indexed by the unique key above, whose first column it is. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TimeLogReminder) => it.timeLog)
	@MultiORMColumn({ relationId: true })
	timeLogId: ID;
}

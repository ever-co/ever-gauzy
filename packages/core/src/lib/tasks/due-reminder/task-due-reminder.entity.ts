import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, ITask, ITaskDueReminder } from '@gauzy/contracts';
import { Employee, Task, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';

/**
 * A reminder the platform sent an assignee about a task's due date (ever-co/ever-teams#5022).
 *
 * The row is the claim: the sweep inserts it before it files the notification, and the unique key on the task, the
 * employee and the due date lets one insert through, whatever the processes or instances that sweep at the same moment.
 * The one that loses gets a unique violation and files nothing. The due date is part of the key, so a due date moved
 * since is reminded of again. A task's reminders go with it, and so do an employee's.
 *
 * The claim names the id the notification is filed under, and when it was filed. A process that stopped between its
 * claim and its filing leaves it unfiled: a later sweep takes it over and files it under that same id, so a
 * notification written just before the stop is found by its id rather than filed twice.
 */
@MultiORMEntity('task_due_reminder')
@ColumnIndex('IDX_task_due_reminder_task_employee_due_date', ['taskId', 'employeeId', 'dueDate'], { unique: true })
export class TaskDueReminder extends TenantOrganizationBaseEntity implements ITaskDueReminder {
	/** The due date the reminder was about, to the second (MySQL keeps no fraction of a second). */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	dueDate: Date;

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

	/** The task the reminder was about. */
	@MultiORMManyToOne(() => Task, { onDelete: 'CASCADE' })
	task?: ITask;

	/** Indexed by the unique key above, whose first column it is. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TaskDueReminder) => it.task)
	@MultiORMColumn({ relationId: true })
	taskId: ID;

	/** The assignee who was reminded. */
	@MultiORMManyToOne(() => Employee, { onDelete: 'CASCADE' })
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TaskDueReminder) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;
}

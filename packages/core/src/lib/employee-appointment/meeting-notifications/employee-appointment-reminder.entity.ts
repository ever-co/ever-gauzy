import { RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, IEmployeeAppointment, IEmployeeAppointmentReminder } from '@gauzy/contracts';
import { Employee, EmployeeAppointment, TenantOrganizationBaseEntity } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';

/**
 * A reminder the platform filed about a meeting for one employee who hosts or attends it: level 1 at their lead before
 * the start, level 2 when it is about to start (ever-co/ever-teams#5022).
 *
 * The row is the claim: the sweep inserts it before it files the notification, and the unique key on the meeting, the
 * employee, the level and the start lets one insert through, whatever the processes that run the sweep at the same
 * moment. The one that loses gets a unique violation and files nothing. The start is part of the key, so a meeting
 * moved to another time is reminded of again at its new time, and the reminder of its old time is never due. A
 * meeting's reminders, and an employee's, go with them.
 *
 * The claim names the id the notification is filed under, and when it was filed. A process that stopped between its
 * claim and its filing leaves it unfiled: a later sweep takes it over and files it under that same id, so a
 * notification written just before the stop is found by its id rather than filed twice.
 */
@MultiORMEntity('employee_appointment_reminder')
@ColumnIndex(
	'IDX_employee_appointment_reminder_key',
	['employeeAppointmentId', 'employeeId', 'level', 'startDateTime'],
	{ unique: true }
)
export class EmployeeAppointmentReminder extends TenantOrganizationBaseEntity implements IEmployeeAppointmentReminder {
	/** 1: the reminder at the employee's lead; 2: the meeting is about to start. */
	@ApiProperty({ type: () => Number })
	@IsIn([1, 2])
	@MultiORMColumn()
	level: number;

	/** The start the reminder was for. */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn()
	startDateTime: Date;

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

	/** The meeting the reminder was about. */
	@MultiORMManyToOne(() => EmployeeAppointment, { onDelete: 'CASCADE' })
	employeeAppointment?: IEmployeeAppointment;

	/** Indexed by the unique key above, whose first column it is. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeAppointmentReminder) => it.employeeAppointment)
	@MultiORMColumn({ relationId: true })
	employeeAppointmentId: ID;

	/** The employee reminded: the meeting's host or one of its invitees. */
	@MultiORMManyToOne(() => Employee, { onDelete: 'CASCADE' })
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeAppointmentReminder) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;
}

import { RelationId, JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ID, IEmployee, ITimesheet, IUser, TimesheetStatus } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity, User } from './../../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from './../../core/decorators/entity';
import { MikroOrmTimesheetRepository } from './repository/mikro-orm-timesheet.repository';

@MultiORMEntity('timesheet', { mikroOrmRepository: () => MikroOrmTimesheetRepository })
export class Timesheet extends TenantOrganizationBaseEntity implements ITimesheet {
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	duration?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	keyboard?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	mouse?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	stoppedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	approvedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	submittedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	lockedAt?: Date;

	/**
	 * Edited timestamp column
	 */
	@MultiORMColumn({ type: 'timestamp' })
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	editedAt?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@ColumnIndex()
	@MultiORMColumn({ default: false })
	isBilled?: boolean;

	@ApiProperty({ type: () => String, enum: TimesheetStatus, default: TimesheetStatus.PENDING })
	@IsEnum(TimesheetStatus)
	@ColumnIndex()
	@MultiORMColumn({ default: TimesheetStatus.PENDING })
	status: TimesheetStatus;

	/** Additional virtual columns */

	/**
	 * Indicates whether the Timesheet has been edited.
	 * If the value is true, it means the Timesheet has been edited.
	 * If the value is false or undefined, it means the Timesheet has not been edited.
	 */
	@VirtualMultiOrmColumn()
	isEdited?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.timesheets, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Timesheet) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId?: ID;

	/**
	 * Approve By User
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	approvedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Timesheet) => it.approvedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	approvedById?: ID;
}

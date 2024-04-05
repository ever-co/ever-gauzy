import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	RelationId,
	JoinTable
} from 'typeorm';
import { IsNumber, IsDateString, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import {
	ITimeSlot,
	ITimeSlotMinute,
	IActivity,
	IScreenshot,
	IEmployee,
	ITimeLog
} from '@gauzy/contracts';
import {
	Activity,
	Employee,
	Screenshot,
	TenantOrganizationBaseEntity,
	TimeLog
} from './../../core/entities/internal';
import { TimeSlotMinute } from './time-slot-minute.entity';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany, VirtualMultiOrmColumn } from './../../core/decorators/entity';
import { MikroOrmTimeSlotRepository } from './repository/mikro-orm-time-slot.repository';

@MultiORMEntity('time_slot', { mikroOrmRepository: () => MikroOrmTimeSlotRepository })
export class TimeSlot extends TenantOrganizationBaseEntity
	implements ITimeSlot {

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@ColumnIndex()
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
	@ColumnIndex()
	@MultiORMColumn({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsNotEmpty()
	@IsDateString()
	@ColumnIndex()
	@MultiORMColumn()
	startedAt: Date;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	stoppedAt?: Date;

	@VirtualMultiOrmColumn()
	percentage?: number;

	@VirtualMultiOrmColumn()
	keyboardPercentage?: number;

	@VirtualMultiOrmColumn()
	mousePercentage?: number;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.timeSlots, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TimeSlot) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: IEmployee['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Screenshot
	 */
	@MultiORMOneToMany(() => Screenshot, (it) => it.timeSlot)
	screenshots?: IScreenshot[];

	/**
	 * Activity
	 */
	@MultiORMOneToMany(() => Activity, (it) => it.timeSlot, {
		cascade: true
	})
	activities?: IActivity[];

	/**
	 * TimeSlotMinute
	 */
	@MultiORMOneToMany(() => TimeSlotMinute, (it) => it.timeSlot, {
		cascade: true
	})
	timeSlotMinutes?: ITimeSlotMinute[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * TimeLog
	 */
	@MultiORMManyToMany(() => TimeLog, (it) => it.timeSlots, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'time_slot_time_logs',
		joinColumn: 'timeSlotId',
		inverseJoinColumn: 'timeLogId',
	})
	@JoinTable({ name: 'time_slot_time_logs' })
	timeLogs?: ITimeLog[];
}

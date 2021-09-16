import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	OneToMany,
	ManyToMany,
	JoinTable
} from 'typeorm';
import {
	ITimeSlot,
	ITimeSlotMinute,
	IActivity,
	IScreenshot,
	IEmployee,
	ITimeLog
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString } from 'class-validator';
import {
	Activity,
	Employee,
	Screenshot,
	TenantOrganizationBaseEntity,
	TimeLog
} from './../../core/entities/internal';
import { TimeSlotMinute } from './time-slot-minute.entity';

@Entity('time_slot')
export class TimeSlot
	extends TenantOrganizationBaseEntity
	implements ITimeSlot {

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Column()
	startedAt: Date;

	stoppedAt?: Date;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TimeSlot) => it.employee)
	@Column()
	employeeId: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * Screenshot
	 */
	@ApiProperty({ type: () => Screenshot, isArray: true })
	@OneToMany(() => Screenshot, (screenshot) => screenshot.timeSlot)
	@JoinColumn()
	screenshots?: IScreenshot[];

	/**
	 * Activity
	 */
	@ApiProperty({ type: () => Activity })
	@OneToMany(() => Activity, (activity) => activity.timeSlot, {
		cascade: true
	})
	@JoinColumn()
	activities?: IActivity[];

	/**
	 * TimeSlotMinute
	 */
	@ApiProperty({ type: () => TimeSlotMinute })
	@OneToMany(() => TimeSlotMinute, (timeSlotMinute) => timeSlotMinute.timeSlot, {
		cascade: true
	})
	@JoinColumn()
	timeSlotMinutes?: ITimeSlotMinute[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */

	/**
	 * TimeLog
	 */
	@ManyToMany(() => TimeLog, (timeLogs) => timeLogs.timeSlots, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'time_slot_time_logs'
	})
	timeLogs?: ITimeLog[];
}

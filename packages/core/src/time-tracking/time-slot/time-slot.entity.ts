import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	OneToMany,
	ManyToMany,
	JoinTable,
	Index
} from 'typeorm';
import {
	ITimeSlot,
	ITimeSlotMinute,
	IActivity,
	IScreenshot,
	IEmployee,
	ITimeLog
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsDateString, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';
import {
	Activity,
	Employee,
	Screenshot,
	TenantOrganizationBaseEntity,
	TimeLog
} from './../../core/entities/internal';
import { TimeSlotMinute } from './time-slot-minute.entity';

@Entity('time_slot')
export class TimeSlot extends TenantOrganizationBaseEntity
	implements ITimeSlot {

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Index()
	@Column({ default: 0 })
	duration?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
	@Index()
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsNotEmpty()
	@IsDateString()
	@Index()
	@Column()
	startedAt: Date;

	/** Additional fields */
	stoppedAt?: Date;
	percentage?: number;
	keyboardPercentage?: number;
	mousePercentage?: number;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@ManyToOne(() => Employee, (employee) => employee.timeSlots, {
		onDelete: 'CASCADE'
	})
	employee?: IEmployee;

	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: TimeSlot) => it.employee)
	@Index()
	@Column()
	employeeId: IEmployee['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Screenshot
	 */
	@OneToMany(() => Screenshot, (screenshot) => screenshot.timeSlot)
	screenshots?: IScreenshot[];

	/**
	 * Activity
	 */
	@OneToMany(() => Activity, (activity) => activity.timeSlot, {
		cascade: true
	})
	activities?: IActivity[];

	/**
	 * TimeSlotMinute
	 */
	@OneToMany(() => TimeSlotMinute, (timeSlotMinute) => timeSlotMinute.timeSlot, {
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
	@ManyToMany(() => TimeLog, (timeLogs) => timeLogs.timeSlots, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'time_slot_time_logs'
	})
	timeLogs?: ITimeLog[];
}

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
	TimeLog,
	TimeSlotMinute
} from './../core/entities/internal';

@Entity('time_slot')
export class TimeSlot
	extends TenantOrganizationBaseEntity
	implements ITimeSlot {
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeSlot: TimeSlot) => timeSlot.employee)
	@Column()
	employeeId: string;

	@ApiProperty({ type: () => Screenshot })
	@OneToMany(() => Screenshot, (screenshot) => screenshot.timeSlot)
	@JoinColumn()
	screenshots?: IScreenshot[];

	@ApiProperty({ type: () => Activity })
	@OneToMany(() => Activity, (activities) => activities.timeSlot)
	@JoinColumn()
	activities?: IActivity[];

	@ApiProperty({ type: () => TimeSlotMinute })
	@OneToMany(() => TimeSlotMinute, (timeSlotMinute) => timeSlotMinute.timeSlot)
	@JoinColumn()
	timeSlotMinutes?: ITimeSlotMinute[];

	@ManyToMany(() => TimeLog, (timeLogs) => timeLogs.timeSlots)
	@JoinTable({
		name: 'time_slot_time_logs'
	})
	timeLogs?: ITimeLog[];

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
}

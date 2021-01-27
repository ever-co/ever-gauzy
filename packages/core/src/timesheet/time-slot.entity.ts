import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	AfterLoad,
	OneToMany,
	ManyToMany
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
import * as moment from 'moment';
import {
	Activity,
	Employee,
	Screenshot,
	TenantOrganizationBaseEntity,
	TimeLog,
	TimeSlotMinute
} from '../core/entities/internal';

@Entity('time_slot')
// @Unique(['employeeId', 'startedAt'])
export class TimeSlot
	extends TenantOrganizationBaseEntity
	implements ITimeSlot {
	constructor(input?: Partial<ITimeSlot>) {
		super(input);
	}

	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeSlot) => timeSlot.employee)
	@Column()
	employeeId: string;

	@ApiProperty({ type: Screenshot })
	@OneToMany(() => Screenshot, (screenshot) => screenshot.timeSlot, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	screenshots?: IScreenshot[];

	@ApiProperty({ type: Activity })
	@OneToMany(() => Activity, (activities) => activities.timeSlot, {
		cascade: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	activities?: IActivity[];

	@ApiProperty({ type: TimeSlotMinute })
	@OneToMany(
		() => TimeSlotMinute,
		(timeSlotMinute) => timeSlotMinute.timeSlot,
		{
			cascade: true,
			onDelete: 'CASCADE'
		}
	)
	@JoinColumn()
	timeSlotMinutes?: ITimeSlotMinute[];

	@ManyToMany(() => TimeLog, (timeLogs) => timeLogs.timeSlots)
	timeLogs?: ITimeLog[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column()
	startedAt: Date;

	stoppedAt?: Date;
	@AfterLoad()
	getStoppedAt?() {
		this.stoppedAt = moment(this.startedAt).add(10, 'minutes').toDate();
	}
}

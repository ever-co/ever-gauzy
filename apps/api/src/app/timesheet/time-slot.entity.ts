import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	Unique,
	AfterLoad,
	OneToMany,
	ManyToMany
} from 'typeorm';
import { Base } from '../core/entities/base';
import { TimeSlot as ITimeSlot } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import * as moment from 'moment';
import { Screenshot } from './screenshot.entity';
import { TimeSlotMinute } from './time-slot-minute.entity';
import { TimeLog } from './time-log.entity';

@Entity('time_slot')
@Unique(['employeeId', 'startedAt'])
export class TimeSlot extends Base implements ITimeSlot {
	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeSlot) => timeSlot.employee)
	@Column()
	readonly employeeId: string;

	@ApiProperty({ type: Screenshot })
	@OneToMany(() => Screenshot, (screenshot) => screenshot.timeSlot)
	@JoinColumn()
	screenshots?: Screenshot[];

	@ApiProperty({ type: TimeSlotMinute })
	@OneToMany(
		() => TimeSlotMinute,
		(timeSlotMinute) => timeSlotMinute.timeSlot
	)
	@JoinColumn()
	timeSlotMinutes?: TimeSlotMinute[];

	@ManyToMany(() => TimeLog, (timeLogs) => timeLogs.timeSlots)
	timeLogs?: TimeLog[];

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	duration: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	keyboard: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	mouse: number;

	@ApiProperty({ type: Number })
	@IsNumber()
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: 'timestamptz' })
	@IsDateString()
	@Column()
	startedAt: Date;

	stoppedAt: Date;
	@AfterLoad()
	getStoppedAt?() {
		this.stoppedAt = moment(this.startedAt).add(10, 'minutes').toDate();
	}
}

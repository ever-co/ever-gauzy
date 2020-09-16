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
import {
	ITimeSlot,
	ITimeSlotMinute,
	IActivity,
	IScreenshot,
	IEmployee,
	ITimeLog
} from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDateString } from 'class-validator';
import { Employee } from '../employee/employee.entity';
import * as moment from 'moment';
import { Screenshot } from './screenshot.entity';
import { TimeSlotMinute } from './time-slot-minute.entity';
import { TimeLog } from './time-log.entity';
import { Activity } from './activity.entity';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';

@Entity('time_slot')
@Unique(['employeeId', 'startedAt'])
export class TimeSlot extends TenantOrganizationBase implements ITimeSlot {
	@ApiProperty({ type: Employee })
	@ManyToOne(() => Employee)
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((timeSlot: TimeSlot) => timeSlot.employee)
	@Column()
	employeeId: string;

	@ApiProperty({ type: Screenshot })
	@OneToMany(() => Screenshot, (screenshot) => screenshot.timeSlot)
	@JoinColumn()
	screenshots?: IScreenshot[];

	@ApiProperty({ type: Activity })
	@OneToMany(() => Activity, (activites) => activites.timeSlot)
	@JoinColumn()
	activities?: IActivity[];

	@ApiProperty({ type: TimeSlotMinute })
	@OneToMany(
		() => TimeSlotMinute,
		(timeSlotMinute) => timeSlotMinute.timeSlot
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

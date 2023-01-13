import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	ManyToMany,
	Index,
	AfterLoad
} from 'typeorm';
import {
	ITimeLog,
	TimeLogType,
	TimeLogSourceEnum,
	ITimesheet,
	IEmployee,
	ITask,
	IOrganizationProject,
	IOrganizationContact,
	ITimeSlot
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import * as moment from 'moment';
import {
	Employee,
	OrganizationContact,
	OrganizationProject,
	Task,
	TenantOrganizationBaseEntity,
	Timesheet,
	TimeSlot
} from './../../core/entities/internal';

@Entity('time_log')
export class TimeLog extends TenantOrganizationBaseEntity implements ITimeLog {

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: () => String, enum: TimeLogType })
	@Column({ default: TimeLogType.TRACKED })
	logType: string;

	@ApiProperty({ type: () => String, enum: TimeLogSourceEnum })
	@Column({ default: TimeLogSourceEnum.WEB_TIMER })
	source?: string;

	@ApiProperty({ type: () => String })
	@Column({ default: null, nullable: true })
	description?: string;

	@ApiProperty({ type: () => String })
	@Column({ default: null, nullable: true })
	reason?: string;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	isBillable: boolean;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	isRunning?: boolean;

	@ApiProperty({ type: () => String })
	@Column({ update: false, nullable: true })
	version?: string;

	duration: number;
	isEdited?: boolean;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => Employee, (employee) => employee.timeLogs)
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TimeLog) => it.employee)
	@Index()
	@Column()
	readonly employeeId: string;

	/**
	 * Timesheet
	 */
	@ApiProperty({ type: () => Timesheet })
	@ManyToOne(() => Timesheet, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timesheet?: ITimesheet;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: TimeLog) => it.timesheet)
	@Index()
	@Column({ nullable: true })
	readonly timesheetId?: string;

	/**
	 * OrganizationProject
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@ManyToOne(() => OrganizationProject, (project) => project.timeLogs, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	project?: IOrganizationProject;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.project)
	@Index()
	@Column({ nullable: true })
	readonly projectId?: string;

	/**
	 * Task
	 */
	@ApiProperty({ type: () => Task })
	@ManyToOne(() => Task, (task) => task.activities, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	task?: ITask;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.task)
	@Index()
	@Column({ nullable: true })
	taskId?: string;

	/**
	 * OrganizationContact
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@ManyToOne(() => OrganizationContact, (contact) => contact.timeLogs, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((timeLog: TimeLog) => timeLog.organizationContact)
	@Index()
	@Column({ nullable: true })
	organizationContactId?: string;


	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */

	/**
	 * TimeSlot
	 */
	@ApiProperty({ type: () => TimeSlot, isArray: true })
	@ManyToMany(() => TimeSlot, (timeLogs) => timeLogs.timeLogs, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	timeSlots?: ITimeSlot[];

	/*
    |--------------------------------------------------------------------------
    | @EventSubscriber
    |--------------------------------------------------------------------------
    */

	/**
    * Called after entity is loaded.
    */
	@AfterLoad()
	afterLoadEntity?() {
        const startedAt = moment(this.startedAt, 'YYYY-MM-DD HH:mm:ss');
        const stoppedAt = moment(this.stoppedAt || new Date(), 'YYYY-MM-DD HH:mm:ss');
        this.duration = stoppedAt.diff(startedAt, 'seconds');

		/**
		 * Check If, TimeLog is edited or not
		 */
		const createdAt = moment(this.createdAt, 'YYYY-MM-DD HH:mm:ss');
		const updatedAt = moment(this.updatedAt, 'YYYY-MM-DD HH:mm:ss');
		this.isEdited = (updatedAt.diff(createdAt, 'seconds') > 0);
    }
}

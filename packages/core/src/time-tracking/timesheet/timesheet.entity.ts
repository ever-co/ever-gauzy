import {
	Entity,
	Column,
	RelationId,
	ManyToOne,
	JoinColumn,
	Index
} from 'typeorm';
import { IEmployee, ITimesheet, IUser, TimesheetStatus } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import {
	Employee,
	TenantOrganizationBaseEntity,
	User
} from './../../core/entities/internal';

@Entity('timesheet')
export class Timesheet extends TenantOrganizationBaseEntity
	implements ITimesheet {

	@ApiProperty({ type: () => Number })
	@Column({ default: 0 })
	duration?: number;

	@ApiProperty({ type: () => Number })
	@Column({ default: 0 })
	keyboard?: number;

	@ApiProperty({ type: () => Number })
	@Column({ default: 0 })
	mouse?: number;

	@ApiProperty({ type: () => Number })
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	stoppedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	approvedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	submittedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	lockedAt?: Date;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	isBilled?: boolean;

	@ApiProperty({ type: () => String, enum: TimesheetStatus })
	@Column({ default: TimesheetStatus.PENDING })
	status: string;

	@ApiProperty({ type: () => 'timestamptz' })
	@Column({ nullable: true, default: null })
	deletedAt?: Date;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@ManyToOne(() => Employee, (employee) => employee.timesheets, {
		onDelete: 'CASCADE'
	})
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: Timesheet) => it.employee)
	@Index()
	@Column()
	employeeId?: IEmployee['id'];

	/**
	 * Approve By Employee
	 */
	@ApiProperty({ type: () => Employee })
	@ManyToOne(() => User, { nullable: true })
	@JoinColumn()
	approvedBy?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Timesheet) => it.approvedBy)
	@Index()
	@Column({ nullable: true })
	approvedById?: string;
}

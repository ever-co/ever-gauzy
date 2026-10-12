import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
	ID,
	IOrganizationProject,
	ITimesheet,
	ITimesheetProjectChangeRequest,
	IUser,
	TimesheetProjectChangeStatus
} from '@gauzy/contracts';
import { OrganizationProject, TenantOrganizationBaseEntity, User } from './../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../../core/decorators/entity';
import { Timesheet } from './timesheet.entity';
import { MikroOrmTimesheetProjectChangeRequestRepository } from './repository/mikro-orm-timesheet-project-change-request.repository';

/**
 * A request, raised by the owner of a timesheet, to move the time logged against one
 * project over to another project (issue #9516).
 *
 * A timesheet is a per-employee, per-period container of `TimeLog` rows and the project
 * lives on the *log*, not on the timesheet — one timesheet routinely holds logs for
 * several projects. Every request therefore records BOTH endpoints of the move:
 * `previousProjectId` (where the time is booked now) and `requestedProjectId` (where it
 * should go). Approving a request only ever touches logs currently on
 * `previousProjectId`, so correctly-booked time in the same timesheet is left alone.
 */
@MultiORMEntity('timesheet_project_change_request', {
	mikroOrmRepository: () => MikroOrmTimesheetProjectChangeRequestRepository
})
export class TimesheetProjectChangeRequest
	extends TenantOrganizationBaseEntity
	implements ITimesheetProjectChangeRequest
{
	/** Why the employee is asking for the change. Mandatory, per issue #9516. */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ length: 500 })
	reason: string;

	@ApiProperty({ enum: TimesheetProjectChangeStatus })
	@IsEnum(TimesheetProjectChangeStatus)
	@ColumnIndex()
	@MultiORMColumn({ type: 'varchar', default: TimesheetProjectChangeStatus.PENDING })
	status: TimesheetProjectChangeStatus;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	reviewedAt?: Date;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ length: 500, nullable: true })
	reviewNote?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Timesheet the request was raised against.
	 */
	@MultiORMManyToOne(() => Timesheet, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	timesheet?: ITimesheet;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimesheetProjectChangeRequest) => it.timesheet)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	timesheetId: ID;

	/**
	 * Project the affected time logs should be moved TO.
	 */
	@MultiORMManyToOne(() => OrganizationProject, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	requestedProject?: IOrganizationProject;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimesheetProjectChangeRequest) => it.requestedProject)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	requestedProjectId: ID;

	/**
	 * Project the affected time logs are booked to at the time the request is raised.
	 */
	@MultiORMManyToOne(() => OrganizationProject, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	previousProject?: IOrganizationProject;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: TimesheetProjectChangeRequest) => it.previousProject)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	previousProjectId: ID;

	/**
	 * User who approved or rejected the request.
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	reviewedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: TimesheetProjectChangeRequest) => it.reviewedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	reviewedById?: ID;
}

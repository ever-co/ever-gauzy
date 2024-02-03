import {
	Column,
	RelationId,
	JoinColumn,
	Index,
	AfterLoad
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { IEmployee, ITimesheet, IUser, TimesheetStatus } from '@gauzy/contracts';
import {
	Employee,
	TenantOrganizationBaseEntity,
	User
} from './../../core/entities/internal';
import { MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmTimesheetRepository } from './repository/mikro-orm-timesheet.repository';
import { MultiORMManyToOne } from 'core/decorators/entity/relations';

@MultiORMEntity('timesheet', { mikroOrmRepository: () => MikroOrmTimesheetRepository })
export class Timesheet extends TenantOrganizationBaseEntity implements ITimesheet {

	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsOptional()
	@IsNumber()
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
	@Column({ default: 0 })
	overall?: number;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	startedAt?: Date;

	@ApiProperty({ type: () => 'timestamptz' })
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	stoppedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	approvedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	submittedAt?: Date;

	@ApiPropertyOptional({ type: () => 'timestamptz' })
	@IsOptional()
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	lockedAt?: Date;

	/**
	 * Edited timestamp column
	 */
	@Column({ type: 'timestamp' })
	@IsDateString()
	@Index()
	@Column({ nullable: true })
	editedAt?: Date;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Index()
	@Column({ default: false })
	isBilled?: boolean;

	@ApiPropertyOptional({ type: () => String, enum: TimesheetStatus, default: TimesheetStatus.PENDING })
	@IsOptional()
	@IsEnum(TimesheetStatus)
	@Index()
	@Column({ default: TimesheetStatus.PENDING })
	status: string;

	/** Additional fields */

	/**
	 * Indicates whether the Timesheet has been edited.
	 * If the value is true, it means the Timesheet has been edited.
	 * If the value is false or undefined, it means the Timesheet has not been edited.
	 */
	isEdited?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.timesheets, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: Timesheet) => it.employee)
	@Index()
	@Column()
	employeeId?: IEmployee['id'];

	/**
	 * Approve By User
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,
	})
	@JoinColumn()
	approvedBy?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: Timesheet) => it.approvedBy)
	@Index()
	@Column({ nullable: true })
	approvedById?: IUser['id'];

	/**
	 * Called after entity is loaded.
	 */
	@AfterLoad()
	afterLoadEntity?() {
		/**
		 * Sets the 'isEdited' property based on the presence of 'editedAt'.
		 * If 'editedAt' is defined, 'isEdited' is set to true; otherwise, it is set to false.
		 */
		if ('editedAt' in this) {
			this.isEdited = !!this.editedAt;
		}
	}
}

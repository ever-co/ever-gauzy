import { JoinColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	ID,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationSprintEmployee,
	IOrganizationSprintTask,
	IOrganizationSprintTaskHistory,
	JsonData,
	ITaskView,
	OrganizationSprintStatusEnum,
	SprintStartDayEnum
} from '@gauzy/contracts';
import {
	OrganizationProject,
	OrganizationProjectModule,
	OrganizationSprintEmployee,
	OrganizationSprintTask,
	OrganizationSprintTaskHistory,
	Task,
	TaskView,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmOrganizationSprintRepository } from './repository/mikro-orm-organization-sprint.repository';

@MultiORMEntity('organization_sprint', { mikroOrmRepository: () => MikroOrmOrganizationSprintRepository })
export class OrganizationSprint extends TenantOrganizationBaseEntity implements IOrganizationSprint {
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	goal?: string;

	@ApiProperty({ type: () => Number })
	@IsNumber()
	@MultiORMColumn({ default: 7 })
	length: number;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Type(() => Date)
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsDate()
	@IsOptional()
	@Type(() => Date)
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ type: () => String, enum: OrganizationSprintStatusEnum })
	@IsNotEmpty()
	@IsEnum(OrganizationSprintStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: OrganizationSprintStatusEnum;

	@ApiPropertyOptional({ type: () => Number, enum: SprintStartDayEnum })
	@IsOptional()
	@IsEnum(SprintStartDayEnum)
	@MultiORMColumn({ nullable: true })
	dayStart?: number;

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	sprintProgress?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationProject Relationship
	 */
	@ApiProperty({ type: () => OrganizationProject })
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.organizationSprints, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	project: OrganizationProject;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ relationId: true })
	projectId: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationTeamEmployee
	 */
	@MultiORMOneToMany(() => OrganizationSprintEmployee, (it) => it.organizationSprint, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	members?: IOrganizationSprintEmployee[];

	/**
	 * Sprint Tasks (Many-To-Many sprint tasks)
	 */
	@MultiORMOneToMany(() => OrganizationSprintTask, (it) => it.organizationSprint, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	taskSprints?: IOrganizationSprintTask[];

	/**
	 * Tasks (Task active sprint)
	 */
	@ApiProperty({ type: () => Task })
	@MultiORMOneToMany(() => Task, (task) => task.organizationSprint)
	@JoinColumn()
	tasks?: Task[];

	/**
	 * Sprint views
	 */
	@MultiORMOneToMany(() => TaskView, (sprint) => sprint.organizationSprint)
	views?: ITaskView[];

	/**
	 * From OrganizationSprint histories
	 */
	@MultiORMOneToMany(() => OrganizationSprintTaskHistory, (it) => it.fromSprint, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	fromSprintTaskHistories?: IOrganizationSprintTaskHistory[];

	/**
	 * From OrganizationSprint histories
	 */
	@MultiORMOneToMany(() => OrganizationSprintTaskHistory, (it) => it.toSprint, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	toSprintTaskHistories?: IOrganizationSprintTaskHistory[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Project Module
	 */
	@MultiORMManyToMany(() => OrganizationProjectModule, (it) => it.organizationSprints, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	modules?: IOrganizationProjectModule[];
}

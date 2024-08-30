import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsEnum,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID
} from 'class-validator';
import { Type } from 'class-transformer';
import {
	ID,
	IEmployee,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationSprint,
	IOrganizationTeam,
	ITask,
	IUser,
	TaskStatusEnum
} from '@gauzy/contracts';
import {
	Employee,
	OrganizationProject,
	OrganizationSprint,
	OrganizationTeam,
	Task,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from '../core/decorators/entity';
import { MikroOrmOrganizationProjectModuleRepository } from './repository/mikro-orm-organization-project-module.repository';

@MultiORMEntity('organization_project_module', {
	mikroOrmRepository: () => MikroOrmOrganizationProjectModuleRepository
})
export class OrganizationProjectModule extends TenantOrganizationBaseEntity implements IOrganizationProjectModule {
	[EntityRepositoryType]?: MikroOrmOrganizationProjectModuleRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(TaskStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: TaskStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Type(() => Date)
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	public?: boolean;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	isFavorite?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	// Define the parent-child relationship
	@ApiPropertyOptional({ type: () => OrganizationProjectModule })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProjectModule, (module) => module.children, {
		onDelete: 'SET NULL'
	})
	parent?: OrganizationProjectModule;

	// Define the parent-child relationship
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * Organization Project
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.modules, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	project?: IOrganizationProject;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProjectModule) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;

	/**
	 * Creator
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	creator?: IUser;

	@RelationId((it: OrganizationProjectModule) => it.creator)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	creatorId?: ID;

	/**
	 * Module manager
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	manager?: IUser;

	@RelationId((it: OrganizationProjectModule) => it.manager)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	managerId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Children modules
	 */
	@MultiORMOneToMany(() => OrganizationProjectModule, (module) => module.parent)
	children?: OrganizationProjectModule[];

	/**
	 * Organization Tasks Relationship
	 */
	@MultiORMOneToMany(() => Task, (it) => it.projectModule)
	tasks?: ITask[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Organization Sprint
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationSprint, (it) => it.modules, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'project_module_sprint',
		joinColumn: 'organizationProjectModuleId',
		inverseJoinColumn: 'organizationSprintId'
	})
	@JoinTable({
		name: 'project_module_sprint'
	})
	organizationSprints?: IOrganizationSprint[];

	/**
	 * OrganizationTeam
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationTeam, (it) => it.modules, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'project_module_team',
		joinColumn: 'organizationProjectModuleId',
		inverseJoinColumn: 'organizationTeamId'
	})
	@JoinTable({
		name: 'project_module_team'
	})
	teams?: IOrganizationTeam[];

	/**
	 * Members
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Employee, (employee) => employee.modules, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'project_module_employee',
		joinColumn: 'organizationProjectModuleId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({
		name: 'project_module_employee'
	})
	members?: IEmployee[];
}

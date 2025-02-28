import { JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EntityRepositoryType } from '@mikro-orm/core';
import {
	IsArray,
	IsBoolean,
	IsDateString,
	IsEnum,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	IsUUID
} from 'class-validator';
import {
	ID,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationProjectModuleEmployee,
	IOrganizationSprint,
	IOrganizationTeam,
	ITask,
	ITaskView,
	ProjectModuleStatusEnum
} from '@gauzy/contracts';
import {
	OrganizationProject,
	OrganizationSprint,
	OrganizationTeam,
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
} from '../core/decorators/entity';
import { OrganizationProjectModuleEmployee } from './organization-project-module-employee.entity';
import { MikroOrmOrganizationProjectModuleRepository } from './repository/mikro-orm-organization-project-module.repository';

@MultiORMEntity('organization_project_module', {
	mikroOrmRepository: () => MikroOrmOrganizationProjectModuleRepository
})
export class OrganizationProjectModule extends TenantOrganizationBaseEntity implements IOrganizationProjectModule {
	[EntityRepositoryType]?: MikroOrmOrganizationProjectModuleRepository;

	/**
	 * Name of the project module
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	/**
	 * Description of the project module
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true, type: 'text' })
	description?: string;

	/**
	 * Status of the project module
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(ProjectModuleStatusEnum)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	status?: ProjectModuleStatusEnum;

	/**
	 * Start date of the project module
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	startDate?: Date;

	/**
	 * End date of the project module
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDateString()
	@MultiORMColumn({ nullable: true })
	endDate?: Date;

	/**
	 * Indicates if the project module is public
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	public?: boolean;

	/**
	 * Indicates if the project module is favorite
	 */
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
	/**
	 * The parent module. This property is used to determine the hierarchy of modules.
	 */
	@ApiPropertyOptional({ type: () => OrganizationProjectModule })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProjectModule, (module) => module.children, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'SET NULL' // Defines the database cascade action on delete.
	})
	parent?: OrganizationProjectModule;

	/**
	 * The ID of the parent module.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProjectModule) => it.parent)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	parentId?: ID;

	/**
	 * The project associated with the module.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => OrganizationProject, (it) => it.modules, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'CASCADE' // Defines the database cascade action on delete.
	})
	project?: IOrganizationProject;

	/**
	 * The ID of the project associated with the module.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationProjectModule) => it.project)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	projectId?: ID;
	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The children modules.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => OrganizationProjectModule, (module) => module.parent)
	children?: OrganizationProjectModule[];

	/**
	 * The views of the module.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => TaskView, (module) => module.projectModule)
	views?: ITaskView[];

	/**
	 * The members of the module.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => OrganizationProjectModuleEmployee, (employee) => employee.organizationProjectModule, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	members?: IOrganizationProjectModuleEmployee[];
	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * The tasks of the module.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true, description: 'List of task IDs' })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => Task, (it) => it.modules, {
		onUpdate: 'CASCADE', // Defines the database action to perform on update.
		onDelete: 'CASCADE' // Defines the database cascade action on delete.
	})
	@JoinTable({ name: 'project_module_task' })
	tasks?: ITask[];

	/**
	 * The organization sprints of the module.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationSprint, (it) => it.modules, {
		onUpdate: 'CASCADE', // Defines the database action to perform on update.
		onDelete: 'CASCADE', // Defines the database cascade action on delete.
		owner: true, // This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.
		pivotTable: 'project_module_sprint', // The name of the pivot table.
		joinColumn: 'organizationProjectModuleId', // The name of the join column in the pivot table.
		inverseJoinColumn: 'organizationSprintId' // The name of the inverse join column in the pivot table.
	})
	@JoinTable({ name: 'project_module_sprint' })
	organizationSprints?: IOrganizationSprint[];

	/**
	 * The organization teams of the module.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMManyToMany(() => OrganizationTeam, (it) => it.modules, {
		onUpdate: 'CASCADE', // Defines the database action to perform on update.
		onDelete: 'CASCADE', // Defines the database cascade action on delete.
		owner: true, // This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.
		pivotTable: 'project_module_team', // The name of the pivot table.
		joinColumn: 'organizationProjectModuleId', // The name of the join column in the pivot table.
		inverseJoinColumn: 'organizationTeamId' // The name of the inverse join column in the pivot table.
	})
	@JoinTable({ name: 'project_module_team' })
	teams?: IOrganizationTeam[];
}

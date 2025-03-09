import { JoinTable, JoinColumn, RelationId } from 'typeorm';
import {
	IComment,
	ID,
	IDailyPlan,
	IEquipmentSharing,
	IGoal,
	IImageAsset,
	IIssueType,
	IOrganizationProject,
	IOrganizationProjectModule,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IRequestApprovalTeam,
	ITag,
	ITask,
	ITaskPriority,
	ITaskRelatedIssueType,
	ITaskSize,
	ITaskStatus,
	ITaskVersion,
	ITaskView
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	Comment,
	DailyPlan,
	EquipmentSharing,
	Goal,
	ImageAsset,
	IssueType,
	OrganizationProject,
	OrganizationProjectModule,
	OrganizationTeamEmployee,
	RequestApprovalTeam,
	Tag,
	Task,
	TaskPriority,
	TaskRelatedIssueType,
	TaskSize,
	TaskStatus,
	TaskVersion,
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
import { MikroOrmOrganizationTeamRepository } from './repository/mikro-orm-organization-team.repository';

@MultiORMEntity('organization_team', { mikroOrmRepository: () => MikroOrmOrganizationTeamRepository })
export class OrganizationTeam extends TenantOrganizationBaseEntity implements IOrganizationTeam {
	/**
	 * Team name
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	/**
	 * Team color (optional)
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	color?: string;

	/**
	 * Team emoji (optional)
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	emoji?: string;

	/**
	 * Optional property representing the team size.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	teamSize?: string;

	/**
	 * Optional property representing the logo of the organization team.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	logo?: string;

	/**
	 * Optional property representing the prefix for the organization team.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	prefix?: string;

	/**
	 * Optional property representing the team sharing profile views between employees
	 * Default value is set to true
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: true })
	shareProfileView?: boolean;

	/**
	 * Optional property representing the team time tracking required by existing of a daily plan
	 * Default value is set to false
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	requirePlanToTrack?: boolean;

	/**
	 * Optional property representing the team type (boolean true/false).
	 * Default value is set to false.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	public?: boolean;

	/**
	 * Optional property representing the profile link for the organization team.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	profile_link?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The ImageAsset that is associated with this OrganizationTeam.
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		nullable: true, // Indicates that the relation is optional (i.e. the value may be null)
		onDelete: 'SET NULL', // If the referenced ImageAsset is deleted, set this foreign key to NULL.
		eager: true // The related ImageAsset is eagerly loaded, meaning it is automatically fetched with the OrganizationTeam entity.
	})
	@JoinColumn()
	image?: IImageAsset;

	/**
	 * The ID of the ImageAsset that is associated with this OrganizationTeam.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeam) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: ID;
	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationTeamEmployee
	 */
	@MultiORMOneToMany(() => OrganizationTeamEmployee, (it) => it.organizationTeam, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	members?: IOrganizationTeamEmployee[];

	/**
	 * RequestApprovalTeam
	 */
	@MultiORMOneToMany(() => RequestApprovalTeam, (it) => it.team)
	requestApprovals?: IRequestApprovalTeam[];

	/**
	 * Goal
	 */
	@MultiORMOneToMany(() => Goal, (it) => it.ownerTeam)
	goals?: IGoal[];

	/**
	 * Team Statuses
	 */
	@MultiORMOneToMany(() => TaskStatus, (status) => status.organizationTeam)
	statuses?: ITaskStatus[];

	/**
	 * Team Related Status type
	 */
	@MultiORMOneToMany(() => TaskRelatedIssueType, (it) => it.organizationTeam)
	relatedIssueTypes?: ITaskRelatedIssueType[];

	/**
	 * Team Priorities
	 */
	@MultiORMOneToMany(() => TaskPriority, (it) => it.organizationTeam)
	priorities?: ITaskPriority[];

	/**
	 * Team Sizes
	 */
	@MultiORMOneToMany(() => TaskSize, (it) => it.organizationTeam)
	sizes?: ITaskSize[];

	/**
	 * Team Versions
	 */
	@MultiORMOneToMany(() => TaskVersion, (it) => it.organizationTeam)
	versions?: ITaskVersion[];

	/**
	 * Team views
	 */
	@MultiORMOneToMany(() => TaskView, (it) => it.organizationTeam)
	views?: ITaskView[];

	/**
	 * Team Labels
	 */
	@MultiORMOneToMany(() => Tag, (it) => it.organizationTeam)
	labels?: ITag[];

	/**
	 * Team Issue Types
	 */
	@MultiORMOneToMany(() => IssueType, (it) => it.organizationTeam)
	issueTypes?: IIssueType[];

	/**
	 * Team daily plans
	 */
	@MultiORMOneToMany(() => DailyPlan, (dailyPlan) => dailyPlan.organizationTeam, {
		cascade: true
	})
	dailyPlans?: IDailyPlan[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@MultiORMManyToMany(() => Tag, (it) => it.organizationTeams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_team',
		joinColumn: 'organizationTeamId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_organization_team'
	})
	tags?: ITag[];

	/**
	 * Task
	 */
	@MultiORMManyToMany(() => Task, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinTable()
	tasks?: ITask[];

	/**
	 * Organization Project Module
	 */
	@MultiORMManyToMany(() => OrganizationProjectModule, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	modules?: IOrganizationProjectModule[];

	/**
	 * Equipment Sharing
	 */
	@MultiORMManyToMany(() => EquipmentSharing, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	equipmentSharings?: IEquipmentSharing[];

	/**
	 * Organization Project
	 */
	@MultiORMManyToMany(() => OrganizationProject, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	projects?: IOrganizationProject[];

	/**
	 * Comments
	 */
	@MultiORMManyToMany(() => Comment, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	assignedComments?: IComment[];
}

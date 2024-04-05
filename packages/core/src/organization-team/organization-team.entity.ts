import { JoinTable, JoinColumn, RelationId } from 'typeorm';
import {
	IEquipmentSharing,
	IGoal,
	IImageAsset,
	IIssueType,
	IOrganizationProject,
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
	IUser
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	EquipmentSharing,
	Goal,
	ImageAsset,
	IssueType,
	OrganizationProject,
	OrganizationTeamEmployee,
	RequestApprovalTeam,
	Tag,
	Task,
	TaskPriority,
	TaskRelatedIssueType,
	TaskSize,
	TaskStatus,
	TaskVersion,
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
	 * User
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	createdBy?: IUser;

	@RelationId((it: OrganizationTeam) => it.createdBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	createdById?: IUser['id'];

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeam) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: IImageAsset['id'];

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
	 * Team Labels
	 */
	@MultiORMOneToMany(() => Tag, (it) => it.organizationTeam)
	labels?: ITag[];

	/**
	 * Team Issue Types
	 */
	@MultiORMOneToMany(() => IssueType, (it) => it.organizationTeam)
	issueTypes?: IIssueType[];

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
}

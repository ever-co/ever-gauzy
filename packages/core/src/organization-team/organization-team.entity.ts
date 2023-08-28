import {
	Column,
	Entity,
	Index,
	OneToMany,
	ManyToMany,
	JoinTable,
	ManyToOne,
	JoinColumn,
	RelationId,
} from 'typeorm';
import {
	IEquipmentSharing,
	IGoal,
	IImageAsset,
	IIssueType,
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
	IUser,
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
} from 'class-validator';
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
	TaskRelatedIssueTypes,
	TaskSize,
	TaskStatus,
	TaskVersion,
	TenantOrganizationBaseEntity,
	User,
} from '../core/entities/internal';
import { IOrganizationProject } from '@gauzy/contracts';

@Entity('organization_team')
export class OrganizationTeam extends TenantOrganizationBaseEntity implements IOrganizationTeam {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	name: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	color?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	emoji?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	teamSize?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	logo: string;

	/**
	 * prefix for organization team
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	prefix?: string;

	/**
	 * Team type should be boolean true/false
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ nullable: true, default: false })
	public?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	profile_link?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@ManyToOne(() => User, (user) => user.teams, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	createdBy?: IUser;

	@RelationId((it: OrganizationTeam) => it.createdBy)
	@Index()
	@Column({ nullable: true })
	createdById?: IUser['id'];

	/**
	 * ImageAsset
	 */
	@ManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true,
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationTeam) => it.image)
	@Index()
	@Column({ nullable: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * OrganizationTeamEmployee
	 */
	@OneToMany(
		() => OrganizationTeamEmployee,
		(entity) => entity.organizationTeam,
		{
			cascade: true,
		}
	)
	members?: IOrganizationTeamEmployee[];

	/**
	 * RequestApprovalTeam
	 */
	@OneToMany(() => RequestApprovalTeam, (entity) => entity.team)
	requestApprovals?: IRequestApprovalTeam[];

	/**
	 * Goal
	 */
	@OneToMany(() => Goal, (it) => it.ownerTeam, {
		onDelete: 'SET NULL',
	})
	goals?: IGoal[];

	/**
	 * Team Statuses
	 */
	@OneToMany(() => TaskStatus, (status) => status.organizationTeam)
	statuses?: ITaskStatus[];

	/**
	 * Team Related Status type
	 */
	@OneToMany(
		() => TaskRelatedIssueTypes,
		(relatedIssueType) => relatedIssueType.organizationTeam
	)
	relatedIssueTypes?: ITaskRelatedIssueType[];

	/**
	 * Team Priorities
	 */
	@OneToMany(() => TaskPriority, (priority) => priority.organizationTeam)
	priorities?: ITaskPriority[];

	/**
	 * Team Sizes
	 */
	@OneToMany(() => TaskSize, (size) => size.organizationTeam)
	sizes?: ITaskSize[];

	/**
	 * Team Versions
	 */
	@OneToMany(() => TaskVersion, (version) => version.organizationTeam)
	versions?: ITaskVersion[];

	/**
	 * Team Labels
	 */
	@OneToMany(() => Tag, (label) => label.organizationTeam)
	labels?: ITag[];

	/**
	 * Team Issue Types
	 */
	@OneToMany(() => IssueType, (issueType) => issueType.organizationTeam)
	issueTypes?: IIssueType[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ManyToMany(() => Tag, (tag) => tag.organizationTeams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable({
		name: 'tag_organization_team',
	})
	tags?: ITag[];

	/**
	 * Task
	 */
	@ManyToMany(() => Task, (task) => task.teams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	@JoinTable()
	tasks?: ITask[];

	/**
	 * Equipment Sharing
	 */
	@ManyToMany(() => EquipmentSharing, (it) => it.teams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
	})
	equipmentSharings?: IEquipmentSharing[];

	/**
	 * Organization Project
	 */
	@ManyToMany(() => OrganizationProject, (it) => it.teams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	projects?: IOrganizationProject[];
}

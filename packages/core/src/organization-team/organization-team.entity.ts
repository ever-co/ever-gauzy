import {
	Column,
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
import { MultiORMEntity } from './../core/decorators/entity';

@MultiORMEntity('organization_team')
export class OrganizationTeam extends TenantOrganizationBaseEntity implements IOrganizationTeam {

	/**
	 * Team name
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	name: string;

	/**
	 * Team color (optional)
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	color?: string;

	/**
	 * Team emoji (optional)
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	emoji?: string;

	/**
	 * Optional property representing the team size.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	teamSize?: string;

	/**
	 * Optional property representing the logo of the organization team.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	logo?: string;

	/**
	 * Optional property representing the prefix for the organization team.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Column({ nullable: true })
	prefix?: string;

	/**
	 * Optional property representing the team type (boolean true/false).
	 * Default value is set to false.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	@Column({ nullable: true, default: false })
	public?: boolean;

	/**
	 * Optional property representing the profile link for the organization team.
	 */
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
	@ManyToOne(() => User, (it) => it.teams, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
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
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

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
	@OneToMany(() => OrganizationTeamEmployee, (it) => it.organizationTeam, {
		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true
	})
	members?: IOrganizationTeamEmployee[];

	/**
	 * RequestApprovalTeam
	 */
	@OneToMany(() => RequestApprovalTeam, (it) => it.team)
	requestApprovals?: IRequestApprovalTeam[];

	/**
	 * Goal
	 */
	@OneToMany(() => Goal, (it) => it.ownerTeam)
	goals?: IGoal[];

	/**
	 * Team Statuses
	 */
	@OneToMany(() => TaskStatus, (status) => status.organizationTeam)
	statuses?: ITaskStatus[];

	/**
	 * Team Related Status type
	 */
	@OneToMany(() => TaskRelatedIssueTypes, (it) => it.organizationTeam)
	relatedIssueTypes?: ITaskRelatedIssueType[];

	/**
	 * Team Priorities
	 */
	@OneToMany(() => TaskPriority, (it) => it.organizationTeam)
	priorities?: ITaskPriority[];

	/**
	 * Team Sizes
	 */
	@OneToMany(() => TaskSize, (it) => it.organizationTeam)
	sizes?: ITaskSize[];

	/**
	 * Team Versions
	 */
	@OneToMany(() => TaskVersion, (it) => it.organizationTeam)
	versions?: ITaskVersion[];

	/**
	 * Team Labels
	 */
	@OneToMany(() => Tag, (it) => it.organizationTeam)
	labels?: ITag[];

	/**
	 * Team Issue Types
	 */
	@OneToMany(() => IssueType, (it) => it.organizationTeam)
	issueTypes?: IIssueType[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ManyToMany(() => Tag, (it) => it.organizationTeams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_team'
	})
	tags?: ITag[];

	/**
	 * Task
	 */
	@ManyToMany(() => Task, (it) => it.teams, {
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
	@ManyToMany(() => EquipmentSharing, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	equipmentSharings?: IEquipmentSharing[];

	/**
	 * Organization Project
	 */
	@ManyToMany(() => OrganizationProject, (it) => it.teams, {
		/** Defines the database action to perform on update. */
		onUpdate: 'CASCADE',
		/** Defines the database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	projects?: IOrganizationProject[];
}

import { Column, Entity, Index, OneToMany, ManyToMany, JoinTable, ManyToOne, JoinColumn, RelationId } from 'typeorm';
import {
	IEquipmentSharing,
	IGoal,
	IImageAsset,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IRequestApprovalTeam,
	ITag,
	ITask,
	ITaskPriority,
	ITaskSize,
	ITaskStatus,
	IUser
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import {
	EquipmentSharing,
	Goal,
	ImageAsset,
	OrganizationTeamEmployee,
	RequestApprovalTeam,
	Tag,
	Task,
	TaskPriority,
	TaskSize,
	TaskStatus,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('organization_team')
export class OrganizationTeam extends TenantOrganizationBaseEntity implements IOrganizationTeam {
	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	name: string;

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
		onDelete: 'SET NULL'
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
		onDelete: 'SET NULL'
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
	@OneToMany(() => OrganizationTeamEmployee, (entity) => entity.organizationTeam, {
		cascade: true
	})
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
		onDelete: 'SET NULL'
	})
	goals?: IGoal[];

	/**
	 * Team Statuses
	 */
	@OneToMany(() => TaskStatus, (status) => status.organizationTeam)
	statuses?: ITaskStatus[];

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
	 * Team Labels
	 */
	@OneToMany(() => Tag, (label) => label.organizationTeam)
	labels?: ITag[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	@ManyToMany(() => Tag, (tag) => tag.organizationTeams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_team'
	})
	tags?: ITag[];

	/**
	 * Task
	 */
	@ManyToMany(() => Task, (task) => task.teams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable()
	tasks?: ITask[];

	/**
	 * Equipment Sharing
	 */
	@ManyToMany(() => EquipmentSharing, (it) => it.teams, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	equipmentSharings?: IEquipmentSharing[];
}

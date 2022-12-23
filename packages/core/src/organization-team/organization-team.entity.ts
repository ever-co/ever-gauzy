import {
	Column,
	Entity,
	Index,
	OneToMany,
	ManyToMany,
	JoinTable,
	ManyToOne,
	JoinColumn,
	RelationId
} from 'typeorm';
import {
	IEquipmentSharing,
	IGoal,
	IOrganizationTeam,
	IOrganizationTeamEmployee,
	IRequestApprovalTeam,
	ITag,
	ITask,
	IUser
} from '@gauzy/contracts';
import {
	EquipmentSharing,
	Goal,
	OrganizationTeamEmployee,
	RequestApprovalTeam,
	Tag,
	Task,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';

@Entity('organization_team')
export class OrganizationTeam extends TenantOrganizationBaseEntity
	implements IOrganizationTeam {

	@Index()
	@Column()
	name: string;

	/**
	 * prefix for organization team
	 */
	@Column({ nullable: true })
	prefix?: string;

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

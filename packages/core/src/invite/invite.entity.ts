import {
	IInvite,
	InviteStatusEnum,
	IOrganizationDepartment,
	IOrganizationContact,
	IOrganizationProject,
	IUser,
	IRole,
	IOrganizationTeam
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
	JoinColumn,
	JoinTable,
	RelationId
} from 'typeorm';
import {
	OrganizationContact,
	OrganizationDepartment,
	OrganizationProject,
	OrganizationTeam,
	Role,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmInviteRepository } from './repository/mikro-orm-invite.repository';

@MultiORMEntity('invite', { mikroOrmRepository: () => MikroOrmInviteRepository })
export class Invite extends TenantOrganizationBaseEntity implements IInvite {

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn()
	token: string;

	@ApiProperty({ type: () => String, minLength: 3, maxLength: 100 })
	@MultiORMColumn()
	email: string;

	@ApiProperty({ type: () => String, enum: InviteStatusEnum })
	@MultiORMColumn()
	status: InviteStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	expireDate: Date;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	actionDate?: Date;

	@ApiPropertyOptional({ type: () => String })
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	public code?: string;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	public fullName?: string;

	public isExpired?: boolean;
	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Invited By User
	 */
	@ApiPropertyOptional({ type: () => User })
	@MultiORMManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	invitedBy?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Invite) => it.invitedBy)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invitedById: string;

	/**
	 * Invited User Role
	 */
	@ApiPropertyOptional({ type: () => Role })
	@MultiORMManyToOne(() => Role, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	role?: IRole;

	@ApiProperty({ type: () => String })
	@RelationId((invite: Invite) => invite.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId: string;

	/**
	 * Invites belongs to user
	 */
	@ApiPropertyOptional({ type: () => Role })
	@MultiORMManyToOne(() => User, (it) => it.invites, {
		onDelete: "SET NULL"
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((invite: Invite) => invite.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: IUser['id'];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Organization Projects
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@MultiORMManyToMany(() => OrganizationProject, {
		owner: true,
		pivotTable: 'invite_organization_project',
		joinColumn: 'inviteId',
		inverseJoinColumn: 'organizationProjectId',
	})
	@JoinTable({
		name: 'invite_organization_project'
	})
	projects?: IOrganizationProject[];

	/**
	 * Organization Contacts
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@MultiORMManyToMany(() => OrganizationContact, {
		owner: true,
		pivotTable: 'invite_organization_contact',
		joinColumn: 'inviteId',
		inverseJoinColumn: 'organizationContactId',
	})
	@JoinTable({
		name: 'invite_organization_contact'
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * Organization Departments
	 */
	@ApiPropertyOptional({ type: () => OrganizationDepartment })
	@MultiORMManyToMany(() => OrganizationDepartment, {
		owner: true,
		pivotTable: 'invite_organization_department',
		joinColumn: 'inviteId',
		inverseJoinColumn: 'organizationDepartmentId',
	})
	@JoinTable({
		name: 'invite_organization_department'
	})
	departments?: IOrganizationDepartment[];

	/**
	* Organization Teams
	*/
	@ApiPropertyOptional({ type: () => OrganizationTeam })
	@MultiORMManyToMany(() => OrganizationTeam, {
		owner: true,
		pivotTable: 'invite_organization_team',
		joinColumn: 'inviteId',
		inverseJoinColumn: 'organizationTeamId',
	})
	@JoinTable({
		name: 'invite_organization_team'
	})
	teams?: IOrganizationTeam[];
}

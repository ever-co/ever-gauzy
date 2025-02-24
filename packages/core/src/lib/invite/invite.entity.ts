import {
	IInvite,
	InviteStatusEnum,
	IOrganizationDepartment,
	IOrganizationContact,
	IOrganizationProject,
	IUser,
	IRole,
	IOrganizationTeam,
	ID
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import {
	OrganizationContact,
	OrganizationDepartment,
	OrganizationProject,
	OrganizationTeam,
	Role,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	VirtualMultiOrmColumn
} from './../core/decorators/entity';
import { MikroOrmInviteRepository } from './repository/mikro-orm-invite.repository';

@MultiORMEntity('invite', { mikroOrmRepository: () => MikroOrmInviteRepository })
export class Invite extends TenantOrganizationBaseEntity implements IInvite {
	invitedById: string;
	/**
	 * Invite Token
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	token: string;

	/**
	 * Invited Email
	 */
	@ApiProperty({ type: () => String })
	@IsEmail()
	@MultiORMColumn()
	email: string;

	/**
	 * Invited Full Name
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	fullName?: string;

	/**
	 * Invited Status
	 */
	@ApiProperty({ type: () => String, enum: InviteStatusEnum })
	@IsNotEmpty()
	@IsEnum(InviteStatusEnum)
	@MultiORMColumn()
	status: InviteStatusEnum;

	/**
	 * Expire Date
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	expireDate: Date;

	/**
	 * Action Date
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	actionDate?: Date;

	/**
	 * Invited Code
	 */
	@Exclude({ toPlainOnly: true })
	@MultiORMColumn({ nullable: true })
	code?: string;

	/**
	 * Additional Virtual Columns
	 */
	@VirtualMultiOrmColumn()
	isExpired?: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * The associated role for the invite.
	 */
	@ApiPropertyOptional({ type: () => Role })
	@IsOptional()
	@IsObject()
	@MultiORMManyToOne(() => Role, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'CASCADE' // Defines the database cascade action on delete.
	})
	@JoinColumn()
	role?: IRole;

	/**
	 * The identifier for the associated role.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((invite: Invite) => invite.role)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	roleId?: ID;

	/**
	 * The user associated with this invite.
	 */
	@MultiORMManyToOne(() => User, (it) => it.invites, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'SET NULL' // Defines the database cascade action on delete.
	})
	@JoinColumn()
	user?: IUser;

	/**
	 * The identifier of the associated user.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((invite: Invite) => invite.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: ID;

	/**
	 * The user who issued the invite.
	 */
	@MultiORMManyToOne(() => User, {
		nullable: true, // Indicates if the relation column value can be nullable or not.
		onDelete: 'CASCADE' // Defines the database cascade action on delete.
	})
	@JoinColumn()
	invitedByUser?: IUser;

	/**
	 * The identifier of the user who issued the invite.
	 */
	@RelationId((invite: Invite) => invite.invitedByUser)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	invitedByUserId?: ID;
	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Organization Projects Invites
	 */
	@MultiORMManyToMany(() => OrganizationProject, {
		owner: true, // Indicates if the relation column value is the owner of the relation.
		pivotTable: 'invite_organization_project', // Defines the pivot table name.
		joinColumn: 'inviteId', // Defines the join column name.
		inverseJoinColumn: 'organizationProjectId' // Defines the inverse join column name.
	})
	@JoinTable({ name: 'invite_organization_project' })
	projects?: IOrganizationProject[];

	/**
	 * Organization Contacts Invites
	 */
	@MultiORMManyToMany(() => OrganizationContact, {
		owner: true, // Indicates if the relation column value is the owner of the relation.
		pivotTable: 'invite_organization_contact', // Defines the pivot table name.
		joinColumn: 'inviteId', // Defines the join column name.
		inverseJoinColumn: 'organizationContactId' // Defines the inverse join column name.
	})
	@JoinTable({ name: 'invite_organization_contact' })
	organizationContacts?: IOrganizationContact[];

	/**
	 * Organization Departments Invites
	 */
	@MultiORMManyToMany(() => OrganizationDepartment, {
		owner: true, // Indicates if the relation column value is the owner of the relation.
		pivotTable: 'invite_organization_department', // Defines the pivot table name.
		joinColumn: 'inviteId', // Defines the join column name.
		inverseJoinColumn: 'organizationDepartmentId' // Defines the inverse join column name.
	})
	@JoinTable({ name: 'invite_organization_department' })
	departments?: IOrganizationDepartment[];

	/**
	 * Organization Teams Invites
	 */
	@MultiORMManyToMany(() => OrganizationTeam, {
		owner: true, // Indicates if the relation column value is the owner of the relation.
		pivotTable: 'invite_organization_team', // Defines the pivot table name.
		joinColumn: 'inviteId', // Defines the join column name.
		inverseJoinColumn: 'organizationTeamId' // Defines the inverse join column name.
	})
	@JoinTable({ name: 'invite_organization_team' })
	teams?: IOrganizationTeam[];
}

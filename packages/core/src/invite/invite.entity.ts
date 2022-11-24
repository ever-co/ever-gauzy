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
	Column,
	Entity,
	Index,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
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

@Entity('invite')
export class Invite extends TenantOrganizationBaseEntity implements IInvite {

	@ApiPropertyOptional({ type: () => String })
	@Index({ unique: true })
	@Column()
	token: string;

	@ApiPropertyOptional({ type: () => Number })
	@Exclude({ toPlainOnly: true })
	@Column({ nullable: true })
	public code?: number;

	@ApiProperty({ type: () => String, minLength: 3, maxLength: 100 })
	@Index({ unique: true })
	@Column()
	email: string;

	@ApiProperty({ type: () => String, enum: InviteStatusEnum })
	@Column()
	status: InviteStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	expireDate: Date;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	actionDate?: Date;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	/**
	 * Invited By User
	 */
	@ApiPropertyOptional({ type: () => User })
	@ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	invitedBy?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: Invite) => it.invitedBy)
	@Index()
	@Column({ nullable: true })
	invitedById: string;

	/**
	 * Invited User Role
	 */
	@ApiPropertyOptional({ type: () => Role })
	@ManyToOne(() => Role, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	role?: IRole;

	@ApiProperty({ type: () => String })
	@RelationId((invite: Invite) => invite.role)
	@Index()
	@Column({ nullable: true })
	roleId: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */
   /**
	* Organization Projects
    */
	@ApiPropertyOptional({ type: () => OrganizationProject })
	@ManyToMany(() => OrganizationProject)
	@JoinTable({
		name: 'invite_organization_project'
	})
	projects?: IOrganizationProject[];

	/**
	 * Organization Contacts
	 */
	@ApiPropertyOptional({ type: () => OrganizationContact })
	@ManyToMany(() => OrganizationContact)
	@JoinTable({
		name: 'invite_organization_contact'
	})
	organizationContacts?: IOrganizationContact[];

	/**
	 * Organization Departments
	 */
	@ApiPropertyOptional({ type: () => OrganizationDepartment })
	@ManyToMany(() => OrganizationDepartment)
	@JoinTable({
		name: 'invite_organization_department'
	})
	departments?: IOrganizationDepartment[];

	/**
	* Organization Teams
    */
	@ApiPropertyOptional({ type: () => OrganizationTeam })
	@ManyToMany(() => OrganizationTeam)
	@JoinTable({
		name: 'invite_organization_team'
	})
	teams?: IOrganizationTeam[];
}

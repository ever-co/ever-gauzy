import {
	IInvite,
	InviteStatusEnum,
	IOrganizationDepartment,
	IOrganizationContact,
	IOrganizationProject,
	IUser,
	IRole
} from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
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
	Role,
	TenantOrganizationBaseEntity,
	User
} from '../core/entities/internal';
@Entity('invite')
export class Invite extends TenantOrganizationBaseEntity implements IInvite {
	@ApiPropertyOptional({ type: String })
	@IsString()
	@Index({ unique: true })
	@Column()
	token: string;

	@ApiProperty({ type: String, minLength: 3, maxLength: 100 })
	@IsEmail()
	@IsNotEmpty()
	@Index({ unique: true })
	@Column()
	email: string;

	@ApiProperty({ type: String })
	@RelationId((invite: Invite) => invite.role)
	@Column()
	roleId: string;

	@ApiProperty({ type: String })
	@RelationId((invite: Invite) => invite.invitedBy)
	@Column()
	invitedById: string;

	@ApiProperty({ type: String, enum: InviteStatusEnum })
	@IsEnum(InviteStatusEnum)
	@IsNotEmpty()
	@Column()
	status: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@Column()
	expireDate: Date;

	@ApiPropertyOptional({ type: Role })
	@ManyToOne(() => Role, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	role?: IRole;

	@ApiPropertyOptional({ type: User })
	@ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	invitedBy?: IUser;

	@ManyToMany(() => OrganizationProject)
	@JoinTable({
		name: 'invite_organization_project'
	})
	projects?: IOrganizationProject[];

	@ManyToMany(() => OrganizationContact)
	@JoinTable({
		name: 'invite_organization_contact'
	})
	organizationContact?: IOrganizationContact[];

	@ManyToMany(() => OrganizationDepartment)
	@JoinTable({
		name: 'invite_organization_department'
	})
	departments?: IOrganizationDepartment[];
}

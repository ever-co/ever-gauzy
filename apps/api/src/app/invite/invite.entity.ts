import { Invite as IInvite, InviteStatusEnum } from '@gauzy/models';
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
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Role } from '../role/role.entity';
import { User } from '../user/user.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';

@Entity('invite')
export class Invite extends Base implements IInvite {
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
	@RelationId((invite: Invite) => invite.organization)
	@IsNotEmpty()
	@Column()
	organizationId: string;

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
	@ManyToOne((type) => Role, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	role?: Role;

	@ApiPropertyOptional({ type: Organization })
	@ManyToOne((type) => Organization, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	organization?: Organization;

	@ApiPropertyOptional({ type: User })
	@ManyToOne((type) => User, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	invitedBy?: User;

	@ManyToMany((type) => OrganizationProjects)
	@JoinTable({
		name: 'invite_organization_project'
	})
	projects?: OrganizationProjects[];

	@ManyToMany((type) => OrganizationClients)
	@JoinTable({
		name: 'invite_organization_client'
	})
	clients?: OrganizationClients[];

	@ManyToMany((type) => OrganizationDepartment)
	@JoinTable({
		name: 'invite_organization_department'
	})
	departments?: OrganizationDepartment[];
}

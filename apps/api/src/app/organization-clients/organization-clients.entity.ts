import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	OneToMany,
	JoinTable,
	OneToOne,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsEmail,
	IsOptional,
	IsNumber,
	IsEnum
} from 'class-validator';
import { Base } from '../core/entities/base';
import {
	OrganizationClients as IOrganizationClients,
	ClientOrganizationInviteStatus
} from '@gauzy/models';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';

@Entity('organization_client')
export class OrganizationClients extends Base implements IOrganizationClients {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	organizationId: string;

	@ApiProperty({ type: String })
	@IsEmail()
	@IsNotEmpty()
	@Column()
	primaryEmail: string;

	@ApiPropertyOptional({ type: String, isArray: true })
	emailAddresses?: string[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	primaryPhone: string;

	@ApiPropertyOptional({ type: String, isArray: true })
	phones?: string[];

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	country?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	street?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	city?: string;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true })
	zipCode?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	state?: string;

	@ApiProperty({ type: String, enum: ClientOrganizationInviteStatus })
	@IsEnum(ClientOrganizationInviteStatus)
	@IsOptional()
	@Column({ nullable: true })
	inviteStatus?: string;

	@ApiProperty({ type: Organization })
	@OneToOne((type) => Organization, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	clientOrganization?: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((client: OrganizationClients) => client.clientOrganization)
	@Column({ nullable: true })
	readonly clientOrganizationId?: string;

	@ApiPropertyOptional({ type: OrganizationProjects, isArray: true })
	@OneToMany(
		(type) => OrganizationProjects,
		(projects) => projects.client
	)
	@JoinColumn()
	projects?: OrganizationProjects[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_client_employee'
	})
	members?: Employee[];
}

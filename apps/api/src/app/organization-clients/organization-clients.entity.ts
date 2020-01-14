import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	OneToMany,
	JoinTable
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsEmail,
	IsOptional,
	IsNumber
} from 'class-validator';
import { Base } from '../core/entities/base';
import { Organization } from '../organization/organization.entity';
import { OrganizationClients as IOrganizationClients } from '@gauzy/models';
import { OrganizationProjects } from '../organization-projects';
import { Employee } from '../employee';

@Entity('organization_clients')
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
	@IsNotEmpty()
	@Column()
	country: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	street: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	city: string;

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

	@ApiPropertyOptional({ type: OrganizationProjects, isArray: true })
	@OneToMany((type) => OrganizationProjects, (projects) => projects.client)
	@JoinColumn()
	projects?: OrganizationProjects[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_clients_employee'
	})
	members?: Employee[];
}

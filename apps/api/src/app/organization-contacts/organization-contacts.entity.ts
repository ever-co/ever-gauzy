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
	OrganizationContacts as IOrganizationContacts,
	ClientOrganizationInviteStatus
} from '@gauzy/models';

import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Contact } from '../contact/contact.entity';

@Entity('organization_contact')
export class OrganizationContacts extends Contact
	implements IOrganizationContacts {
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

	@ApiPropertyOptional({ type: String, isArray: true })
	emailAddresses?: string[];

	@ApiPropertyOptional({ type: String, isArray: true })
	phones?: string[];

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
	@RelationId((contact: OrganizationContacts) => contact.clientOrganization)
	@Column({ nullable: true })
	readonly clientOrganizationId?: string;

	@ApiPropertyOptional({ type: OrganizationProjects, isArray: true })
	@OneToMany(
		(type) => OrganizationProjects,
		(projects) => projects.contact
	)
	@JoinColumn()
	projects?: OrganizationProjects[];

	@ApiPropertyOptional({ type: Invoice, isArray: true })
	@OneToMany(
		(type) => Invoice,
		(invoices) => invoices.toClient
	)
	@JoinColumn()
	invoices?: Invoice[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_contact_employee'
	})
	members?: Employee[];

	@ManyToMany(
		(type) => Contact,
		(contact) => contact.id,
		{ cascade: ['update'] }
	)
	@JoinTable({
		name: 'organization_contact_contact'
	})
	@JoinColumn()
	contact?: Contact;
}

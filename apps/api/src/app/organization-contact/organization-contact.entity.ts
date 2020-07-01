import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	OneToMany,
	JoinTable,
	OneToOne,
	RelationId,
	ManyToOne
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsString,
	IsEmail,
	IsOptional,
	IsEnum
} from 'class-validator';
import {
	OrganizationContact as IOrganizationContact,
	ContactOrganizationInviteStatus
} from '@gauzy/models';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Employee } from '../employee/employee.entity';
import { Organization } from '../organization/organization.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Tag } from '../tags/tag.entity';
import { Contact } from '../contact/contact.entity';
import { Base } from '../core/entities/base';

@Entity('organization_contact')
export class OrganizationContact extends Base implements IOrganizationContact {
	@ApiProperty()
	@ManyToMany((type) => Tag, (tag) => tag.organizationContact)
	@JoinTable({
		name: 'tag_organization_contact'
	})
	tags: Tag[];

	@ApiProperty({ type: Contact })
	@ManyToOne(() => Contact, { nullable: true, cascade: true })
	@JoinColumn()
	contact: Contact;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId(
		(organizationContact: OrganizationContact) =>
			organizationContact.contact
	)
	readonly contactId?: string;

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
	@Column({ nullable: true })
	primaryEmail: string;

	@ApiPropertyOptional({ type: String, isArray: true })
	emailAddresses?: string[];

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	primaryPhone: string;

	@ApiPropertyOptional({ type: String, isArray: true })
	phones?: string[];

	@ApiProperty({ type: String, enum: ContactOrganizationInviteStatus })
	@IsEnum(ContactOrganizationInviteStatus)
	@IsOptional()
	@Column({ nullable: true })
	inviteStatus?: string;

	@ApiProperty({ type: Organization })
	@OneToOne((type) => Organization, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn()
	contactOrganization?: Organization;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((contact: OrganizationContact) => contact.contactOrganization)
	@Column({ nullable: true })
	readonly contactOrganizationId?: string;

	@ApiPropertyOptional({ type: OrganizationProjects, isArray: true })
	@OneToMany(
		(type) => OrganizationProjects,
		(projects) => projects.organizationContact
	)
	@JoinColumn()
	projects?: OrganizationProjects[];

	@ApiPropertyOptional({ type: Invoice, isArray: true })
	@OneToMany((type) => Invoice, (invoices) => invoices.toClient)
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
}

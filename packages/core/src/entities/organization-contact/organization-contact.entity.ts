import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	OneToMany,
	JoinTable,
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
	IOrganizationContact,
	ContactOrganizationInviteStatus,
	ContactType,
	ITag,
	IContact,
	IOrganizationProject,
	IInvoice,
	IEmployee,
	IPayment,
	OrganizationContactBudgetTypeEnum,
	DeepPartial
} from '@gauzy/common';
import {
	Contact,
	Employee,
	Invoice,
	OrganizationProject,
	Payment,
	Proposal,
	Tag,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('organization_contact')
export class OrganizationContact
	extends TenantOrganizationBaseEntity
	implements IOrganizationContact {
	constructor(input?: DeepPartial<OrganizationContact>) {
		super(input);
	}

	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationContact)
	@JoinTable({
		name: 'tag_organization_contact'
	})
	tags: ITag[];

	@ApiProperty({ type: Contact })
	@ManyToOne(() => Contact, (contact) => contact.organization_contacts, {
		cascade: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact: IContact;

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

	@ApiPropertyOptional({ type: OrganizationProject, isArray: true })
	@OneToMany(
		() => OrganizationProject,
		(project) => project.organizationContact
	)
	@JoinColumn()
	projects?: IOrganizationProject[];

	@ApiPropertyOptional({ type: Invoice, isArray: true })
	@OneToMany((type) => Invoice, (invoices) => invoices.toContact)
	@JoinColumn()
	invoices?: IInvoice[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ManyToMany((type) => Employee, { cascade: ['update'] })
	@JoinTable({
		name: 'organization_contact_employee'
	})
	members?: IEmployee[];

	@ApiProperty({ type: String, enum: ContactType })
	@IsEnum(ContactType)
	@IsOptional()
	@Column({ nullable: false })
	contactType: string;

	@ApiPropertyOptional({ type: String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: Payment, isArray: true })
	@OneToMany((type) => Payment, (payment) => payment.contact, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	@ApiPropertyOptional({ type: Proposal, isArray: true })
	@OneToMany(() => Proposal, (proposal) => proposal.organizationContact)
	@JoinColumn()
	proposals?: IOrganizationProject[];

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	budget?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({
		type: 'text',
		nullable: true,
		default: OrganizationContactBudgetTypeEnum.COST
	})
	budgetType?: OrganizationContactBudgetTypeEnum;

	@ApiProperty({ type: String })
	@IsOptional()
	@Column({ nullable: true })
	createdBy?: string;
}

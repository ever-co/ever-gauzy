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
	IExpense,
	ITimeLog
} from '@gauzy/contracts';
import {
	Contact,
	Employee,
	Expense,
	Invoice,
	OrganizationProject,
	Payment,
	Proposal,
	Tag,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../core/entities/internal';

@Entity('organization_contact')
export class OrganizationContact
	extends TenantOrganizationBaseEntity
	implements IOrganizationContact {
	
	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsEmail()
	@IsNotEmpty()
	@Column({ nullable: true })
	primaryEmail: string;

	@ApiPropertyOptional({ type: () => String, isArray: true })
	emailAddresses?: string[];

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	primaryPhone: string;

	@ApiPropertyOptional({ type: () => String, isArray: true })
	phones?: string[];

	@ApiProperty({ type: () => String, enum: ContactOrganizationInviteStatus })
	@IsEnum(ContactOrganizationInviteStatus)
	@IsOptional()
	@Column({ nullable: true })
	inviteStatus?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: () => String, enum: ContactType })
	@IsEnum(ContactType)
	@IsOptional()
	@Column({ nullable: false })
	contactType: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	budget?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsString()
	@IsOptional()
	@Column({
		type: 'text',
		nullable: true,
		default: OrganizationContactBudgetTypeEnum.COST
	})
	budgetType?: OrganizationContactBudgetTypeEnum;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@Column({ nullable: true })
	createdBy?: string;

	/*
    |--------------------------------------------------------------------------
    | @ManyToOne 
    |--------------------------------------------------------------------------
    */
	// Client Contact 
	@ApiProperty({ type: () => Contact })
	@ManyToOne(() => Contact, (contact) => contact.organization_contacts, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: OrganizationContact) => it.contact)
	@IsString()
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany 
    |--------------------------------------------------------------------------
    */
	// Organization Projects
	@ApiPropertyOptional({ type: () => OrganizationProject, isArray: true })
	@OneToMany(() => OrganizationProject, (it) => it.organizationContact)
	projects?: IOrganizationProject[];

	// Organization Invoices
	@ApiPropertyOptional({ type: () => Invoice, isArray: true })
	@OneToMany(() => Invoice, (it) => it.toContact)
	@JoinColumn()
	invoices?: IInvoice[];

	// Organization Payments
	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@OneToMany(() => Payment, (it) => it.contact, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	// Organization Proposals
	@ApiPropertyOptional({ type: () => Proposal, isArray: true })
	@OneToMany(() => Proposal, (it) => it.organizationContact)
	@JoinColumn()
	proposals?: IOrganizationProject[];

	/**
	 * Expense
	 */
	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@OneToMany(() => Expense, (it) => it.organizationContact, {
		onDelete: 'SET NULL'
	})
	expenses?: IExpense[];


	/**
	 * TimeLog
	 */
	@ApiPropertyOptional({ type: () => TimeLog, isArray: true })
	@OneToMany(() => TimeLog, (it) => it.organizationContact)
	timeLogs?: ITimeLog[];
	
	/*
    |--------------------------------------------------------------------------
    | @ManyToMany 
    |--------------------------------------------------------------------------
    */
	// Organization Contact Tags
	@ApiProperty()
	@ManyToMany(() => Tag, (tag) => tag.organizationContact)
	@JoinTable({
		name: 'tag_organization_contact'
	})
	tags: ITag[];

	// Organization Contact Employees
	@ManyToMany(() => Employee, (it) => it.organizationContacts,  {
        onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
    })
	members?: IEmployee[];
}

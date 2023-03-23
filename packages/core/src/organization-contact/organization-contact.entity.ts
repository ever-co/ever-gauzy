import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToMany,
	OneToMany,
	JoinTable,
	RelationId,
	OneToOne,
	ManyToOne
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
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
	ITimeLog,
	IIncome,
	IImageAsset
} from '@gauzy/contracts';
import {
	Contact,
	Employee,
	Expense,
	ImageAsset,
	Income,
	Invoice,
	OrganizationProject,
	Payment,
	Proposal,
	Tag,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../core/entities/internal';

@Entity('organization_contact')
export class OrganizationContact extends TenantOrganizationBaseEntity
	implements IOrganizationContact {

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	primaryEmail: string;

	@ApiPropertyOptional({ type: () => String, isArray: true })
	emailAddresses?: string[];

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	primaryPhone: string;

	@ApiProperty({ type: () => String, enum: ContactOrganizationInviteStatus })
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: ContactOrganizationInviteStatus
	})
	inviteStatus?: ContactOrganizationInviteStatus;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	notes?: string;

	@ApiProperty({ type: () => String, enum: ContactType })
	@Column({
		type: 'simple-enum',
		nullable: false,
		enum: ContactType,
		default: ContactType.CLIENT
	})
	contactType: ContactType;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true })
	budget?: number;

	@ApiPropertyOptional({ type: () => String })
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: OrganizationContactBudgetTypeEnum,
		default: OrganizationContactBudgetTypeEnum.COST
	})
	budgetType?: OrganizationContactBudgetTypeEnum;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	createdBy?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Contact
	 */
	@ApiProperty({ type: () => Contact })
	@OneToOne(() => Contact, (contact) => contact.organizationContact, {
		cascade: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@RelationId((it: OrganizationContact) => it.contact)
	@Index()
	@Column({ nullable: true })
	contactId?: IContact['id'];

	/**
	 * ImageAsset
	 */
	@ManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	image?: IImageAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationContact) => it.image)
	@Index()
	@Column({ nullable: true })
	imageId?: IImageAsset['id'];

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	// Organization Projects
	@ApiPropertyOptional({ type: () => OrganizationProject, isArray: true })
	@OneToMany(() => OrganizationProject, (it) => it.organizationContact, { cascade: true })
	projects?: IOrganizationProject[];

	// Organization Invoices
	@ApiPropertyOptional({ type: () => Invoice, isArray: true })
	@OneToMany(() => Invoice, (it) => it.toContact)
	@JoinColumn()
	invoices?: IInvoice[];

	// Organization Payments
	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@OneToMany(() => Payment, (it) => it.organizationContact, {
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
	 * Income
	 */
	@ApiPropertyOptional({ type: () => Income, isArray: true })
	@OneToMany(() => Income, (it) => it.client, {
		onDelete: 'SET NULL'
	})
	incomes?: IIncome[];

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
	@ManyToMany(() => Tag, (tag) => tag.organizationContacts, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization_contact'
	})
	tags: ITag[];

	// Organization Contact Employees
	@ManyToMany(() => Employee, (it) => it.organizationContacts, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'organization_contact_employee'
	})
	members?: IEmployee[];
}

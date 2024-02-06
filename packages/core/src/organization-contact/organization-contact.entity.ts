import {
	Column,
	Index,
	JoinColumn,
	JoinTable,
	RelationId
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
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationContactRepository } from './repository/mikro-orm-organization-contact.repository';
import { MultiORMManyToMany, MultiORMManyToOne, MultiORMOneToMany, MultiORMOneToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_contact', { mikroOrmRepository: () => MikroOrmOrganizationContactRepository })
export class OrganizationContact extends TenantOrganizationBaseEntity
	implements IOrganizationContact {

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	primaryEmail: string;

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
	@MultiORMOneToOne(() => Contact, (contact) => contact.organizationContact, {
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',
		owner: true
	})
	@JoinColumn()
	contact?: IContact;

	@ApiProperty({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationContact) => it.contact)
	@Index()
	@Column({ nullable: true })
	contactId?: IContact['id'];

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
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
	/**
	 * Organization Projects Relationship
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject, isArray: true })
	@MultiORMOneToMany(() => OrganizationProject, (it) => it.organizationContact, {
		cascade: true
	})
	projects?: IOrganizationProject[];

	// Organization Invoices
	@ApiPropertyOptional({ type: () => Invoice, isArray: true })
	@MultiORMOneToMany(() => Invoice, (it) => it.toContact)
	@JoinColumn()
	invoices?: IInvoice[];

	// Organization Payments
	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@MultiORMOneToMany(() => Payment, (it) => it.organizationContact, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	// Organization Proposals
	@ApiPropertyOptional({ type: () => Proposal, isArray: true })
	@MultiORMOneToMany(() => Proposal, (it) => it.organizationContact)
	@JoinColumn()
	proposals?: IOrganizationProject[];

	/**
	 * Expense
	 */
	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@MultiORMOneToMany(() => Expense, (it) => it.organizationContact, {
		onDelete: 'SET NULL'
	})
	expenses?: IExpense[];

	/**
	 * Income
	 */
	@ApiPropertyOptional({ type: () => Income, isArray: true })
	@MultiORMOneToMany(() => Income, (it) => it.client, {
		onDelete: 'SET NULL'
	})
	incomes?: IIncome[];

	/**
	 * TimeLog
	 */
	@ApiPropertyOptional({ type: () => TimeLog, isArray: true })
	@MultiORMOneToMany(() => TimeLog, (it) => it.organizationContact)
	timeLogs?: ITimeLog[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Organization Contact Tags
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationContacts, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_contact',
	})
	@JoinTable({
		name: 'tag_organization_contact'
	})
	tags: ITag[];

	// Organization Contact Employees
	@MultiORMManyToMany(() => Employee, (it) => it.organizationContacts, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'organization_contact_employee',
	})
	@JoinTable({
		name: 'organization_contact_employee'
	})
	members?: IEmployee[];
}

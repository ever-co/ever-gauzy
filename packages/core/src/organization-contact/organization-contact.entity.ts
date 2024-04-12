import {
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
	// Proposal,
	Tag,
	TenantOrganizationBaseEntity,
	TimeLog
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	MultiORMOneToOne
} from './../core/decorators/entity';
import { MikroOrmOrganizationContactRepository } from './repository/mikro-orm-organization-contact.repository';

@MultiORMEntity('organization_contact', { mikroOrmRepository: () => MikroOrmOrganizationContactRepository })
export class OrganizationContact extends TenantOrganizationBaseEntity implements IOrganizationContact {

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	primaryEmail: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
	primaryPhone: string;

	@ApiProperty({ type: () => String, enum: ContactOrganizationInviteStatus })
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: ContactOrganizationInviteStatus })
	inviteStatus?: ContactOrganizationInviteStatus;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({ nullable: true })
	notes?: string;

	@ApiProperty({ type: () => String, enum: ContactType })
	@MultiORMColumn({ type: 'simple-enum', enum: ContactType, default: ContactType.CLIENT })
	contactType: ContactType;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@MultiORMColumn({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiPropertyOptional({ type: () => Number })
	@MultiORMColumn({ nullable: true })
	budget?: number;

	@ApiPropertyOptional({ type: () => String })
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: OrganizationContactBudgetTypeEnum,
		default: OrganizationContactBudgetTypeEnum.COST
	})
	budgetType?: OrganizationContactBudgetTypeEnum;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: true })
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
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** If set to true then it means that related object can be allowed to be inserted or updated in the database. */
		cascade: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.  */
		owner: true
	})
	@JoinColumn()
	contact?: IContact;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationContact) => it.contact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: IContact['id'];

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
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
		joinColumn: 'organizationContactId',
		inverseJoinColumn: 'tagId',
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
		joinColumn: 'organizationContactId',
		inverseJoinColumn: 'employeeId',
	})
	@JoinTable({
		name: 'organization_contact_employee'
	})
	members?: IEmployee[];
}

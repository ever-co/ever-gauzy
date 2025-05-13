import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsEmail,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength
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
	ITimeLog,
	IIncome,
	IImageAsset,
	ID
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
import { Trimmed } from '../shared/decorators';

@MultiORMEntity('organization_contact', { mikroOrmRepository: () => MikroOrmOrganizationContactRepository })
export class OrganizationContact extends TenantOrganizationBaseEntity implements IOrganizationContact {
	/**
	 * Represents the name of the organization contact.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	/**
	 * Represents the primary email of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEmail()
	@Trimmed()
	@MultiORMColumn({ nullable: true })
	primaryEmail: string;

	/**
	 * Represents the primary phone of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	primaryPhone: string;

	/**
	 * Represents the invite status of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactOrganizationInviteStatus })
	@IsOptional()
	@IsEnum(ContactOrganizationInviteStatus)
	@MultiORMColumn({ type: 'simple-enum', nullable: true, enum: ContactOrganizationInviteStatus })
	inviteStatus?: ContactOrganizationInviteStatus;

	/**
	 * Represents the notes of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	notes?: string;

	/**
	 * Represents the contact type of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactType })
	@IsOptional()
	@IsEnum(ContactType)
	@MultiORMColumn({ type: 'simple-enum', enum: ContactType, default: ContactType.CLIENT })
	contactType: ContactType;

	/**
	 * Represents the image URL of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ nullable: true, length: 500 })
	imageUrl?: string;

	/**
	 * Represents the budget of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	budget?: number;

	/**
	 * Represents the budget type of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsEnum(OrganizationContactBudgetTypeEnum)
	@MultiORMColumn({
		nullable: true,
		type: 'simple-enum',
		enum: OrganizationContactBudgetTypeEnum,
		default: OrganizationContactBudgetTypeEnum.COST
	})
	budgetType?: OrganizationContactBudgetTypeEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Represents the contact of the organization contact.
	 */
	@ApiProperty({ type: () => Contact })
	@MultiORMOneToOne(() => Contact, (contact) => contact.organizationContact, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		cascade: true, // If set to true then it means that related object can be allowed to be inserted or updated in the database.
		onDelete: 'SET NULL', // Database cascade action on delete.
		owner: true // This column is a boolean flag indicating whether the current entity is the 'owning' side of a relationship.
	})
	@JoinColumn()
	contact?: IContact;

	/**
	 * Represents the ID of the contact of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationContact) => it.contact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: ID;

	/**
	 * Represents the image of the organization contact.
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		nullable: true, // Indicates if relation column value can be nullable or not.
		onDelete: 'SET NULL', // Database cascade action on delete.
		eager: true // Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods.
	})
	@JoinColumn()
	image?: IImageAsset;

	/**
	 * Represents the ID of the image of the organization contact.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationContact) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Organization Projects Relationship
	 */
	@ApiPropertyOptional({ type: () => OrganizationProject, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => OrganizationProject, (it) => it.organizationContact, { cascade: true })
	projects?: IOrganizationProject[];

	/**
	 *  Invoices Relationship
	 */
	@ApiPropertyOptional({ type: () => Invoice, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => Invoice, (it) => it.toContact)
	@JoinColumn()
	invoices?: IInvoice[];

	/**
	 * Organization Payments Relationship
	 */
	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => Payment, (it) => it.organizationContact, { onDelete: 'SET NULL' })
	@JoinColumn()
	payments?: IPayment[];

	/**
	 * Organization Expenses Relationship
	 */
	@ApiPropertyOptional({ type: () => Expense, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => Expense, (it) => it.organizationContact, { onDelete: 'SET NULL' })
	expenses?: IExpense[];

	/**
	 * Organization Incomes Relationship
	 */
	@ApiPropertyOptional({ type: () => Income, isArray: true })
	@IsOptional()
	@IsArray()
	@MultiORMOneToMany(() => Income, (it) => it.client, { onDelete: 'SET NULL' })
	incomes?: IIncome[];

	/**
	 * Time Logs Relationship
	 */
	@ApiPropertyOptional({ type: () => TimeLog, isArray: true })
	@MultiORMOneToMany(() => TimeLog, (it) => it.organizationContact)
	timeLogs?: ITimeLog[];

	/*
	|--------------------------	------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	/**
	 * Organization Contact Tags
	 */
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationContacts, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_contact',
		joinColumn: 'organizationContactId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({ name: 'tag_organization_contact' })
	tags?: ITag[];

	/**
	 * Organization Contact Employees
	 */
	@MultiORMManyToMany(() => Employee, (it) => it.organizationContacts, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'organization_contact_employee',
		joinColumn: 'organizationContactId',
		inverseJoinColumn: 'employeeId'
	})
	@JoinTable({ name: 'organization_contact_employee' })
	members?: IEmployee[];
}

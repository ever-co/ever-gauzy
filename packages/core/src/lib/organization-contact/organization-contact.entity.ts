import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsEmail,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Length,
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
	TaxRegistrationScheme,
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
	JsonColumn,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany,
	MultiORMOneToOne
} from './../core/decorators/entity';
import { ContactStatus, PartyKind } from '../core/enums/kernel-extension.enums';
import { ColumnNumericTransformerPipe } from './../shared/pipes';
import { MikroOrmOrganizationContactRepository } from './repository/mikro-orm-organization-contact.repository';
import { Trimmed } from '../shared/decorators';

/**
 * The party row: the customer, the client, the lead and the seller contact are all this entity.
 *
 * Everything a commercial relationship needs to know about the party is a column here rather than a
 * second table, because a parallel 1:1 row would have no meaning of its own — every read would have to
 * join it back and every write would have to keep two rows consistent. The references into tables a
 * capability package owns (`priceListId`, `taxCategoryId`, `taxRegimeId`, `paymentTermId`) are carried
 * as the queryable column without their foreign keys; the owning set adds the constraint.
 */
@ColumnIndex('UQ_organization_contact_org_external', ['organizationId', 'externalId'], {
	unique: true,
	where: '"externalId" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('UQ_organization_contact_org_email', ['organizationId', 'emailKey'], {
	unique: true,
	where: '"emailKey" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_organization_contact_email_lookup', ['tenantId', 'emailKey'], {
	where: '"emailKey" IS NOT NULL AND "deletedAt" IS NULL'
})
@ColumnIndex('IDX_organization_contact_org_status', ['organizationId', 'status'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_organization_contact_user', ['userId'], { where: '"userId" IS NOT NULL' })
@ColumnIndex('IDX_organization_contact_price_list', ['priceListId'], { where: '"priceListId" IS NOT NULL' })
@ColumnIndex('IDX_organization_contact_tax_category', ['taxCategoryId'], { where: '"taxCategoryId" IS NOT NULL' })
@ColumnIndex('IDX_organization_contact_org_kind', ['organizationId', 'partyKind'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_organization_contact_payment_term', ['paymentTermId'], { where: '"paymentTermId" IS NOT NULL' })
@ColumnIndex('IDX_organization_contact_tax_regime', ['taxRegimeId'], { where: '"taxRegimeId" IS NOT NULL' })
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

	/**
	 * Set when the contact is also a staff user; null for a contact who never logs into the back
	 * office. The link between the commercial party and the staff identity is a property of the party.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	userId?: ID;

	/**
	 * The channel the relationship was acquired through.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	channelId?: ID;

	/**
	 * The commercial lifecycle of the party. `BLOCKED` has to be readable wherever the party is read,
	 * not in a table a checkout may forget to join, which is why it is a column here.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactStatus, default: ContactStatus.ACTIVE })
	@IsEnum(ContactStatus)
	@MultiORMColumn({ type: 'simple-enum', enum: ContactStatus, default: ContactStatus.ACTIVE })
	status?: ContactStatus;

	/**
	 * The price list assigned to this party. It wins over a group list and over the default list. The
	 * constraint is added by the pricing package's set, which creates the target table.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	priceListId?: ID;

	/**
	 * Party-wide tax exemption (an export customer, an exempt institution).
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	taxExempt?: boolean;

	/**
	 * The tax category applied to this party's lines when the variant's own category does not govern.
	 * The constraint is added by the tax package's set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	taxCategoryId?: ID;

	/**
	 * Ceiling on outstanding credit; null means no credit facility.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	creditLimit?: number;

	/**
	 * Outstanding credit, re-derived from the order and refund ledgers by the nightly reconciliation.
	 * It is the counterpart of `creditLimit` on the same row, so the ceiling check is one comparison
	 * and the two numbers cannot drift apart across rows.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	creditUsed?: number;

	/**
	 * Net-N terms for invoiced orders; null means due on receipt. It is the simple form of a term: a
	 * non-null `paymentTermId` wins, and when neither is set the channel default applies.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsInt()
	@MultiORMColumn({ type: 'int', nullable: true })
	paymentTermsDays?: number;

	/**
	 * Loyalty balance. The movements are adjustment rows of type `LOYALTY`; this column is the cached
	 * balance a checkout reads without summing the ledger.
	 */
	@ApiPropertyOptional({ type: () => Number, default: 0 })
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		default: 0,
		transformer: new ColumnNumericTransformerPipe()
	})
	loyaltyPoints?: number;

	/**
	 * Address pre-selected at checkout for this party. It is a reference into the address book, never a
	 * copy of an address.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	defaultShippingAddressId?: ID;

	/**
	 * The billing counterpart of the above.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	defaultBillingAddressId?: ID;

	/**
	 * Consent flag, with its own audit value.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsBoolean()
	@MultiORMColumn({ type: 'boolean', default: false })
	acceptsMarketing?: boolean;

	/**
	 * Free-text acquisition source for reporting (`organic`, `campaign-x`, `import`).
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	acquiredChannel?: string;

	/**
	 * Normalised (trimmed, lower-cased) form of `primaryEmail`, maintained by a subscriber.
	 *
	 * `primaryEmail` is stored as entered and is not unique; duplicate detection and guest-order
	 * matching need a stable comparable key, and a functional index over a case-folded expression is
	 * not portable across the three dialects.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 320 })
	@IsOptional()
	@IsString()
	@MaxLength(320)
	@MultiORMColumn({ type: 'varchar', length: 320, nullable: true })
	emailKey?: string;

	/**
	 * The party's key in an upstream CRM or ERP, used as the upsert key by the import jobs.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	externalId?: string;

	/**
	 * Whether the party is a natural person or a legal entity. Every B2B reader branches on it, and an
	 * existing row keeps the value the platform already inferred for it, so no installation changes
	 * behaviour: rows the backfill cannot classify stay `INDIVIDUAL` and are listed for review.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PartyKind, default: PartyKind.INDIVIDUAL })
	@IsEnum(PartyKind)
	@MultiORMColumn({ type: 'simple-enum', enum: PartyKind, default: PartyKind.INDIVIDUAL })
	partyKind?: PartyKind;

	/**
	 * The currency this party contracts in. Null means the region's currency. A contracted B2B currency
	 * is an attribute of the agreement with the party, and the supply side already models exactly this
	 * fact on the supplier row; validating it against the currency master is a write-time check.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	@MultiORMColumn({ type: 'varchar', length: 3, nullable: true })
	currency?: string;

	/**
	 * The instalment schedule this party is settled against; it supersedes `paymentTermsDays`, which
	 * stays and remains the simple form. The constraint is added by the kernel migration that creates
	 * the term tables.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	paymentTermId?: ID;

	/**
	 * The party's VAT / GST / TIN number, as printed on its own registration. Reverse charge and
	 * intra-community zero-rating are conditional on the **buyer's** registration number being present,
	 * and before this column the buyer — where the condition is actually evaluated — carried nothing.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 64 })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	taxRegistrationNumber?: string;

	/**
	 * Which registration scheme the number belongs to. It reuses the vocabulary the seller row already
	 * declares rather than adding a second one for the same concept.
	 */
	@ApiPropertyOptional({ type: () => String, enum: TaxRegistrationScheme })
	@IsOptional()
	@IsEnum(TaxRegistrationScheme)
	@MultiORMColumn({ type: 'simple-enum', enum: TaxRegistrationScheme, nullable: true })
	taxRegistrationScheme?: TaxRegistrationScheme;

	/**
	 * The tax regime manually assigned to this party. It always wins over automatic regime matching.
	 * The constraint is added by the tax package's set.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@MultiORMColumn({ type: 'uuid', nullable: true })
	taxRegimeId?: ID;

	/**
	 * Tenant-defined, non-indexed extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<Record<string, unknown>>({ nullable: true })
	metadata?: Record<string, unknown>;

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

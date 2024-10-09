import { JoinColumn, JoinTable, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	Min,
	ValidateIf
} from 'class-validator';
import {
	DefaultValueDateTypeEnum,
	IOrganization,
	WeekDaysEnum,
	CurrencyPosition,
	IContact,
	ITag,
	IInvoice,
	IEmployee,
	IDeal,
	ISkill,
	IPayment,
	IOrganizationSprint,
	IInvoiceEstimateHistory,
	IOrganizationAward,
	IOrganizationLanguage,
	IFeatureOrganization,
	IAccountingTemplate,
	IReportOrganization,
	IImageAsset,
	ID,
	DEFAULT_PROFIT_BASED_BONUS,
	BonusTypeEnum,
	CurrenciesEnum,
	DEFAULT_INVITE_EXPIRY_PERIOD,
	DEFAULT_STANDARD_WORK_HOURS_PER_DAY
} from '@gauzy/contracts';
import {
	AccountingTemplate,
	Contact,
	Deal,
	Employee,
	FeatureOrganization,
	ImageAsset,
	Invoice,
	InvoiceEstimateHistory,
	OrganizationAward,
	OrganizationLanguage,
	OrganizationSprint,
	Payment,
	ReportOrganization,
	Skill,
	Tag,
	TenantBaseEntity
} from '../core/entities/internal';
import {
	ColumnIndex,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToMany,
	MultiORMManyToOne,
	MultiORMOneToMany
} from './../core/decorators/entity';
import { MikroOrmOrganizationRepository } from './repository/mikro-orm-organization.repository';

@MultiORMEntity('organization', { mikroOrmRepository: () => MikroOrmOrganizationRepository })
export class Organization extends TenantBaseEntity implements IOrganization {
	@ApiProperty({ type: () => String, required: true })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name: string;

	@ColumnIndex()
	@MultiORMColumn('boolean', { default: false })
	isDefault: boolean;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	profile_link: string;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	banner: string;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	totalEmployees: number;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	short_description: string;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	client_focus: string;

	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	overview: string;

	@MultiORMColumn({ length: 500, nullable: true })
	imageUrl?: string;

	/**
	 * Currency
	 *
	 * The currency used by the organization, selected from the CurrenciesEnum.
	 */
	@ApiProperty({
		enum: CurrenciesEnum,
		example: CurrenciesEnum.USD,
		required: true,
		description: 'The currency used by the organization, must be one of the CurrenciesEnum values.'
	})
	@IsNotEmpty()
	@IsEnum(CurrenciesEnum)
	@ColumnIndex()
	@MultiORMColumn()
	currency: string;

	@MultiORMColumn({ nullable: true })
	valueDate?: Date;

	/**
	 * Default Value Date Type
	 *
	 * The type of default value for a date field, which can be one of the values from DefaultValueDateTypeEnum.
	 */
	@ApiPropertyOptional({
		enum: DefaultValueDateTypeEnum,
		example: DefaultValueDateTypeEnum.TODAY,
		description: 'The default value date type, can be one of the values from DefaultValueDateTypeEnum.'
	})
	@IsOptional()
	@IsEnum(DefaultValueDateTypeEnum)
	@ColumnIndex()
	@MultiORMColumn({
		type: 'simple-enum',
		nullable: true,
		enum: DefaultValueDateTypeEnum,
		default: DefaultValueDateTypeEnum.TODAY
	})
	defaultValueDateType: DefaultValueDateTypeEnum;

	@MultiORMColumn({ nullable: true })
	defaultAlignmentType?: string;

	@MultiORMColumn({ nullable: true })
	timeZone?: string;

	/**
	 * Region Code
	 *
	 * The code representing a specific region, such as a country or geographical area.
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'The code representing a specific region (e.g., country or geographical area).'
	})
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	regionCode?: string;

	@MultiORMColumn({ nullable: true })
	brandColor?: string;

	@MultiORMColumn({ nullable: true })
	dateFormat?: string;

	@MultiORMColumn({ nullable: true })
	officialName?: string;

	/**
	 * Start Week On
	 *
	 * Specifies which day the week starts on. The value must be one of the days from WeekDaysEnum.
	 */
	@ApiPropertyOptional({
		enum: WeekDaysEnum,
		example: WeekDaysEnum.MONDAY,
		description: 'Specifies which day the week starts on. Must be one of the WeekDaysEnum values.'
	})
	@IsOptional()
	@IsEnum(WeekDaysEnum)
	@MultiORMColumn({ nullable: true })
	startWeekOn?: WeekDaysEnum;

	@MultiORMColumn({ nullable: true })
	taxId?: string;

	@MultiORMColumn({ nullable: true })
	numberFormat?: string;

	@MultiORMColumn({ nullable: true })
	minimumProjectSize?: string;

	/**
	 * Bonus Type
	 *
	 * The type of bonus, which can be one of the values from BonusTypeEnum.
	 */
	@ApiPropertyOptional({
		enum: BonusTypeEnum,
		example: BonusTypeEnum.PROFIT_BASED_BONUS,
		description: 'The type of bonus, can be one of the defined BonusTypeEnum values.'
	})
	@IsOptional()
	@IsEnum(BonusTypeEnum)
	@MultiORMColumn({ nullable: true })
	bonusType?: BonusTypeEnum;

	/**
	 * Bonus Percentage
	 *
	 * The percentage of profit-based bonus (between 0 and 100).
	 */
	@ApiPropertyOptional({
		type: () => Number,
		example: DEFAULT_PROFIT_BASED_BONUS,
		description: 'The percentage of profit-based bonus, must be between 0 and 100.'
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	@MultiORMColumn({ nullable: true })
	bonusPercentage?: number;

	@MultiORMColumn({ nullable: true, default: true })
	invitesAllowed?: boolean;

	@MultiORMColumn({ nullable: true })
	show_income?: boolean;

	@MultiORMColumn({ nullable: true })
	show_profits?: boolean;

	@MultiORMColumn({ nullable: true })
	show_bonuses_paid?: boolean;

	@MultiORMColumn({ nullable: true })
	show_total_hours?: boolean;

	@MultiORMColumn({ nullable: true })
	show_minimum_project_size?: boolean;

	@MultiORMColumn({ nullable: true })
	show_projects_count?: boolean;

	@MultiORMColumn({ nullable: true })
	show_clients_count?: boolean;

	@MultiORMColumn({ nullable: true })
	show_clients?: boolean;

	@MultiORMColumn({ nullable: true })
	show_employees_count?: boolean;

	/**
	 * Default Organization Invite Expiry Period
	 *
	 * The default period (in days) after which an organization invite expires.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		example: DEFAULT_INVITE_EXPIRY_PERIOD,
		description: 'The default invite expiry period in days.'
	})
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseInt(value, 10), { toClassOnly: true })
	@MultiORMColumn({ nullable: true })
	inviteExpiryPeriod?: number;

	@MultiORMColumn({ nullable: true })
	fiscalStartDate?: Date;

	@MultiORMColumn({ nullable: true })
	fiscalEndDate?: Date;

	@MultiORMColumn({ nullable: true })
	registrationDate?: Date;

	@MultiORMColumn({ nullable: true })
	futureDateAllowed?: boolean;

	/**
	 * Indicates whether manual time entry is allowed for time tracking.
	 *
	 * @column
	 * @default true
	 * @type boolean
	 */
	@MultiORMColumn({ default: true })
	allowManualTime?: boolean;

	/**
	 * Indicates whether modification of time entries is allowed for time tracking.
	 *
	 * @column
	 * @default true
	 * @type boolean
	 */
	@MultiORMColumn({ default: true })
	allowModifyTime?: boolean;

	/**
	 * Indicates whether deletion of time entries is allowed for time tracking.
	 *
	 * @column
	 * @default true
	 * @type boolean
	 */
	@MultiORMColumn({ default: true })
	allowDeleteTime?: boolean;

	@MultiORMColumn({ default: true })
	allowTrackInactivity?: boolean;

	@MultiORMColumn({ default: 10 })
	inactivityTimeLimit?: number;

	@MultiORMColumn({ default: 1 })
	activityProofDuration?: number;

	@MultiORMColumn({ default: false })
	requireReason?: boolean;

	@MultiORMColumn({ default: false })
	requireDescription?: boolean;

	@MultiORMColumn({ default: false })
	requireProject?: boolean;

	@MultiORMColumn({ default: false })
	requireTask?: boolean;

	@MultiORMColumn({ default: false })
	requireClient?: boolean;

	@MultiORMColumn({ default: 12 })
	timeFormat?: 12 | 24;

	@MultiORMColumn({ nullable: true })
	separateInvoiceItemTaxAndDiscount?: boolean;

	@MultiORMColumn({ nullable: true })
	website?: string;

	@MultiORMColumn({ nullable: true })
	fiscalInformation?: string;

	@MultiORMColumn({ default: CurrencyPosition.LEFT })
	currencyPosition?: string;

	@MultiORMColumn({ nullable: true })
	discountAfterTax?: boolean;

	@MultiORMColumn({ nullable: true })
	defaultStartTime?: string;

	@MultiORMColumn({ nullable: true })
	defaultEndTime?: string;

	@MultiORMColumn({ nullable: true })
	defaultInvoiceEstimateTerms?: string;

	@MultiORMColumn({ nullable: true })
	convertAcceptedEstimates?: boolean;

	@MultiORMColumn({ nullable: true })
	daysUntilDue?: number;

	@MultiORMColumn({ default: false })
	isRemoveIdleTime?: boolean;

	@MultiORMColumn({ default: true })
	allowScreenshotCapture?: boolean;

	/** Upwork Organization ID */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	upworkOrganizationId?: string;

	/** Upwork Organization Name */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	upworkOrganizationName?: string;

	/**
	 * Indicates whether random screenshots are enabled. Defaults to false if not provided.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	randomScreenshot?: boolean;

	/**
	 * Indicates whether tracking is enabled during sleep.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	trackOnSleep?: boolean;

	/**
	 * Specifies the frequency of capturing screenshots. Defaults to 10 if not provided.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ type: 'numeric', default: 10 })
	screenshotFrequency?: number;

	/**
	 * Indicates whether a certain rule or behavior is enforced. Defaults to false if not provided.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ nullable: true, default: false })
	enforced?: boolean;

	/**
	 * Standard work hours per day for the organization.
	 */
	@ApiPropertyOptional({
		type: () => Number,
		description: 'Standard work hours per day for the organization',
		minimum: 1,
		maximum: 24
	})
	@IsOptional()
	@IsNumber()
	@Max(24, { message: 'Standard work hours per day cannot exceed 24 hours' })
	@Min(1, { message: 'Standard work hours per day must be at least 1 hour' })
	@MultiORMColumn({ nullable: true, default: DEFAULT_STANDARD_WORK_HOURS_PER_DAY })
	standardWorkHoursPerDay?: number;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	// Contact
	@MultiORMManyToOne(() => Contact, (it) => it.organization, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	contact: IContact;

	@RelationId((it: Organization) => it.contact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	contactId?: ID;

	/**
	 * ImageAsset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Indicates if the relation column value can be nullable or not. */
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
	@RelationId((it: Organization) => it.image)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	imageId?: ID;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	@MultiORMOneToMany(() => Invoice, (invoice) => invoice.fromOrganization)
	@JoinColumn()
	invoices?: IInvoice[];

	@MultiORMOneToMany(() => Employee, (employee) => employee.organization)
	@JoinColumn()
	employees?: IEmployee[];

	@MultiORMOneToMany(() => Deal, (deal) => deal.organization)
	@JoinColumn()
	deals?: IDeal[];

	@MultiORMOneToMany(() => OrganizationAward, (award) => award.organization)
	@JoinColumn()
	awards?: IOrganizationAward[];

	@MultiORMOneToMany(() => OrganizationLanguage, (language) => language.organization)
	@JoinColumn()
	languages?: IOrganizationLanguage[];

	@MultiORMOneToMany(() => FeatureOrganization, (featureOrganization) => featureOrganization.organization)
	featureOrganizations?: IFeatureOrganization[];

	@MultiORMOneToMany(() => Payment, (payment) => payment.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	@MultiORMOneToMany(() => OrganizationSprint, (sprint) => sprint.organization)
	@JoinColumn()
	organizationSprints?: IOrganizationSprint[];

	@MultiORMOneToMany(() => InvoiceEstimateHistory, (invoiceEstimateHistory) => invoiceEstimateHistory.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceEstimateHistories?: IInvoiceEstimateHistory[];

	@MultiORMOneToMany(() => AccountingTemplate, (accountingTemplate) => accountingTemplate.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	accountingTemplates?: IAccountingTemplate[];

	@MultiORMOneToMany(() => ReportOrganization, (reportOrganization) => reportOrganization.organization)
	@JoinColumn()
	reportOrganizations?: IReportOrganization[];

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/
	// Organization Tags
	@MultiORMManyToMany(() => Tag, (it) => it.organizations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization',
		joinColumn: 'organizationId',
		inverseJoinColumn: 'tagId'
	})
	@JoinTable({
		name: 'tag_organization'
	})
	tags?: ITag[];

	/**
	 * Organization Skills
	 */
	@MultiORMManyToMany(() => Skill, (skill) => skill.organizations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	skills: ISkill[];
}

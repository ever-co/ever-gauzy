import {
	Column,
	Entity,
	Index,
	JoinColumn,
	JoinTable,
	ManyToMany,
	ManyToOne,
	OneToMany,
	RelationId
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	BonusTypeEnum,
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	IOrganization,
	WeekDaysEnum,
	MinimumProjectSizeEnum,
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
	IReportOrganization
} from '@gauzy/contracts';
import {
	AccountingTemplate,
	Contact,
	Deal,
	Employee,
	FeatureOrganization,
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

@Entity('organization')
export class Organization extends TenantBaseEntity implements IOrganization {

	@ApiProperty({ type: () => String })
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: () => Boolean })
	@Index()
	@Column('boolean', { default: false })
	isDefault: boolean;

	@ApiProperty({ type: () => String, minLength: 3, maxLength: 100 })
	@Index({ unique: false })
	@Column({ nullable: true })
	profile_link: string;

	@ApiProperty({ type: () => String, maxLength: 300 })
	@Index()
	@Column({ nullable: true })
	banner: string;

	@ApiProperty({ type: () => Number })
	@Index()
	@Column({ nullable: true })
	totalEmployees: number;

	@ApiProperty({ type: () => String, maxLength: 600 })
	@Index()
	@Column({ nullable: true })
	short_description: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column({ nullable: true })
	client_focus: string;

	@ApiProperty({ type: () => String })
	@Index()
	@Column({ nullable: true })
	overview: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 500 })
	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@ApiProperty({ type: () => String, enum: CurrenciesEnum })
	@Index()
	@Column()
	currency: string;

	@ApiPropertyOptional({ type: () => Date })
	@Column({ nullable: true })
	valueDate?: Date;

	@ApiProperty({ type: () => String, enum: DefaultValueDateTypeEnum })
	@Index()
	@Column()
	defaultValueDateType: string;

	@ApiProperty({ type: () => Boolean, default: true })
	@Column({ default: true })
	isActive: boolean;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	defaultAlignmentType?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	timeZone?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	regionCode?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	brandColor?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	dateFormat?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	officialName?: string;

	@ApiProperty({ type: () => String, enum: WeekDaysEnum })
	@Column({ nullable: true })
	startWeekOn?: WeekDaysEnum;

	@ApiProperty({ type: () => String, maxLength: 256 })
	@Column({ nullable: true })
	taxId?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	numberFormat?: string;

	@ApiProperty({ type: () => String, enum: MinimumProjectSizeEnum })
	@Column({ nullable: true })
	minimumProjectSize?: string;

	@ApiProperty({ type: () => String, enum: BonusTypeEnum })
	@Column({ nullable: true })
	bonusType?: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	bonusPercentage?: number;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	invitesAllowed?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_income?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_profits?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_bonuses_paid?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_total_hours?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_minimum_project_size?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_projects_count?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_clients_count?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_clients?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	show_employees_count?: boolean;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	inviteExpiryPeriod?: number;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	fiscalStartDate?: Date;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	fiscalEndDate?: Date;

	@ApiProperty({ type: () => Date })
	@Column({ nullable: true })
	registrationDate?: Date;

	@ApiProperty({ type: () => Boolean })
	@Column({ nullable: true })
	futureDateAllowed?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: true })
	allowManualTime?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: true })
	allowModifyTime?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: true })
	allowDeleteTime?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: true })
	allowTrackInactivity?: boolean;

	@ApiProperty({ type: () => Number })
	@Column({ default: 1 })
	inactivityTimeLimit?: number;

	@ApiProperty({ type: () => Number })
	@Column({ default: 1 })
	activityProofDuration?: number

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	requireReason?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	requireDescription?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	requireProject?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	requireTask?: boolean;

	@ApiProperty({ type: () => Boolean })
	@Column({ default: false })
	requireClient?: boolean;

	@ApiProperty({ enum: [12, 24] })
	@Column({ default: 12 })
	timeFormat?: 12 | 24;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	separateInvoiceItemTaxAndDiscount?: boolean;


	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	website?: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	fiscalInformation?: string;

	@ApiPropertyOptional({ type: () => String, enum: CurrencyPosition })
	@Column({ default: CurrencyPosition.LEFT })
	currencyPosition?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	discountAfterTax?: boolean;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	defaultStartTime?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	defaultEndTime?: string;

	@ApiPropertyOptional({ type: () => String })
	@Column({ nullable: true })
	defaultInvoiceEstimateTerms?: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	convertAcceptedEstimates?: boolean;

	@ApiPropertyOptional({ type: () => Number })
	@Column({ nullable: true })
	daysUntilDue?: number;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	// Contact
	@ApiProperty({ type: () => Contact })
	@ManyToOne(() => Contact, (contact) => contact.organization, {
		cascade: true,
		onDelete: 'SET NULL'
	})
	contact: IContact;

	@ApiProperty({ type: () => String, readOnly: true })
	@RelationId((it: Organization) => it.contact)
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany
    |--------------------------------------------------------------------------
    */

	@ApiPropertyOptional({ type: () => Invoice, isArray: true })
	@OneToMany(() => Invoice, (invoice) => invoice.fromOrganization)
	@JoinColumn()
	invoices?: IInvoice[];

	@ApiProperty({ type: () => Employee })
	@OneToMany(() => Employee, (employee) => employee.organization)
	@JoinColumn()
	employees?: IEmployee[];

	@ApiProperty({ type: () => Deal })
	@OneToMany(() => Deal, (deal) => deal.organization)
	@JoinColumn()
	deals?: IDeal[];

	@ApiProperty({ type: () => OrganizationAward })
	@OneToMany(() => OrganizationAward, (award) => award.organization)
	@JoinColumn()
	awards?: IOrganizationAward[];

	@ApiProperty({ type: () => OrganizationLanguage })
	@OneToMany(() => OrganizationLanguage, (language) => language.organization)
	@JoinColumn()
	languages?: IOrganizationLanguage[];

	@ApiProperty({ type: () => FeatureOrganization })
	@OneToMany(() => FeatureOrganization, (featureOrganization) => featureOrganization.organization)
	featureOrganizations?: IFeatureOrganization[];

	@ApiPropertyOptional({ type: () => Payment, isArray: true })
	@OneToMany(() => Payment, (payment) => payment.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	@ApiPropertyOptional({ type: () => OrganizationSprint, isArray: true })
	@OneToMany(() => OrganizationSprint, (sprint) => sprint.organization)
	@JoinColumn()
	organizationSprints?: IOrganizationSprint[];

	@ApiPropertyOptional({ type: () => InvoiceEstimateHistory, isArray: true })
	@OneToMany(() => InvoiceEstimateHistory, (invoiceEstimateHistory) => invoiceEstimateHistory.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceEstimateHistories?: IInvoiceEstimateHistory[];

	@ApiProperty({ type: () => AccountingTemplate })
	@OneToMany(() => AccountingTemplate, (accountingTemplate) => accountingTemplate.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	accountingTemplates?: IAccountingTemplate[];

	@ApiProperty({ type: () => ReportOrganization })
	@OneToMany(() => ReportOrganization, (reportOrganization) => reportOrganization.organization)
	@JoinColumn()
	reportOrganizations?: IReportOrganization[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */
	// Tags
	@ApiProperty({ type: () => Tag })
	@ManyToMany(() => Tag, (it) => it.organizations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization'
	})
	tags: ITag[];

	@ApiProperty({ type: () => Skill })
	@ManyToMany(() => Skill, (skill) => skill.organizations)
	skills: ISkill[];
}

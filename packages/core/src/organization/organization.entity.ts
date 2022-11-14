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

	@Index()
	@Column()
	name: string;

	@Index()
	@Column('boolean', { default: false })
	isDefault: boolean;

	@Index({ unique: false })
	@Column({ nullable: true })
	profile_link: string;

	@Index()
	@Column({ nullable: true })
	banner: string;

	@Index()
	@Column({ nullable: true })
	totalEmployees: number;

	@Index()
	@Column({ nullable: true })
	short_description: string;

	@Index()
	@Column({ nullable: true })
	client_focus: string;

	@Index()
	@Column({ nullable: true })
	overview: string;

	@Column({ length: 500, nullable: true })
	imageUrl?: string;

	@Index()
	@Column()
	currency: string;

	@Column({ nullable: true })
	valueDate?: Date;

	@Index()
	@Column({
		type: 'simple-enum',
		nullable: true,
		enum: DefaultValueDateTypeEnum,
		default: DefaultValueDateTypeEnum.TODAY
	})
	defaultValueDateType: DefaultValueDateTypeEnum;

	@Column({ default: true })
	isActive: boolean;

	@Column({ nullable: true })
	defaultAlignmentType?: string;

	@Column({ nullable: true })
	timeZone?: string;

	@Column({ nullable: true })
	regionCode?: string;

	@Column({ nullable: true })
	brandColor?: string;

	@Column({ nullable: true })
	dateFormat?: string;

	@Column({ nullable: true })
	officialName?: string;

	@Column({ nullable: true })
	startWeekOn?: WeekDaysEnum;

	@Column({ nullable: true })
	taxId?: string;

	@Column({ nullable: true })
	numberFormat?: string;

	@Column({ nullable: true })
	minimumProjectSize?: string;

	@Column({ nullable: true })
	bonusType?: string;

	@Column({ nullable: true })
	bonusPercentage?: number;

	@Column({ nullable: true })
	invitesAllowed?: boolean;

	@Column({ nullable: true })
	show_income?: boolean;

	@Column({ nullable: true })
	show_profits?: boolean;

	@Column({ nullable: true })
	show_bonuses_paid?: boolean;

	@Column({ nullable: true })
	show_total_hours?: boolean;

	@Column({ nullable: true })
	show_minimum_project_size?: boolean;

	@Column({ nullable: true })
	show_projects_count?: boolean;

	@Column({ nullable: true })
	show_clients_count?: boolean;

	@Column({ nullable: true })
	show_clients?: boolean;

	@Column({ nullable: true })
	show_employees_count?: boolean;

	@Column({ nullable: true })
	inviteExpiryPeriod?: number;

	@Column({ nullable: true })
	fiscalStartDate?: Date;

	@Column({ nullable: true })
	fiscalEndDate?: Date;

	@Column({ nullable: true })
	registrationDate?: Date;

	@Column({ nullable: true })
	futureDateAllowed?: boolean;

	@Column({ default: true })
	allowManualTime?: boolean;

	@Column({ default: true })
	allowModifyTime?: boolean;

	@Column({ default: true })
	allowDeleteTime?: boolean;

	@Column({ default: true })
	allowTrackInactivity?: boolean;

	@Column({ default: 10 })
	inactivityTimeLimit?: number;

	@Column({ default: 1 })
	activityProofDuration?: number

	@Column({ default: false })
	requireReason?: boolean;

	@Column({ default: false })
	requireDescription?: boolean;

	@Column({ default: false })
	requireProject?: boolean;

	@Column({ default: false })
	requireTask?: boolean;

	@Column({ default: false })
	requireClient?: boolean;

	@Column({ default: 12 })
	timeFormat?: 12 | 24;

	@Column({ nullable: true })
	separateInvoiceItemTaxAndDiscount?: boolean;

	@Column({ nullable: true })
	website?: string;

	@Column({ nullable: true })
	fiscalInformation?: string;

	@Column({ default: CurrencyPosition.LEFT })
	currencyPosition?: string;

	@Column({ nullable: true })
	discountAfterTax?: boolean;

	@Column({ nullable: true })
	defaultStartTime?: string;

	@Column({ nullable: true })
	defaultEndTime?: string;

	@Column({ nullable: true })
	defaultInvoiceEstimateTerms?: string;

	@Column({ nullable: true })
	convertAcceptedEstimates?: boolean;

	@Column({ nullable: true })
	daysUntilDue?: number;
	/*
    |--------------------------------------------------------------------------
    | @ManyToOne
    |--------------------------------------------------------------------------
    */

	// Contact
	@ManyToOne(() => Contact, (contact) => contact.organization, {
		cascade: true,
		onDelete: 'SET NULL'
	})
	contact: IContact;

	@RelationId((it: Organization) => it.contact)
	@Index()
	@Column({ nullable: true })
	readonly contactId?: string;

	/*
    |--------------------------------------------------------------------------
    | @OneToMany
    |--------------------------------------------------------------------------
    */

	@OneToMany(() => Invoice, (invoice) => invoice.fromOrganization)
	@JoinColumn()
	invoices?: IInvoice[];

	@OneToMany(() => Employee, (employee) => employee.organization)
	@JoinColumn()
	employees?: IEmployee[];

	@OneToMany(() => Deal, (deal) => deal.organization)
	@JoinColumn()
	deals?: IDeal[];

	@OneToMany(() => OrganizationAward, (award) => award.organization)
	@JoinColumn()
	awards?: IOrganizationAward[];

	@OneToMany(() => OrganizationLanguage, (language) => language.organization)
	@JoinColumn()
	languages?: IOrganizationLanguage[];

	@OneToMany(() => FeatureOrganization, (featureOrganization) => featureOrganization.organization)
	featureOrganizations?: IFeatureOrganization[];

	@OneToMany(() => Payment, (payment) => payment.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	payments?: IPayment[];

	@OneToMany(() => OrganizationSprint, (sprint) => sprint.organization)
	@JoinColumn()
	organizationSprints?: IOrganizationSprint[];

	@OneToMany(() => InvoiceEstimateHistory, (invoiceEstimateHistory) => invoiceEstimateHistory.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoiceEstimateHistories?: IInvoiceEstimateHistory[];

	@OneToMany(() => AccountingTemplate, (accountingTemplate) => accountingTemplate.organization, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	accountingTemplates?: IAccountingTemplate[];

	@OneToMany(() => ReportOrganization, (reportOrganization) => reportOrganization.organization)
	@JoinColumn()
	reportOrganizations?: IReportOrganization[];

	/*
    |--------------------------------------------------------------------------
    | @ManyToMany
    |--------------------------------------------------------------------------
    */
	// Tags
	@ManyToMany(() => Tag, (it) => it.organizations, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE'
	})
	@JoinTable({
		name: 'tag_organization'
	})
	tags: ITag[];

	@ManyToMany(() => Skill, (skill) => skill.organizations, {
        cascade: true
    })
	@JoinTable({
		name: 'skill_organization'
	})
	skills: ISkill[];
}

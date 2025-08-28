import { z } from 'zod';

// ===== ENUMS =====

// Time Log related enums
const TimeLogTypeEnum = z.enum(['TRACKED', 'MANUAL', 'IDLE', 'RESUMED']);

const TimeLogSourceEnum = z.enum([
	'BROWSER',
	'DESKTOP',
	'MOBILE',
	'UPWORK',
	'HUBSTAFF',
	'TEAMS',
	'BROWSER_EXTENSION',
	'CLOC'
]);

// Task related enums
const TaskStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'IN_REVIEW', 'BLOCKED', 'COMPLETED']);

const TaskPriorityEnum = z.enum(['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST']);

const TaskSizeEnum = z.enum(['X_SMALL', 'SMALL', 'MEDIUM', 'LARGE', 'X_LARGE']);

const TaskTypeEnum = z.enum(['BUG', 'FEATURE', 'STORY', 'TASK', 'EPIC']);

// Other enums
const PayPeriodEnum = z.enum(['NONE', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY']);

const CurrenciesEnum = z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY']);

const DailyPlanStatusEnum = z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED']);

const ContactTypeEnum = z.enum(['CLIENT', 'CUSTOMER', 'LEAD']);

const BonusTypeEnum = z.enum(['PROFIT_BASED_BONUS', 'REVENUE_BASED_BONUS']);

const DefaultValueDateTypeEnum = z.enum(['TODAY', 'END_OF_MONTH', 'START_OF_MONTH']);

const WeekDaysEnum = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

// Product related enums
const ProductTypeEnum = z.enum(['DIGITAL', 'PHYSICAL', 'SERVICE']);

// Invoice related enums
const InvoiceStatusEnum = z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'ACTIVE', 'FULLY_PAID', 'CANCELLED']);

const InvoiceTypeEnum = z.enum(['BY_EMPLOYEE_HOURS', 'BY_PROJECT_HOURS', 'BY_TASK_HOURS', 'BY_PRODUCTS', 'BY_FLAT_FEE', 'DETAILS_INVOICE_ITEMS']);

// Expense related enums
const ExpenseCategoriesEnum = z.enum([
	'MARKETING', 'SALES', 'ADMINISTRATION', 'OPERATIONS', 'RESEARCH_AND_DEVELOPMENT', 'HUMAN_RESOURCES',
	'TRAVEL', 'OFFICE_SUPPLIES', 'TRAINING', 'LEGAL', 'ACCOUNTING', 'CONSULTING', 'UTILITIES', 'RENT', 'OTHER'
]);

// Goal related enums
const GoalTimeFrameEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']);

const GoalLevelEnum = z.enum(['ORGANIZATION', 'TEAM', 'EMPLOYEE']);

// Candidate related enums
const CandidateStatusEnum = z.enum(['APPLIED', 'REJECTED', 'HIRED', 'INTERVIEW', 'ON_HOLD']);

// Deal related enums
const DealStatusEnum = z.enum([
	'LEAD', 'QUALIFIED_LEAD', 'PROPOSAL_MADE', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
]);

// Income related enums
const IncomeTypeEnum = z.enum(['SALARY', 'BONUS', 'OVERTIME', 'COMMISSION', 'OTHER']);

// Payment related enums
const PaymentStatusEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']);

const PaymentMethodEnum = z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'PAYPAL', 'STRIPE', 'CASH', 'CHECK', 'OTHER']);

// Equipment related enums
const EquipmentTypeEnum = z.enum(['LAPTOP', 'DESKTOP', 'MONITOR', 'MOBILE', 'PRINTER', 'FURNITURE', 'SOFTWARE_LICENSE', 'OTHER']);

const EquipmentStatusEnum = z.enum(['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'RETIRED', 'LOST', 'DAMAGED']);

// Time-off related enums
const TimeOffStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED']);

const TimeOffTypeEnum = z.enum(['VACATION', 'SICK_LEAVE', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER']);

// Report related enums
const ReportCategoryEnum = z.enum(['FINANCIAL', 'HR', 'PROJECT', 'TIME_TRACKING', 'SALES', 'CUSTOM']);

// Comment related enums
const CommentableTypeEnum = z.enum(['TASK', 'PROJECT', 'GOAL', 'CANDIDATE', 'DEAL', 'INVOICE', 'OTHER']);

// Activity log enums
const ActivityLogActionEnum = z.enum(['CREATED', 'UPDATED', 'DELETED', 'VIEWED', 'ASSIGNED', 'COMPLETED', 'APPROVED', 'REJECTED']);

const ActivityLogEntityEnum = z.enum(['USER', 'EMPLOYEE', 'TASK', 'PROJECT', 'GOAL', 'INVOICE', 'EXPENSE', 'DEAL', 'CANDIDATE']);

// ===== BASE SCHEMAS =====

// Base entity schema with common fields
const BaseEntitySchema = z.object({
	id: z.string().uuid().readonly().optional(),
	createdAt: z.date().readonly().optional(),
	updatedAt: z.date().readonly().optional(),
	deletedAt: z.date().nullable().readonly().optional(),
	isActive: z.boolean().optional().default(true),
	isArchived: z.boolean().optional().default(false),
	archivedAt: z.date().nullable().optional(),
	// User action tracking
	createdByUserId: z.string().uuid().readonly().optional(),
	updatedByUserId: z.string().uuid().readonly().optional(),
	deletedByUserId: z.string().uuid().readonly().optional()
});

// ===== REFERENCE SCHEMAS =====

// Contact Schema (simplified for references)
const ContactRefSchema = BaseEntitySchema.extend({
	tenantId: z.string().uuid().readonly(),
	organizationId: z.string().uuid().readonly(),
	name: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	country: z.string().optional(),
	city: z.string().optional(),
	address: z.string().optional(),
	address2: z.string().optional(),
	postcode: z.string().optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	regionCode: z.string().optional(),
	fax: z.string().optional(),
	fiscalInformation: z.string().optional(),
	website: z.string().optional()
});

// Organization Position Schema (simplified for references)
const OrganizationPositionRefSchema = BaseEntitySchema.extend({
	tenantId: z.string().uuid().readonly(),
	organizationId: z.string().uuid().readonly(),
	name: z.string(),
	tags: z.array(z.lazy(() => TagRefSchema)).optional()
});

// Tag Schema (simplified for references)
const TagRefSchema = BaseEntitySchema.extend({
	tenantId: z.string().uuid().readonly(),
	organizationId: z.string().uuid().readonly(),
	name: z.string(),
	description: z.string().optional(),
	color: z.string().optional(),
	textColor: z.string().optional(),
	icon: z.string().optional()
});

// Image Asset Schema (for image references)
const ImageAssetRefSchema = BaseEntitySchema.extend({
	name: z.string().optional(),
	url: z.string().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	isFeatured: z.boolean().optional()
});

// Custom Fields Schema
const CustomFieldsSchema = z.record(
	z.string(),
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.union([z.string(), z.number(), z.boolean()]))])
);

// Tenant base schema
const TenantBaseSchema = BaseEntitySchema.extend({
	tenantId: z.string().uuid().readonly(),
	tenant: z.lazy(() => OrganizationRefSchema).optional()
});

// Tenant organization base schema
const TenantOrganizationBaseSchema = TenantBaseSchema.extend({
	organizationId: z.string().uuid().readonly(),
	organization: z.lazy(() => OrganizationRefSchema).optional()
});

// Organization Schema (simplified for references)
const OrganizationRefSchema = TenantBaseSchema.extend({
	name: z.string(),
	isDefault: z.boolean().optional().default(false),
	profile_link: z.string().optional(),
	banner: z.string().optional(),
	totalEmployees: z.number().optional(),
	short_description: z.string().optional(),
	client_focus: z.string().optional(),
	overview: z.string().optional(),
	imageUrl: z.string().max(500).optional(),
	currency: CurrenciesEnum,
	valueDate: z.date().optional(),
	defaultValueDateType: DefaultValueDateTypeEnum.optional().default('TODAY'),
	timeZone: z.string().optional(),
	regionCode: z.string().optional(),
	brandColor: z.string().optional(),
	dateFormat: z.string().optional(),
	officialName: z.string().optional(),
	startWeekOn: WeekDaysEnum.optional(),
	taxId: z.string().optional(),
	website: z.string().optional(),
	contactId: z.string().uuid().readonly().optional(),
	contact: ContactRefSchema.optional(),
	imageId: z.string().uuid().readonly().optional(),
	image: ImageAssetRefSchema.optional()
});

// ===== ENTITY SCHEMAS =====

// User Schema
const UserSchema = z.object({
	id: z.string().uuid().readonly().optional(),
	email: z.string().email(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	username: z.string().optional(),
	role: z.string().optional(),
	imageUrl: z.string().optional(),
	preferredLanguage: z.string().optional(),
	preferredComponentLayout: z.string().optional(),
	isEmailVerified: z.boolean().optional().default(false),
	code: z.string().optional(),
	codeExpireAt: z.date().optional(),
	emailVerifiedAt: z.date().optional(),
	emailToken: z.string().optional(),
	refreshToken: z.string().optional(),
	...BaseEntitySchema.omit({ id: true }).shape
});

// Employee Schema
const EmployeeSchema = TenantOrganizationBaseSchema.extend({
	userId: z.string().uuid().readonly(),
	user: UserSchema.optional(),
	contactId: z.string().uuid().readonly().optional(),
	contact: ContactRefSchema.optional(),

	// Profile information
	valueDate: z.date().optional(),
	short_description: z.string().max(200).optional(),
	description: z.string().optional(),

	// Employment details
	startedWorkOn: z.date().optional(),
	endWork: z.date().optional(),
	payPeriod: PayPeriodEnum.optional(),
	billRateValue: z.number().optional(),
	minimumBillingRate: z.number().optional(),
	billRateCurrency: CurrenciesEnum.optional(),
	reWeeklyLimit: z.number().optional(),

	// Offer/hiring details
	offerDate: z.date().optional(),
	acceptDate: z.date().optional(),
	rejectDate: z.date().optional(),
	employeeLevel: z.string().max(500).optional(),

	// Financial tracking
	anonymousBonus: z.boolean().optional(),
	averageIncome: z.number().optional(),
	averageBonus: z.number().optional(),
	totalWorkHours: z.number().optional().default(0),
	averageExpenses: z.number().optional(),

	// Privacy settings
	show_anonymous_bonus: z.boolean().optional(),
	show_average_bonus: z.boolean().optional(),
	show_average_expenses: z.boolean().optional(),
	show_average_income: z.boolean().optional(),
	show_billrate: z.boolean().optional(),
	show_payperiod: z.boolean().optional(),
	show_start_work_on: z.boolean().optional(),

	// Job search and profiles
	isJobSearchActive: z.boolean().optional(),
	linkedInUrl: z.string().url().optional(),
	facebookUrl: z.string().url().optional(),
	instagramUrl: z.string().url().optional(),
	twitterUrl: z.string().url().optional(),
	githubUrl: z.string().url().optional(),
	gitlabUrl: z.string().url().optional(),
	upworkUrl: z.string().url().optional(),
	stackoverflowUrl: z.string().url().optional(),

	// Verification status
	isVerified: z.boolean().optional(),
	isVetted: z.boolean().optional(),
	totalJobs: z.number().optional(),
	jobSuccess: z.number().optional(),
	profile_link: z.string().max(100).optional(),

	// Time tracking settings
	isTrackingEnabled: z.boolean().optional().default(false),
	isOnline: z.boolean().optional().default(false),
	isAway: z.boolean().optional().default(false),
	isTrackingTime: z.boolean().optional().default(false),
	allowScreenshotCapture: z.boolean().optional().default(true),
	allowManualTime: z.boolean().optional().default(false),
	allowModifyTime: z.boolean().optional().default(false),
	allowDeleteTime: z.boolean().optional().default(false),

	// External platform IDs
	upworkId: z.string().optional(),
	linkedInId: z.string().optional(),

	// Virtual fields
	fullName: z.string().optional(),
	isDeleted: z.boolean().optional(),

	// Organization reference
	organizationPositionId: z.string().uuid().readonly().optional(),
	organizationPosition: OrganizationPositionRefSchema.optional(),

	// Relations arrays
	teams: z.array(z.lazy(() => OrganizationTeamRefSchema)).optional(),
	projects: z.array(z.lazy(() => ProjectRefSchema)).optional(),
	sprints: z.array(z.lazy(() => OrganizationSprintRefSchema)).optional(),
	modules: z.array(z.lazy(() => OrganizationProjectModuleRefSchema)).optional(),
	timeLogs: z.array(z.lazy(() => TimeLogRefSchema)).optional(),
	timesheets: z.array(z.lazy(() => TimesheetRefSchema)).optional(),
	timeSlots: z.array(z.lazy(() => TimeSlotRefSchema)).optional(),
	tasks: z.array(z.lazy(() => TaskRefSchema)).optional(),
	dailyPlans: z.array(z.lazy(() => DailyPlanRefSchema)).optional(),
	tags: z.array(TagRefSchema).optional(),
	skills: z.array(z.lazy(() => SkillRefSchema)).optional(),
	customFields: CustomFieldsSchema.optional()
});

// Reference schemas for circular dependencies
const OrganizationTeamRefSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	color: z.string().optional(),
	emoji: z.string().optional(),
	teamSize: z.string().optional(),
	logo: z.string().optional(),
	prefix: z.string().optional(),
	shareProfileView: z.boolean().optional().default(true),
	requirePlanToTrack: z.boolean().optional().default(false)
});

const ProjectRefSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	billing: z.string().optional(),
	currency: CurrenciesEnum.optional(),
	public: z.boolean().optional(),
	owner: z.string().optional(),
	taskListType: z.string().optional().default('GRID'),
	code: z.string().optional(),
	description: z.string().optional(),
	color: z.string().optional(),
	budget: z.number().optional(),
	budgetType: z.string().optional(),
	imageId: z.string().uuid().readonly().optional(),
	image: ImageAssetRefSchema.optional()
});

const TaskRefSchema = TenantOrganizationBaseSchema.extend({
	title: z.string(),
	number: z.number().optional(),
	prefix: z.string().optional(),
	description: z.string().optional(),
	status: TaskStatusEnum.optional(),
	priority: TaskPriorityEnum.optional(),
	size: TaskSizeEnum.optional(),
	issueType: TaskTypeEnum.optional(),
	estimate: z.number().optional(),
	dueDate: z.date().optional(),
	public: z.boolean().optional().default(true),
	startDate: z.date().optional(),
	resolvedAt: z.date().optional(),
	version: z.string().optional(),
	isDraft: z.boolean().optional().default(false),
	isScreeningTask: z.boolean().optional().default(false),
	taskNumber: z.string().optional(),
	parentId: z.string().uuid().readonly().optional(),
	projectId: z.string().uuid().readonly().optional(),
	organizationSprintId: z.string().uuid().readonly().optional()
});

const DailyPlanRefSchema = TenantOrganizationBaseSchema.extend({
	date: z.date(),
	workTimePlanned: z.number(),
	status: DailyPlanStatusEnum,
	employeeId: z.string().uuid().readonly().optional(),
	organizationTeamId: z.string().uuid().readonly().optional()
});

const TimeLogRefSchema = TenantOrganizationBaseSchema.extend({
	employeeId: z.string().uuid().readonly(),
	startedAt: z.date().optional(),
	stoppedAt: z.date().optional(),
	editedAt: z.date().optional(),
	logType: TimeLogTypeEnum,
	source: TimeLogSourceEnum.optional().default('BROWSER'),
	description: z.string().optional(),
	reason: z.string().optional(),
	isBillable: z.boolean().optional(),
	isRunning: z.boolean().optional(),
	version: z.string().optional(),
	projectId: z.string().uuid().readonly().optional(),
	taskId: z.string().uuid().readonly().optional(),
	organizationContactId: z.string().uuid().readonly().optional(),
	organizationTeamId: z.string().uuid().readonly().optional(),
	timesheetId: z.string().uuid().readonly().optional(),
	duration: z.number().optional(),
	isEdited: z.boolean().optional()
});

const TimesheetRefSchema = TenantOrganizationBaseSchema.extend({
	employeeId: z.string().uuid().readonly(),
	startDate: z.date(),
	endDate: z.date(),
	duration: z.number().optional(),
	keyboard: z.number().optional(),
	mouse: z.number().optional(),
	overall: z.number().optional(),
	status: z.string().optional()
});

const TimeSlotRefSchema = TenantOrganizationBaseSchema.extend({
	employeeId: z.string().uuid().readonly(),
	duration: z.number(),
	keyboard: z.number(),
	mouse: z.number(),
	overall: z.number(),
	startedAt: z.date(),
	time_slot: z.date()
});

const OrganizationSprintRefSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	projectId: z.string().uuid().readonly(),
	goal: z.string().optional(),
	length: z.number(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	dayStart: z.number().optional(),
	isActive: z.boolean().optional().default(true)
});

const OrganizationProjectModuleRefSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	status: z.string().optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	public: z.boolean().optional(),
	isFavorite: z.boolean().optional(),
	projectId: z.string().uuid().readonly()
});

const SkillRefSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	color: z.string().optional()
});

// Organization Schema
const OrganizationSchema = TenantBaseSchema.extend({
	name: z.string(),
	isDefault: z.boolean().optional().default(false),
	profile_link: z.string().optional(),
	banner: z.string().optional(),
	totalEmployees: z.number().optional(),
	short_description: z.string().optional(),
	client_focus: z.string().optional(),
	overview: z.string().optional(),
	imageUrl: z.string().max(500).optional(),

	// Currency and localization
	currency: CurrenciesEnum,
	valueDate: z.date().optional(),
	defaultValueDateType: DefaultValueDateTypeEnum.optional().default('TODAY'),
	defaultAlignmentType: z.string().optional(),
	timeZone: z.string().optional(),
	regionCode: z.string().optional(),
	brandColor: z.string().optional(),
	dateFormat: z.string().optional(),
	officialName: z.string().optional(),
	startWeekOn: WeekDaysEnum.optional(),

	// Tax and business info
	taxId: z.string().optional(),
	numberFormat: z.string().optional(),
	minimumProjectSize: z.string().optional(),

	// Bonus settings
	bonusType: BonusTypeEnum.optional(),
	bonusPercentage: z.number().min(0).max(100).optional(),

	// Permissions and settings
	invitesAllowed: z.boolean().optional().default(true),
	show_income: z.boolean().optional(),
	show_profits: z.boolean().optional(),
	show_bonuses_paid: z.boolean().optional(),
	show_total_hours: z.boolean().optional(),
	show_minimum_project_size: z.boolean().optional(),
	show_projects_count: z.boolean().optional(),
	show_clients_count: z.boolean().optional(),
	show_clients: z.boolean().optional(),
	show_employees_count: z.boolean().optional(),
	inviteExpiryPeriod: z.number().optional(),

	// Financial dates
	fiscalStartDate: z.date().optional(),
	fiscalEndDate: z.date().optional(),
	registrationDate: z.date().optional(),
	futureDateAllowed: z.boolean().optional(),

	// Time tracking settings
	allowManualTime: z.boolean().optional().default(true),
	allowModifyTime: z.boolean().optional().default(true),
	allowDeleteTime: z.boolean().optional().default(true),
	allowTrackInactivity: z.boolean().optional().default(true),
	inactivityTimeLimit: z.number().optional().default(10),
	activityProofDuration: z.number().optional().default(1),
	requireReason: z.boolean().optional().default(false),
	requireDescription: z.boolean().optional().default(false),
	requireProject: z.boolean().optional().default(false),
	requireTask: z.boolean().optional().default(false),
	requireClient: z.boolean().optional().default(false),
	timeFormat: z
		.union([z.literal(12), z.literal(24)])
		.optional()
		.default(12),

	// Financial settings
	separateInvoiceItemTaxAndDiscount: z.boolean().optional(),
	website: z.string().optional(),
	fiscalInformation: z.string().optional(),
	currencyPosition: z.string().optional().default('LEFT'),
	discountAfterTax: z.boolean().optional(),
	defaultStartTime: z.string().optional(),
	defaultEndTime: z.string().optional(),
	defaultInvoiceEstimateTerms: z.string().optional(),
	convertAcceptedEstimates: z.boolean().optional(),
	daysUntilDue: z.number().optional(),
	isRemoveIdleTime: z.boolean().optional().default(false),
	allowScreenshotCapture: z.boolean().optional().default(true),

	// Upwork integration
	upworkOrganizationId: z.string().optional(),
	upworkOrganizationName: z.string().optional(),

	// Screenshot settings
	randomScreenshot: z.boolean().optional().default(false),
	trackOnSleep: z.boolean().optional().default(false),
	screenshotFrequency: z.number().optional().default(10),
	enforced: z.boolean().optional().default(false),
	standardWorkHoursPerDay: z.number().min(1).max(24).optional().default(8),

	// Relations
	contactId: z.string().uuid().readonly().optional(),
	contact: ContactRefSchema.optional(),
	imageId: z.string().uuid().readonly().optional(),
	image: ImageAssetRefSchema.optional(),

	// Collections
	employees: z.array(z.lazy(() => EmployeeSchema)).optional(),
	projects: z.array(ProjectRefSchema).optional(),
	teams: z.array(OrganizationTeamRefSchema).optional(),
	tags: z.array(TagRefSchema).optional(),
	skills: z.array(SkillRefSchema).optional()
});

// Task Schema
const TaskSchema: any = TenantOrganizationBaseSchema.extend({
	title: z.string(),
	number: z.number().optional(),
	prefix: z.string().optional(),
	description: z.string().optional(),
	status: TaskStatusEnum.optional(),
	priority: TaskPriorityEnum.optional(),
	size: TaskSizeEnum.optional(),
	issueType: TaskTypeEnum.optional(),
	estimate: z.number().optional(),
	dueDate: z.date().optional(),
	public: z.boolean().optional().default(true),
	startDate: z.date().optional(),
	resolvedAt: z.date().optional(),
	version: z.string().optional(),
	isDraft: z.boolean().optional().default(false),
	isScreeningTask: z.boolean().optional().default(false),

	// Virtual fields
	taskNumber: z.string().optional(),
	rootEpic: z.lazy(() => TaskSchema).optional(),

	// Relations
	parentId: z.string().uuid().readonly().optional(),
	parent: z.lazy(() => TaskSchema).optional(),
	projectId: z.string().uuid().readonly().optional(),
	project: ProjectRefSchema.optional(),
	organizationSprintId: z.string().uuid().readonly().optional(),
	organizationSprint: OrganizationSprintRefSchema.optional(),
	taskStatusId: z.string().uuid().readonly().optional(),
	taskStatus: z.object({ name: z.string(), value: z.string(), description: z.string().optional() }).optional(),
	taskSizeId: z.string().uuid().readonly().optional(),
	taskSize: z.object({ name: z.string(), value: z.string(), description: z.string().optional() }).optional(),
	taskPriorityId: z.string().uuid().readonly().optional(),
	taskPriority: z.object({ name: z.string(), value: z.string(), description: z.string().optional() }).optional(),
	taskTypeId: z.string().uuid().readonly().optional(),
	taskType: z.object({ name: z.string(), value: z.string(), description: z.string().optional() }).optional(),

	// Collections
	children: z.array(z.lazy(() => TaskSchema)).optional(),
	members: z.array(z.lazy(() => EmployeeSchema)).optional(),
	teams: z.array(OrganizationTeamRefSchema).optional(),
	tags: z.array(TagRefSchema).optional(),
	timeLogs: z.array(TimeLogRefSchema).optional(),
	dailyPlans: z.array(DailyPlanRefSchema).optional(),
	modules: z.array(OrganizationProjectModuleRefSchema).optional()
});

// Daily Plan Schema
const DailyPlanSchema = TenantOrganizationBaseSchema.extend({
	date: z.date(),
	workTimePlanned: z.number(),
	status: DailyPlanStatusEnum,

	// Relations
	employeeId: z.string().uuid().readonly().optional(),
	employee: z.lazy(() => EmployeeSchema).optional(),
	organizationTeamId: z.string().uuid().readonly().optional(),
	organizationTeam: OrganizationTeamRefSchema.optional(),

	// Collections
	tasks: z.array(TaskRefSchema).optional()
});

// Project Schema
const ProjectSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	billing: z.string().optional(),
	currency: CurrenciesEnum.optional(),
	public: z.boolean().optional(),
	owner: z.string().optional(),
	taskListType: z.string().optional().default('GRID'),
	code: z.string().optional(),
	description: z.string().optional(),
	color: z.string().optional(),

	// Budget and financial
	budget: z.number().optional(),
	budgetType: z.string().optional(),

	// Relations
	imageId: z.string().uuid().readonly().optional(),
	image: ImageAssetRefSchema.optional(),

	// Collections
	members: z.array(z.lazy(() => EmployeeSchema)).optional(),
	teams: z.array(OrganizationTeamRefSchema).optional(),
	tasks: z.array(TaskRefSchema).optional(),
	tags: z.array(TagRefSchema).optional(),
	modules: z.array(OrganizationProjectModuleRefSchema).optional(),
	customFields: CustomFieldsSchema.optional()
});

// Organization Team Schema
const OrganizationTeamSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	color: z.string().optional(),
	emoji: z.string().optional(),
	teamSize: z.string().optional(),
	logo: z.string().optional(),
	prefix: z.string().optional(),
	shareProfileView: z.boolean().optional().default(true),
	requirePlanToTrack: z.boolean().optional().default(false),

	// Collections
	members: z.array(z.lazy(() => EmployeeSchema)).optional(),
	projects: z.array(ProjectRefSchema).optional(),
	tasks: z.array(TaskRefSchema).optional(),
	tags: z.array(TagRefSchema).optional()
});

// Time Log Schema
const TimeLogSchema = TenantOrganizationBaseSchema.extend({
	employeeId: z.string().uuid().readonly(),
	employee: z.lazy(() => EmployeeSchema).optional(),
	startedAt: z.date().optional(),
	stoppedAt: z.date().optional(),
	editedAt: z.date().optional(),
	logType: TimeLogTypeEnum,
	source: TimeLogSourceEnum.optional().default('BROWSER'),
	description: z.string().optional(),
	reason: z.string().optional(),
	isBillable: z.boolean().optional(),
	isRunning: z.boolean().optional(),
	version: z.string().optional(),

	// Task and project relations
	projectId: z.string().uuid().readonly().optional(),
	project: ProjectRefSchema.optional(),
	taskId: z.string().uuid().readonly().optional(),
	task: TaskRefSchema.optional(),
	organizationContactId: z.string().uuid().readonly().optional(),
	organizationContact: z.lazy(() => OrganizationContactSchema).optional(),
	organizationTeamId: z.string().uuid().readonly().optional(),
	organizationTeam: OrganizationTeamRefSchema.optional(),
	timesheetId: z.string().uuid().readonly().optional(),
	timesheet: TimesheetRefSchema.optional(),

	// Calculated fields
	duration: z.number().optional(),
	isEdited: z.boolean().optional()
});

// Timer Schema (for timer management)
const TimerSchema = TenantOrganizationBaseSchema.extend({
	projectId: z.string().uuid().optional(),
	taskId: z.string().uuid().optional(),
	organizationContactId: z.string().uuid().optional().describe('The contact associated with this timer'),
	organizationTeamId: z.string().uuid().optional().describe('The team associated with this timer'),
	description: z.string().optional(),
	sentTo: z.string().optional(),
	logType: TimeLogTypeEnum.optional(),
	source: TimeLogSourceEnum.optional().default('BROWSER'),
	isBillable: z.boolean().optional(),
	version: z.string().optional(),
	startedAt: z.date().optional(),
	stoppedAt: z.date().optional()
});

// Timer Status Schema
const TimerStatusSchema = z.object({
	id: z.string().uuid().optional(),
	duration: z.number(),
	running: z.boolean(),
	// API returns dates as ISO strings, hence using string validation
	lastLog: z.object({
		deletedAt: z.string().datetime({ offset: true }).nullable(),
		createdAt: z.string().datetime({ offset: true }).readonly(),
		updatedAt: z.string().datetime({ offset: true }).readonly(),
		createdByUserId: z.string().uuid().readonly(),
		updatedByUserId: z.string().uuid().readonly(),
		deletedByUserId: z.string().uuid().nullable(),
		id: z.string().uuid().readonly(),
		isActive: z.boolean(),
		isArchived: z.boolean().optional(),
		archivedAt: z.string().nullable(),
		tenantId: z.string().uuid().readonly(),
		organizationId: z.string().uuid().readonly(),
		startedAt: z.string().datetime({ offset: true }).readonly(),
		stoppedAt: z.string().datetime({ offset: true }).readonly(),
		editedAt: z.string().datetime({ offset: true }).nullable(),
		logType: TimeLogTypeEnum,
		source: TimeLogSourceEnum,
		description: z.string().optional(),
		reason: z.string().nullable().optional(),
		isBillable: z.boolean(),
		isRunning: z.boolean(),
		version: z.string().optional(),
		employeeId: z.string().uuid().readonly(),
		timesheetId: z.string().uuid().readonly(),
		projectId: z.string().uuid().optional(),
		taskId: z.string().uuid().optional(),
		organizationContactId: z.string().uuid().optional(),
		organizationTeamId: z.string().uuid().optional(),
		duration: z.number(),
		isEdited: z.boolean()
	})
});

// Organization Contact Schema
const OrganizationContactSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	primaryEmail: z.string().email().optional(),
	primaryPhone: z.string().optional(),
	inviteStatus: z.string().optional(),
	notes: z.string().optional(),
	contactType: ContactTypeEnum.optional().default('CLIENT'),
	imageUrl: z.string().max(500).optional(),
	budget: z.number().optional(),
	budgetType: z.string().optional(),

	// Relations
	contactId: z.string().uuid().readonly().optional(),
	contact: ContactRefSchema.optional(),

	// Collections
	projects: z.array(ProjectRefSchema).optional(),
	members: z.array(z.lazy(() => EmployeeSchema)).optional(),
	tags: z.array(TagRefSchema).optional()
});

// Tag Schema
const TagSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	color: z.string().optional(),
	textColor: z.string().optional(),
	icon: z.string().optional(),

	// Collections
	employees: z.array(z.lazy(() => EmployeeSchema)).optional(),
	organizations: z.array(OrganizationRefSchema).optional(),
	projects: z.array(ProjectRefSchema).optional(),
	tasks: z.array(TaskRefSchema).optional(),
	teams: z.array(OrganizationTeamRefSchema).optional()
});

// Product Schema
const ProductSchema = TenantOrganizationBaseSchema.extend({
	code: z.string(),
	enabled: z.boolean().optional().default(true),
	imageUrl: z.string().optional(),

	// Relations
	featuredImageId: z.string().uuid().optional(),
	featuredImage: ImageAssetRefSchema.optional(),
	productTypeId: z.string().uuid().optional(),
	productType: z.object({
		name: z.string(),
		icon: z.string().optional()
	}).optional(),
	productCategoryId: z.string().uuid().optional(),
	productCategory: z.object({
		name: z.string(),
		description: z.string().optional(),
		imageUrl: z.string().optional()
	}).optional(),

	// Collections
	translations: z.array(z.object({
		languageCode: z.string(),
		name: z.string(),
		description: z.string().optional()
	})).optional(),
	tags: z.array(TagRefSchema).optional(),
	variants: z.array(z.object({
		id: z.string().uuid(),
		name: z.string(),
		price: z.number().optional(),
		options: z.record(z.string(), z.any()).optional()
	})).optional(),
	gallery: z.array(ImageAssetRefSchema).optional()
});

// Product Category Schema
const ProductCategorySchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	imageUrl: z.string().optional(),

	// Relations
	imageId: z.string().uuid().optional(),
	image: ImageAssetRefSchema.optional(),

	// Collections
	products: z.array(z.lazy(() => ProductSchema)).optional(),
	translations: z.array(z.object({
		languageCode: z.string(),
		name: z.string(),
		description: z.string().optional()
	})).optional()
});


// Invoice Schema
const InvoiceSchema = TenantOrganizationBaseSchema.extend({
	invoiceNumber: z.string(),
	invoiceDate: z.date(),
	dueDate: z.date(),
	currency: CurrenciesEnum,
	discountValue: z.number().optional().default(0),
	paid: z.boolean().optional().default(false),
	tax: z.number().optional().default(0),
	tax2: z.number().optional().default(0),
	terms: z.string().optional(),
	totalValue: z.number().optional().default(0),
	status: InvoiceStatusEnum.optional().default('DRAFT'),
	invoiceType: InvoiceTypeEnum.optional(),
	sentTo: z.string().email().optional(),

	// Relations
	organizationContactId: z.string().uuid().optional(),
	organizationContact: z.lazy(() => OrganizationContactSchema).optional(),

	// Collections
	invoiceItems: z.array(z.object({
		name: z.string(),
		description: z.string().optional(),
		price: z.number(),
		quantity: z.number(),
		totalValue: z.number(),
		productId: z.string().uuid().optional(),
		projectId: z.string().uuid().optional(),
		taskId: z.string().uuid().optional(),
		employeeId: z.string().uuid().optional()
	})).optional(),
	tags: z.array(TagRefSchema).optional()
});

// Expense Schema
const ExpenseSchema = TenantOrganizationBaseSchema.extend({
	amount: z.number(),
	typeOfExpense: z.string().optional(),
	notes: z.string().optional(),
	currency: CurrenciesEnum,
	valueDate: z.date().optional(),
	purpose: z.string().optional(),
	taxType: z.string().optional(),
	taxLabel: z.string().optional(),
	rateValue: z.number().optional(),
	receipt: z.string().optional(),
	splitExpense: z.boolean().optional().default(false),
	reference: z.string().optional(),
	status: z.string().optional(),

	// Relations
	employeeId: z.string().uuid().optional(),
	employee: z.lazy(() => EmployeeSchema).optional(),
	categoryId: z.string().uuid().optional(),
	category: z.object({
		name: z.string(),
		description: z.string().optional()
	}).optional(),
	projectId: z.string().uuid().optional(),
	project: ProjectRefSchema.optional(),
	organizationContactId: z.string().uuid().optional(),
	organizationContact: z.lazy(() => OrganizationContactSchema).optional(),

	// Collections
	tags: z.array(TagRefSchema).optional()
});

// Income Schema
const IncomeSchema = TenantOrganizationBaseSchema.extend({
	amount: z.number(),
	currency: CurrenciesEnum,
	valueDate: z.date().optional(),
	notes: z.string().optional(),
	isBonus: z.boolean().optional().default(false),
	reference: z.string().optional(),

	// Relations
	employeeId: z.string().uuid().optional(),
	employee: z.lazy(() => EmployeeSchema).optional(),
	organizationContactId: z.string().uuid().optional(),
	organizationContact: z.lazy(() => OrganizationContactSchema).optional(),

	// Collections
	tags: z.array(TagRefSchema).optional()
});

// Goal Schema
const GoalSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	deadline: z.date(),
	level: GoalLevelEnum,
	progress: z.number().min(0).max(100).optional().default(0),

	// Relations
	ownerTeamId: z.string().uuid().optional(),
	ownerTeam: OrganizationTeamRefSchema.optional(),
	ownerEmployeeId: z.string().uuid().optional(),
	ownerEmployee: z.lazy(() => EmployeeSchema).optional(),
	leadId: z.string().uuid().optional(),
	lead: z.lazy(() => EmployeeSchema).optional(),

	// Collections
	keyResults: z.array(z.object({
		id: z.string().uuid(),
		name: z.string(),
		description: z.string().optional(),
		type: z.string().optional(),
		targetValue: z.number().optional(),
		initialValue: z.number().optional(),
		update: z.number().optional(),
		progress: z.number().min(0).max(100).optional().default(0),
		deadline: z.date(),
		status: z.string().optional()
	})).optional(),
	alignedGoals: z.array(z.lazy(() => GoalSchema)).optional()
});

// Key Result Schema
const KeyResultSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	type: z.string().optional(),
	targetValue: z.number().optional(),
	initialValue: z.number().optional(),
	update: z.number().optional(),
	progress: z.number().min(0).max(100).optional().default(0),
	deadline: z.date(),
	status: z.string().optional(),

	// Relations
	goalId: z.string().uuid(),
	goal: z.lazy(() => GoalSchema).optional(),
	ownerId: z.string().uuid().optional(),
	owner: z.lazy(() => EmployeeSchema).optional(),
	leadId: z.string().uuid().optional(),
	lead: z.lazy(() => EmployeeSchema).optional()
});

// Deal Schema
const DealSchema = TenantOrganizationBaseSchema.extend({
	title: z.string(),
	stage: DealStatusEnum.optional().default('LEAD'),

	// Relations
	clientId: z.string().uuid().optional(),
	client: z.lazy(() => OrganizationContactSchema).optional(),
	createdByUserId: z.string().uuid().optional(),

	// Collections
	properties: z.array(z.object({
		name: z.string(),
		value: z.string()
	})).optional()
});

// Contact Schema (for general contacts)
const ContactSchema = TenantOrganizationBaseSchema.extend({
	name: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	address2: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	postcode: z.string().optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	regionCode: z.string().optional(),
	fax: z.string().optional(),
	fiscalInformation: z.string().optional(),
	website: z.string().optional()
});

// Candidate Schema
const CandidateSchema = TenantOrganizationBaseSchema.extend({
	status: CandidateStatusEnum.optional().default('APPLIED'),
	appliedDate: z.date().optional(),
	hiredDate: z.date().optional(),
	rejectDate: z.date().optional(),
	candidateLevel: z.string().optional(),
	reWeeklyLimit: z.number().optional(),
	billRateCurrency: CurrenciesEnum.optional(),
	billRateValue: z.number().optional(),
	minimumBillingRate: z.number().optional(),

	// Ratings and feedback
	rating: z.number().min(0).max(5).optional(),
	valueDate: z.date().optional(),

	// Contact information
	userId: z.string().uuid(),
	user: UserSchema.optional(),
	contactId: z.string().uuid().optional(),
	contact: ContactRefSchema.optional(),

	// Relations
	organizationPositionId: z.string().uuid().optional(),
	organizationPosition: OrganizationPositionRefSchema.optional(),
	sourceId: z.string().uuid().optional(),
	source: z.object({
		name: z.string()
	}).optional(),

	// Collections
	skills: z.array(z.object({
		name: z.string(),
		proficiency: z.string().optional()
	})).optional(),
	experience: z.array(z.object({
		occupation: z.string(),
		organization: z.string(),
		duration: z.string(),
		description: z.string().optional()
	})).optional(),
	education: z.array(z.object({
		schoolName: z.string(),
		degree: z.string(),
		field: z.string(),
		completionDate: z.date().optional(),
		notes: z.string().optional()
	})).optional(),
	documents: z.array(z.object({
		name: z.string(),
		documentUrl: z.string()
	})).optional(),
	tags: z.array(TagRefSchema).optional()
});

// Payment Schema
const PaymentSchema = TenantOrganizationBaseSchema.extend({
	amount: z.number(),
	currency: CurrenciesEnum,
	paymentDate: z.date().optional(),
	note: z.string().optional(),
	paymentMethod: PaymentMethodEnum.optional(),
	status: PaymentStatusEnum.optional().default('PENDING'),
	overdue: z.boolean().optional().default(false),

	// Relations
	invoiceId: z.string().uuid().optional(),
	invoice: z.lazy(() => InvoiceSchema).optional(),
	recordedByUserId: z.string().uuid().optional(),
	recordedBy: UserSchema.optional(),

	// Contact/Client
	organizationContactId: z.string().uuid().optional(),
	organizationContact: z.lazy(() => OrganizationContactSchema).optional(),

	// Project association
	projectId: z.string().uuid().optional(),
	project: ProjectRefSchema.optional()
});

// Merchant Schema
const MerchantSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	code: z.string().optional(),
	email: z.string().email().optional(),
	phone: z.string().optional(),
	description: z.string().optional(),
	logo: z.string().optional(),
	website: z.string().optional(),

	// Contact details
	contactId: z.string().uuid().optional(),
	contact: ContactRefSchema.optional(),

	// Collections
	tags: z.array(TagRefSchema).optional()
});

// Income Schema (updated from previous partial implementation)
const IncomeSchemaFull = TenantOrganizationBaseSchema.extend({
	amount: z.number(),
	currency: CurrenciesEnum,
	valueDate: z.date().optional(),
	notes: z.string().optional(),
	isBonus: z.boolean().optional().default(false),
	reference: z.string().optional(),

	// Relations
	employeeId: z.string().uuid().optional(),
	employee: z.lazy(() => EmployeeSchema).optional(),
	organizationContactId: z.string().uuid().optional(),
	organizationContact: z.lazy(() => OrganizationContactSchema).optional(),

	// Collections
	tags: z.array(TagRefSchema).optional()
});

// Equipment Schema
const EquipmentSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	type: EquipmentTypeEnum.optional(),
	serialNumber: z.string().optional(),
	model: z.string().optional(),
	manufacturer: z.string().optional(),
	description: z.string().optional(),
	color: z.string().optional(),
	initialValue: z.number().optional(),
	currency: CurrenciesEnum.optional(),
	maxSharePeriod: z.number().optional(),
	autoApproveShare: z.boolean().optional().default(false),

	// Tracking
	purchaseDate: z.date().optional(),
	purchaseOrderNumber: z.string().optional(),
	warrantyEndDate: z.date().optional(),

	// Status
	status: EquipmentStatusEnum.optional().default('AVAILABLE'),

	// Assignment
	assignedToEmployeeId: z.string().uuid().optional(),
	assignedTo: z.lazy(() => EmployeeSchema).optional(),

	// Image
	imageId: z.string().uuid().optional(),
	image: ImageAssetRefSchema.optional(),

	// Collections
	tags: z.array(TagRefSchema).optional(),
	equipmentSharings: z.array(z.object({
		id: z.string().uuid(),
		shareRequestDate: z.date(),
		shareStartDate: z.date(),
		shareEndDate: z.date(),
		status: z.string(),
		employeeId: z.string().uuid(),
		employee: z.lazy(() => EmployeeSchema).optional()
	})).optional()
});

// Comment Schema
const CommentSchema = TenantOrganizationBaseSchema.extend({
	comment: z.string(),
	entity: CommentableTypeEnum,
	entityId: z.string().uuid(),

	// Relations
	createdByUserId: z.string().uuid().optional(),
	createdBy: UserSchema.optional(),
	employeeId: z.string().uuid().optional(),
	employee: z.lazy(() => EmployeeSchema).optional(),

	// Reply functionality
	parentId: z.string().uuid().optional(),
	parent: z.lazy(() => CommentSchema).optional(),
	replies: z.array(z.lazy(() => CommentSchema)).optional()
});

// Time Off Policy Schema
const TimeOffPolicySchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	type: TimeOffTypeEnum,
	requiresApproval: z.boolean().optional().default(true),
	paid: z.boolean().optional().default(true),

	// Days configuration
	daysPerYear: z.number().optional(),
	daysPerMonth: z.number().optional(),
	carryForwardExpiryDate: z.date().optional(),
	shouldCarryForward: z.boolean().optional().default(false),

	// Employee assignment
	employees: z.array(z.lazy(() => EmployeeSchema)).optional()
});

// Time Off Request Schema
const TimeOffRequestSchema = TenantOrganizationBaseSchema.extend({
	description: z.string().optional(),
	status: TimeOffStatusEnum.optional().default('REQUESTED'),
	startDate: z.date(),
	endDate: z.date(),
	requestDate: z.date().optional(),
	documentUrl: z.string().optional(),

	// Relations
	employeeId: z.string().uuid(),
	employee: z.lazy(() => EmployeeSchema).optional(),
	policyId: z.string().uuid(),
	policy: TimeOffPolicySchema.optional(),

	// Approval
	approvedBy: z.lazy(() => EmployeeSchema).optional(),
	approvedDate: z.date().optional()
});

// Report Schema
const ReportSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	slug: z.string().optional(),
	description: z.string().optional(),
	image: z.string().optional(),
	iconClass: z.string().optional(),
	showInMenu: z.boolean().optional().default(true),
	category: ReportCategoryEnum.optional(),

	// Report configuration
	reportOrganizations: z.array(z.object({
		reportId: z.string().uuid(),
		organizationId: z.string().uuid(),
		isEnabled: z.boolean().optional().default(true)
	})).optional()
});

// Employee Award Schema
const EmployeeAwardSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	year: z.string(),

	// Relations
	employeeId: z.string().uuid(),
	employee: z.lazy(() => EmployeeSchema).optional()
});

// Activity Log Schema
const ActivityLogSchema = TenantOrganizationBaseSchema.extend({
	entity: ActivityLogEntityEnum,
	entityId: z.string().uuid(),
	action: ActivityLogActionEnum,

	// Metadata
	data: z.record(z.string(), z.any()).optional(),
	previousValues: z.record(z.string(), z.any()).optional(),
	updatedFields: z.array(z.string()).optional(),

	// Relations
	actorType: z.string().optional(),

	// User who performed the action
	createdByUserId: z.string().uuid().optional(),
	createdBy: UserSchema.optional(),

	// Employee context
	employeeId: z.string().uuid().optional(),
	employee: z.lazy(() => EmployeeSchema).optional()
});

// Pipeline Schema
const PipelineSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),

	// Stage configuration
	stages: z.array(z.object({
		id: z.string().uuid(),
		name: z.string(),
		probability: z.number().min(0).max(100).optional(),
		description: z.string().optional()
	})).optional()
});

// Skill Schema
const SkillSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	description: z.string().optional(),
	color: z.string().optional(),

	// Collections
	employees: z.array(z.lazy(() => EmployeeSchema)).optional()
});

// Warehouse Schema
const WarehouseSchema = TenantOrganizationBaseSchema.extend({
	name: z.string(),
	code: z.string(),
	email: z.string().email().optional(),
	description: z.string().optional(),
	active: z.boolean().optional().default(true),

	// Logo
	logoId: z.string().uuid().optional(),
	logo: ImageAssetRefSchema.optional(),

	// Location details
	contactId: z.string().uuid().optional(),
	contact: ContactRefSchema.optional(),

	// Collections
	products: z.array(z.object({
		productId: z.string().uuid(),
		product: z.lazy(() => ProductSchema).optional(),
		quantity: z.number().optional().default(0),
		reserved: z.number().optional().default(0)
	})).optional(),
	merchants: z.array(MerchantSchema).optional(),
	tags: z.array(TagRefSchema).optional()
});

// =====  ALL SCHEMAS =====
export {
	// Enums
	TimeLogTypeEnum,
	TimeLogSourceEnum,
	TaskStatusEnum,
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskTypeEnum,
	PayPeriodEnum,
	CurrenciesEnum,
	DailyPlanStatusEnum,
	ContactTypeEnum,
	BonusTypeEnum,
	DefaultValueDateTypeEnum,
	WeekDaysEnum,
	ProductTypeEnum,
	InvoiceStatusEnum,
	InvoiceTypeEnum,
	ExpenseCategoriesEnum,
	GoalTimeFrameEnum,
	GoalLevelEnum,
	CandidateStatusEnum,
	DealStatusEnum,
	IncomeTypeEnum,
	PaymentStatusEnum,
	PaymentMethodEnum,
	EquipmentTypeEnum,
	EquipmentStatusEnum,
	TimeOffStatusEnum,
	TimeOffTypeEnum,
	ReportCategoryEnum,
	CommentableTypeEnum,
	ActivityLogActionEnum,
	ActivityLogEntityEnum,
	// Base schemas
	BaseEntitySchema,
	TenantBaseSchema,
	TenantOrganizationBaseSchema,
	// Reference schemas
	ContactRefSchema,
	OrganizationPositionRefSchema,
	TagRefSchema,
	ImageAssetRefSchema,
	CustomFieldsSchema,
	OrganizationRefSchema,
	// Entity schemas
	UserSchema,
	EmployeeSchema,
	OrganizationSchema,
	TaskSchema,
	DailyPlanSchema,
	ProjectSchema,
	OrganizationTeamSchema,
	TimeLogSchema,
	TimerSchema,
	TimerStatusSchema,
	OrganizationContactSchema,
	TagSchema,
	// New entity schemas
	ProductSchema,
	ProductCategorySchema,
	WarehouseSchema,
	InvoiceSchema,
	ExpenseSchema,
	IncomeSchema,
	GoalSchema,
	KeyResultSchema,
	DealSchema,
	ContactSchema,
	CandidateSchema,
	// Additional new schemas
	PaymentSchema,
	MerchantSchema,
	IncomeSchemaFull,
	EquipmentSchema,
	CommentSchema,
	TimeOffPolicySchema,
	TimeOffRequestSchema,
	ReportSchema,
	EmployeeAwardSchema,
	ActivityLogSchema,
	PipelineSchema,
	SkillSchema
};

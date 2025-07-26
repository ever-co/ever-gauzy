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
	TagSchema
};

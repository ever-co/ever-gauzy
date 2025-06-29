import { z } from 'zod';

// Enum schemas
export const TimeLogTypeEnum = z.enum(['TRACKED', 'MANUAL', 'RESUMED', 'IDEAL', 'VISITED']);

export const TimeLogSourceEnum = z.enum([
	'BROWSER',
	'DESKTOP',
	'MOBILE',
	'UPWORK',
	'HUBSTAFF',
	'TEAMS',
	'BROWSER_EXTENSION',
	'CLOC'
]);

// Timer schemas
export const TimerSchema = z.object({
	tenantId: z.string().uuid().readonly(),
	organizationId: z.string().uuid().readonly(),
	projectId: z.string().optional(),
	taskId: z.string().uuid().readonly(),
	organizationContactId: z.string().optional().describe("The team associated with this timer"),
    organizationTeamId: z.string().optional().describe("The team associated with this timer"),
	description: z.string().optional(),
	sentTo: z.string().optional(),
	logType: TimeLogTypeEnum.optional(),
	source: TimeLogSourceEnum.optional().default('BROWSER'),
	isBillable: z.boolean().optional(),
	version: z.string().optional(),
	startedAt: z.date().optional(),
	stoppedAt: z.date().optional(),
});

export const TimerStatusSchema = z.object({
	id: z.string().uuid().optional(),
	duration: z.number().readonly(),
	running: z.boolean().readonly(),
	lastLog: z.object({
		deletedAt: z.string().nullable(),
		createdAt: z.string().datetime({ offset: true }).readonly(),
		updatedAt: z.string().date().optional(),
		createdByUserId: z.string().uuid(),
		updatedByUserId: z.string().uuid(),
		deletedByUserId: z.string().nullable(),
		id: z.string().uuid().readonly(),
		isActive: z.boolean().readonly(),
		isArchived: z.boolean().optional(),
		archivedAt: z.string().nullable(),
		tenantId: z.string().uuid().readonly(),
		organizationId: z.string().uuid().readonly(),
		startedAt: z.string().date(),
		stoppedAt: z.string().date(),
		editedAt: z.string().nullable(),
		logType: TimeLogTypeEnum,
		source: TimeLogSourceEnum,
		description: z.string().optional(),
		reason: z.string().nullable().optional(),
		isBillable: z.boolean().readonly(),
		isRunning: z.boolean().readonly(),
		version: z.string().optional(),
		employeeId: z.string().uuid(),
		timesheetId: z.string(),
		projectId: z.string().uuid().optional(),
		taskId: z.string().uuid().optional(),
		organizationContactId: z.string().uuid().optional(),
		organizationTeamId: z.string().uuid().optional(),
		duration: z.number(),
		isEdited: z.boolean().readonly()
	})
});

// Employee schemas
export const EmployeeSchema = z.object({
	userId: z.string().optional(),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string().email().optional(),
	imageUrl: z.string().optional(),
	isActive: z.boolean().optional(),
	tags: z.array(z.any()).optional(),
	user: z.any().optional()
});

// Organization schemas
export const OrganizationSchema = {
	name: z.string(),
	imageUrl: z.string().optional(),
	currency: z.string().optional(),
	defaultValueDateType: z.string().optional(),
	isActive: z.boolean().optional(),
	tags: z.array(z.any()).optional()
};

// Task schemas
export const TaskSchema = {
	title: z.string(),
	description: z.string().optional(),
	status: z.string().optional(),
	priority: z.string().optional(),
	dueDate: z.string().optional(),
	estimate: z.number().optional(),
	projectId: z.string(),
	members: z.array(z.string()).optional(),
	tags: z.array(z.string()).optional()
};

// Project schemas
export const ProjectSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	currency: z.string().optional(),
	billing: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	members: z.array(z.string()).optional()
});

// Time log schemas
export const TimeLogSchema = z.object({
	employeeId: z.string(),
	startedAt: z.date().optional(),
	stoppedAt: z.date().optional(),
	duration: z.number().optional(),
	source: TimeLogSourceEnum.optional(),
	logType: TimeLogTypeEnum.optional(),
	projectId: z.string().optional(),
	taskId: z.string().optional(),
	organizationContactId: z.string().optional(),
	organizationTeamId: z.string().optional(),
	description: z.string().optional(),
	isBillable: z.boolean().optional(),
	version: z.string().optional(),
	isRunning: z.boolean().optional()
});

// User schemas
export const UserSchema = z.object({
	email: z.string().email(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	imageUrl: z.string().optional(),
	role: z.string().optional()
});

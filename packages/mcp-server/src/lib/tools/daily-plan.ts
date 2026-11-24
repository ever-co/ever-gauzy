// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { DAILY_PLAN_STATUS_VALUES, DailyPlanStatusFilter } from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
import { TOOL_HINTS } from './tool-hints';
import {
	applyInTurn,
	buildListQuery,
	getCurrentEmployeeId,
	ListQueryOptions,
	notOfferedByApi,
	pageOfKept,
	toApiValue
} from './utils';
const logger = new Logger('DailyPlanTools');

/** Query of a daily plan list route: the filters inside `where`, and `skip` read as a page number. */
const planListQuery = (
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	{ page, limit, relations }: Pick<ListQueryOptions, 'page' | 'limit' | 'relations'>
) => buildListQuery(defaultParams, where, { page, limit, relations, skipIsPage: true });

/**
 * The route `get_daily_plans` reads: the list route for a team, the employee route for an employee alone, the person's
 * own plans otherwise. The list route refuses an employee who names no team they belong to.
 */
const dailyPlansPath = (organizationTeamId?: string, employeeId?: string) => {
	if (organizationTeamId) {
		return '/api/daily-plan';
	}
	if (employeeId) {
		return `/api/daily-plan/employee/${employeeId}`;
	}
	return '/api/daily-plan/me';
};

/** The `YYYY-MM-DD` day of an instant read in UTC, the way the API answers a plan's date; none for no date. */
const utcDayOf = (date?: string): string | undefined => {
	if (!date) {
		return undefined;
	}
	const time = new Date(date);
	if (Number.isNaN(time.getTime())) {
		throw new Error(`Not a date: ${date}`);
	}
	return time.toISOString().slice(0, 10);
};

/** What a plan list keeps itself rather than sending to its route. */
interface KeptHere {
	date?: string;
	status?: string;
}

/**
 * One page of a daily plan list route. The routes compare `date` to the instant they store in the API's local time, so a
 * day matched no plan: a day is kept here, on the whole list. So is a status: the team and task routes apply none, and
 * the list, own and employee routes apply it under TypeORM only.
 */
const readPlans = (
	path: string,
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	{ page, limit, relations }: Pick<ListQueryOptions, 'page' | 'limit' | 'relations'>,
	{ date, status }: KeptHere = {}
) => {
	const keepsHere = Boolean(date || status);
	if (!keepsHere) {
		return apiClient.get(path, { params: planListQuery(defaultParams, where, { page, limit, relations }) });
	}

	const day = utcDayOf(date);
	const isKept = (plan: { date: string; status?: string }) => {
		const onTheDay = !day || utcDayOf(plan.date) === day;
		const withTheStatus = !status || plan.status === status;
		return onTheDay && withTheStatus;
	};
	const pageQuery = (pageNumber: number, take: number) =>
		planListQuery(defaultParams, where, { page: pageNumber, limit: take, relations });
	return pageOfKept(path, pageQuery, isKept, page, limit);
};

/** A daily plan to create, as the create route requires it: for one employee, in one team. */
const dailyPlanToCreateSchema = z
	.object({
		date: z.string().describe('The date (required)'),
		workTimePlanned: z.number().describe('Work time planned (required)'),
		status: z.string().describe('The status (required)'),
		organizationTeamId: z.string().uuid().describe('The team the plan belongs to (required by the API)'),
		employeeId: z
			.string()
			.uuid()
			.optional()
			.describe("The employee the plan is for (defaults to the signed-in person's own employee)")
	})
	.passthrough();

type DailyPlanToCreate = { date: string; employeeId?: string; [field: string]: unknown };

/**
 * The bodies of the daily plans to create, in the signed-in organization and tenant. A plan that names no employee is
 * the signed-in person's own: their employee is read once, and only when a plan needs it.
 */
const dailyPlansToCreate = async (
	plans: DailyPlanToCreate[],
	{ organizationId, tenantId }: { organizationId?: string; tenantId?: string }
) => {
	const needsOwnEmployee = plans.some((plan) => !plan.employeeId);
	let ownEmployeeId: string | undefined;
	if (needsOwnEmployee) {
		ownEmployeeId = await getCurrentEmployeeId();
	}

	return plans.map((plan) => ({
		...plan,
		employeeId: plan.employeeId ?? ownEmployeeId,
		organizationId,
		...(tenantId && { tenantId }),
		date: new Date(plan.date)
	}));
};

export const registerDailyPlanTools = (server: McpServer) => {
	// Get all daily plans tool
	registerTool(
		server,
		'get_daily_plans',
		"Get daily plans in the authenticated user's organization. With no team and no employee, reads the signed-in " +
			"person's own plans; with a team, that team's plans, where an employee reads only the teams they belong to; " +
			"with an employee and no team, that employee's plans, where an employee reads only their own",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by the day of the plan (ISO date, read in UTC)'),
			status: DailyPlanStatusFilter.optional().describe('Filter by status'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["employee", "tasks", "organizationTeam"])')
		},
		async ({ employeeId, organizationTeamId, date, status, page = 1, limit = 10, relations }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const storedStatus = toApiValue(DAILY_PLAN_STATUS_VALUES, status);
				const where = { employeeId, organizationTeamId, status: storedStatus };
				const path = dailyPlansPath(organizationTeamId, employeeId);
				const kept = { date, status: storedStatus };

				const response = await readPlans(path, defaultParams, where, { page, limit, relations }, kept);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get my daily plans tool
	registerTool(
		server,
		'get_my_daily_plans',
		'Get daily plans for the current authenticated user',
		{
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by the day of the plan (ISO date, read in UTC)'),
			status: DailyPlanStatusFilter.optional().describe('Filter by status'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ organizationTeamId, date, status, page = 1, limit = 10, relations }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const storedStatus = toApiValue(DAILY_PLAN_STATUS_VALUES, status);
				const where = { organizationTeamId, status: storedStatus };
				const options = { page, limit, relations };
				const kept = { date, status: storedStatus };

				const response = await readPlans('/api/daily-plan/me', defaultParams, where, options, kept);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get team daily plans tool
	registerTool(
		server,
		'get_team_daily_plans',
		'Get daily plans for team members',
		{
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by the day of the plan (ISO date, read in UTC)'),
			status: DailyPlanStatusFilter.optional().describe('Filter by status'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ organizationTeamId, date, status, page = 1, limit = 10, relations }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();
				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				// The team route applies no status: it is kept here
				const kept = { date, status: toApiValue(DAILY_PLAN_STATUS_VALUES, status) };
				const options = { page, limit, relations };

				const response = await readPlans(
					'/api/daily-plan/team',
					{ organizationId, tenantId },
					{ organizationTeamId },
					options,
					kept
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching team daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch team daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get employee daily plans tool
	registerTool(
		server,
		'get_employee_daily_plans',
		'Get daily plans for a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			date: z.string().optional().describe('Filter by the day of the plan (ISO date, read in UTC)'),
			status: DailyPlanStatusFilter.optional().describe('Filter by status'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ employeeId, date, status, page = 1, limit = 10, relations }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();
				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const storedStatus = toApiValue(DAILY_PLAN_STATUS_VALUES, status);
				const options = { page, limit, relations };

				const response = await readPlans(
					`/api/daily-plan/employee/${employeeId}`,
					{ organizationId, tenantId },
					{ status: storedStatus },
					options,
					{ date, status: storedStatus }
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch employee daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get daily plans for task tool
	registerTool(
		server,
		'get_daily_plans_for_task',
		'Get daily plans associated with a specific task',
		{
			taskId: z.string().uuid().describe('The task ID'),
			date: z.string().optional().describe('Filter by the day of the plan (ISO date, read in UTC)'),
			status: DailyPlanStatusFilter.optional().describe('Filter by status'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ taskId, date, status, page = 1, limit = 10, relations }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();
				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				// The task route applies no status: it is kept here
				const kept = { date, status: toApiValue(DAILY_PLAN_STATUS_VALUES, status) };
				const options = { page, limit, relations };

				const response = await readPlans(
					`/api/daily-plan/task/${taskId}`,
					{ organizationId, tenantId },
					{},
					options,
					kept
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching daily plans for task:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch daily plans for task: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get daily plan by ID tool
	registerTool(
		server,
		'get_daily_plan',
		'Get a specific daily plan by ID',
		{
			id: z.string().uuid().describe('The daily plan ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["employee", "tasks", "organizationTeam"])')
		},
		async ({ id, relations }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/daily-plan/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching daily plan:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch daily plan: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Create daily plan tool
	registerTool(
		server,
		'create_daily_plan',
		"Create a new daily plan for the authenticated user's organization",
		{
			daily_plan_data: dailyPlanToCreateSchema.describe('The data for creating the daily plan')
		},
		async ({ daily_plan_data }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const [createData] = await dailyPlansToCreate([daily_plan_data], defaultParams);

				const response = await apiClient.post('/api/daily-plan', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating daily plan:', sanitizeForLogging(error));
				throw new Error(`Failed to create daily plan: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.write
	);

	// Update daily plan tool
	registerTool(
		server,
		'update_daily_plan',
		'Update an existing daily plan',
		{
			id: z.string().uuid().describe('The daily plan ID'),
			plan_data: z.record(z.string(), z.any()).describe('The fields to update on the daily plan')
		},
		async ({ id, plan_data }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const updateData = {
					...plan_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};
				const response = await apiClient.put(`/api/daily-plan/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating daily plan:', sanitizeForLogging(error));
				throw new Error(`Failed to update daily plan: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Delete daily plan tool
	registerTool(
		server,
		'delete_daily_plan',
		'Delete a daily plan by ID',
		{
			id: z.string().uuid().describe('The daily plan ID')
		},
		async ({ id }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};
				await apiClient.delete(`/api/daily-plan/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Daily plan deleted successfully' }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting daily plan:', sanitizeForLogging(error));
				throw new Error(`Failed to delete daily plan: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Add task to daily plan tool
	registerTool(
		server,
		'add_task_to_daily_plan',
		'Add a task to a daily plan',
		{
			planId: z.string().uuid().describe('The daily plan ID'),
			taskId: z.string().uuid().describe('The task ID to add'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ planId, taskId, employeeId }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();

				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const response = await apiClient.post(`/api/daily-plan/${planId}/task`, {
					taskId,
					employeeId,
					organizationId,
					...(tenantId && { tenantId })
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding task to daily plan:', sanitizeForLogging(error));
				throw new Error(`Failed to add task to daily plan: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.write
	);

	// Remove task from daily plan tool
	registerTool(
		server,
		'remove_task_from_daily_plan',
		'Remove a task from a daily plan',
		{
			planId: z.string().uuid().describe('The daily plan ID'),
			taskId: z.string().uuid().describe('The task ID to remove'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ planId, taskId, employeeId }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();

				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const response = await apiClient.put(`/api/daily-plan/${planId}/task`, {
					taskId,
					employeeId,
					organizationId,
					...(tenantId && { tenantId })
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error removing task from daily plan:', sanitizeForLogging(error));
				throw new Error(`Failed to remove task from daily plan: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Remove task from many daily plans tool
	registerTool(
		server,
		'remove_task_from_many_daily_plans',
		'Remove a task from multiple daily plans',
		{
			taskId: z.string().uuid().describe('The task ID to remove'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ taskId, employeeId }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();

				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const response = await apiClient.put(`/api/daily-plan/${taskId}/remove`, {
					employeeId,
					organizationId,
					...(tenantId && { tenantId })
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error removing task from many daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to remove task from many daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Get daily plan count tool
	registerTool(
		server,
		'get_daily_plan_count',
		'Get daily plan count in the same tenant',
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusFilter.optional().describe('Filter by status')
		},
		async ({ employeeId, organizationTeamId, date, status }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();

				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(employeeId && { employeeId }),
					...(organizationTeamId && { organizationTeamId }),
					...(date && { date }),
					...(status && { status: toApiValue(DAILY_PLAN_STATUS_VALUES, status) })
				};

				const response = await apiClient.get('/api/daily-plan/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching daily plan count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch daily plan count: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get daily plan statistics tool
	registerTool(
		server,
		'get_daily_plan_statistics',
		'Get daily plan statistics for an organization or employee',
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async () => {
			try {
				throw notOfferedByApi('daily plan statistics');
			} catch (error) {
				logger.error('Error fetching daily plan statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch daily plan statistics: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Bulk create daily plans tool
	registerTool(
		server,
		'bulk_create_daily_plans',
		'Create multiple daily plans in bulk',
		{
			plans: z.array(dailyPlanToCreateSchema).describe('Array of daily plans to create')
		},
		async ({ plans }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const plansToCreate = await dailyPlansToCreate(plans, defaultParams);
				const response = await applyInTurn(plansToCreate, (plan) => apiClient.post('/api/daily-plan', plan));

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk create daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.write
	);

	// Bulk update daily plans tool
	registerTool(
		server,
		'bulk_update_daily_plans',
		'Update multiple daily plans in bulk',
		{
			plans: z
				.array(
					z
						.object({
							id: z.string().describe('The ID (required)'),
							date: z.string().describe('The date (required)'),
							workTimePlanned: z.number().describe('Work time planned (required)'),
							status: z.string().describe('The status (required)')
						})
						.passthrough()
				)
				.describe('Array of daily plans to update')
		},
		async ({ plans }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const response = await applyInTurn(plans, ({ id, ...plan }) =>
					apiClient.put(`/api/daily-plan/${id}`, {
						...plan,
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
					})
				);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk updating daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk update daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Bulk delete daily plans tool
	registerTool(
		server,
		'bulk_delete_daily_plans',
		'Delete multiple daily plans in bulk',
		{
			ids: z.array(z.string().uuid()).describe('Array of daily plan IDs to delete')
		},
		async ({ ids }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};
				const response = await applyInTurn(ids, (id) => apiClient.delete(`/api/daily-plan/${id}`, { params }));

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk deleting daily plans:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk delete daily plans: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);
};

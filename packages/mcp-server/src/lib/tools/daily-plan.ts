import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { DailyPlanSchema, DailyPlanStatusEnum } from '../schema';

const logger = new Logger('DailyPlanTools');

export const registerDailyPlanTools = (server: McpServer) => {
	// Get all daily plans tool
	server.tool(
		'get_daily_plans',
		"Get all daily plans for the authenticated user's organization",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusEnum.optional().describe('Filter by status'),
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId }),
					...(organizationTeamId && { organizationTeamId }),
					...(date && { date }),
					...(status && { status }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/daily-plan', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching daily plans:', errorMsg);
				throw new Error(`Failed to fetch daily plans: ${errorMsg}`);
			}
		}
	);

	// Get my daily plans tool
	server.tool(
		'get_my_daily_plans',
		'Get daily plans for the current authenticated user',
		{
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusEnum.optional().describe('Filter by status'),
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(organizationTeamId && { organizationTeamId }),
					...(date && { date }),
					...(status && { status }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/daily-plan/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching my daily plans:', errorMsg);
				throw new Error(`Failed to fetch my daily plans: ${errorMsg}`);
			}
		}
	);

	// Get team daily plans tool
	server.tool(
		'get_team_daily_plans',
		'Get daily plans for team members',
		{
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusEnum.optional().describe('Filter by status'),
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
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(organizationTeamId && { organizationTeamId }),
					...(date && { date }),
					...(status && { status }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/daily-plan/team', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching team daily plans:', errorMsg);
				throw new Error(`Failed to fetch team daily plans: ${errorMsg}`);
			}
		}
	);

	// Get employee daily plans tool
	server.tool(
		'get_employee_daily_plans',
		'Get daily plans for a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusEnum.optional().describe('Filter by status'),
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
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(date && { date }),
					...(status && { status }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/daily-plan/employee/${employeeId}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching employee daily plans:', errorMsg);
				throw new Error(`Failed to fetch employee daily plans: ${errorMsg}`);
			}
		}
	);

	// Get daily plans for task tool
	server.tool(
		'get_daily_plans_for_task',
		'Get daily plans associated with a specific task',
		{
			taskId: z.string().uuid().describe('The task ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusEnum.optional().describe('Filter by status'),
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
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(date && { date }),
					...(status && { status }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/daily-plan/task/${taskId}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching daily plans for task:', errorMsg);
				throw new Error(`Failed to fetch daily plans for task: ${errorMsg}`);
			}
		}
	);

	// Get daily plan by ID tool
	server.tool(
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching daily plan:', errorMsg);
				throw new Error(`Failed to fetch daily plan: ${errorMsg}`);
			}
		}
	);

	// Create daily plan tool
	server.tool(
		'create_daily_plan',
		"Create a new daily plan for the authenticated user's organization",
		{
			daily_plan_data: DailyPlanSchema.partial()
				.required({
					date: true,
					workTimePlanned: true,
					status: true
				})
				.describe('The data for creating the daily plan')
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

				const createData = {
					...daily_plan_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					date: new Date(daily_plan_data.date)
				};

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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error creating daily plan:', errorMsg);
				throw new Error(`Failed to create daily plan: ${errorMsg}`);
			}
		}
	);

	// Update daily plan tool
	server.tool(
		'update_daily_plan',
		'Update an existing daily plan',
		{
			id: z.string().uuid().describe('The daily plan ID'),
			plan_data: DailyPlanSchema.partial().describe('The fields to update on the daily plan')
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error updating daily plan:', errorMsg);
				throw new Error(`Failed to update daily plan: ${errorMsg}`);
			}
		}
	);

	// Delete daily plan tool
	server.tool(
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error deleting daily plan:', errorMsg);
				throw new Error(`Failed to delete daily plan: ${errorMsg}`);
			}
		}
	);

	// Add task to daily plan tool
	server.tool(
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error adding task to daily plan:', errorMsg);
				throw new Error(`Failed to add task to daily plan: ${errorMsg}`);
			}
		}
	);

	// Remove task from daily plan tool
	server.tool(
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error removing task from daily plan:', errorMsg);
				throw new Error(`Failed to remove task from daily plan: ${errorMsg}`);
			}
		}
	);

	// Remove task from many daily plans tool
	server.tool(
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error removing task from many daily plans:', errorMsg);
				throw new Error(`Failed to remove task from many daily plans: ${errorMsg}`);
			}
		}
	);

	// Get daily plan count tool
	server.tool(
		'get_daily_plan_count',
		'Get daily plan count in the same tenant',
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			date: z.string().optional().describe('Filter by specific date (ISO format)'),
			status: DailyPlanStatusEnum.optional().describe('Filter by status')
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
					...(status && { status })
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching daily plan count:', errorMsg);
				throw new Error(`Failed to fetch daily plan count: ${errorMsg}`);
			}
		}
	);

	// Get daily plan statistics tool
	server.tool(
		'get_daily_plan_statistics',
		'Get daily plan statistics for an organization or employee',
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationTeamId: z.string().uuid().optional().describe('Filter by team ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ employeeId, organizationTeamId, startDate, endDate }) => {
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
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/daily-plan/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error fetching daily plan statistics:', errorMsg);
				throw new Error(`Failed to fetch daily plan statistics: ${errorMsg}`);
			}
		}
	);

	// Bulk create daily plans tool
	server.tool(
		'bulk_create_daily_plans',
		'Create multiple daily plans in bulk',
		{
			plans: z
				.array(
					DailyPlanSchema.partial().required({
						date: true,
						workTimePlanned: true,
						status: true
					})
				)
				.describe('Array of daily plans to create')
		},
		async ({ plans }) => {
			try {
				const { organizationId, tenantId } = authManager.getDefaultParams();
				if (!organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const plansWithOrg = plans.map((plan) => ({
					...plan,
					organizationId,
					...(tenantId && { tenantId })
				}));
				const response = await apiClient.post('/api/daily-plan/bulk', { plans: plansWithOrg });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error bulk creating daily plans:', errorMsg);
				throw new Error(`Failed to bulk create daily plans: ${errorMsg}`);
			}
		}
	);

	// Bulk update daily plans tool
	server.tool(
		'bulk_update_daily_plans',
		'Update multiple daily plans in bulk',
		{
			plans: z
				.array(
					DailyPlanSchema.partial().required({
						id: true,
						date: true,
						workTimePlanned: true,
						status: true
					})
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
				const plansWithOrg = plans.map((plan) => ({
					...plan,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));
				const response = await apiClient.put('/api/daily-plan/bulk', { plans: plansWithOrg });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error bulk updating daily plans:', errorMsg);
				throw new Error(`Failed to bulk update daily plans: ${errorMsg}`);
			}
		}
	);

	// Bulk delete daily plans tool
	server.tool(
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
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					ids
				};
				const response = await apiClient.delete('/api/daily-plan/bulk', {
					data: { ids },
					params
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
				const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : JSON.stringify(error);
				logger.error('Error bulk deleting daily plans:', errorMsg);
				throw new Error(`Failed to bulk delete daily plans: ${errorMsg}`);
			}
		}
	);
};

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { GoalSchema, GoalLevelEnum, GoalTimeFrameEnum } from '../schema';

const logger = new Logger('GoalTools');

/**
 * Helper function to validate organization context and return default parameters
 */
const validateOrganizationContext = () => {
	const defaultParams = authManager.getDefaultParams();

	if (!defaultParams.organizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return defaultParams;
};

/**
 * Helper function to convert date fields in goal data to Date objects
 */
const convertGoalDateFields = (goalData: any) => {
	return {
		...goalData,
		deadline: goalData.deadline ? new Date(goalData.deadline) : undefined
	};
};

export const registerGoalTools = (server: McpServer) => {
	// Get goals tool
	server.tool(
		'get_goals',
		"Get list of goals for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for goal name or description'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["ownerTeam", "ownerEmployee", "keyResults"])'),
			level: GoalLevelEnum.optional().describe('Filter by goal level'),
			ownerEmployeeId: z.string().uuid().optional().describe('Filter by owner employee ID'),
			ownerTeamId: z.string().uuid().optional().describe('Filter by owner team ID'),
			status: z.string().optional().describe('Filter by goal status')
		},
		async ({ page = 1, limit = 10, search, relations, level, ownerEmployeeId, ownerTeamId, status }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(level && { level }),
					...(ownerEmployeeId && { ownerEmployeeId }),
					...(ownerTeamId && { ownerTeamId }),
					...(status && { status })
				};

				const response = await apiClient.get('/api/goals', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching goals:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch goals: ${message}`);
			}
		}
	);

	// Get goal count tool
	server.tool(
		'get_goal_count',
		"Get goal count in the authenticated user's organization",
		{
			level: GoalLevelEnum.optional().describe('Filter by goal level'),
			ownerEmployeeId: z.string().uuid().optional().describe('Filter by owner employee ID'),
			ownerTeamId: z.string().uuid().optional().describe('Filter by owner team ID'),
			status: z.string().optional().describe('Filter by goal status')
		},
		async ({ level, ownerEmployeeId, ownerTeamId, status }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(level && { level }),
					...(ownerEmployeeId && { ownerEmployeeId }),
					...(ownerTeamId && { ownerTeamId }),
					...(status && { status })
				};

				const response = await apiClient.get('/api/goals/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching goal count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch goal count: ${message}`);
			}
		}
	);

	// Get goal by ID tool
	server.tool(
		'get_goal',
		'Get a specific goal by ID',
		{
			id: z.string().uuid().describe('The goal ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["ownerTeam", "ownerEmployee", "keyResults", "alignedGoals"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/goals/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching goal:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch goal: ${message}`);
			}
		}
	);

	// Create goal tool
	server.tool(
		'create_goal',
		"Create a new goal in the authenticated user's organization",
		{
			goal_data: GoalSchema.partial()
				.required({
					name: true,
					deadline: true,
					level: true
				})
				.describe('The data for creating the goal')
		},
		async ({ goal_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertGoalDateFields({
					...goal_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/goals', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating goal:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create goal: ${message}`);
			}
		}
	);

	// Update goal tool
	server.tool(
		'update_goal',
		'Update an existing goal',
		{
			id: z.string().uuid().describe('The goal ID'),
			goal_data: GoalSchema.partial().describe('The data for updating the goal')
		},
		async ({ id, goal_data }) => {
			try {
				const updateData = convertGoalDateFields(goal_data);

				const response = await apiClient.put(`/api/goals/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating goal:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update goal: ${message}`);
			}
		}
	);

	// Update goal progress tool
	server.tool(
		'update_goal_progress',
		'Update the progress of a goal',
		{
			id: z.string().uuid().describe('The goal ID'),
			progress: z.number().min(0).max(100).describe('The progress percentage (0-100)')
		},
		async ({ id, progress }) => {
			try {
				const response = await apiClient.put(`/api/goals/${id}/progress`, { progress });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating goal progress:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update goal progress: ${message}`);
			}
		}
	);

	// Delete goal tool
	server.tool(
		'delete_goal',
		'Delete a goal',
		{
			id: z.string().uuid().describe('The goal ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/goals/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Goal deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting goal:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete goal: ${message}`);
			}
		}
	);

	// Get my goals tool
	server.tool(
		'get_my_goals',
		'Get goals assigned to the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			level: GoalLevelEnum.optional().describe('Filter by goal level'),
			status: z.string().optional().describe('Filter by goal status')
		},
		async ({ page = 1, limit = 10, level, status }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(level && { level }),
					...(status && { status })
				};

				const response = await apiClient.get('/api/goals/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my goals:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch my goals: ${message}`);
			}
		}
	);

	// Get team goals tool
	server.tool(
		'get_team_goals',
		'Get goals for a specific team',
		{
			teamId: z.string().uuid().describe('The team ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: z.string().optional().describe('Filter by goal status')
		},
		async ({ teamId, page = 1, limit = 10, status }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					ownerTeamId: teamId,
					page,
					limit,
					...(status && { status })
				};

				const response = await apiClient.get('/api/goals', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching team goals:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch team goals: ${message}`);
			}
		}
	);

	// Get goal statistics tool
	server.tool(
		'get_goal_statistics',
		"Get goal statistics for the authenticated user's organization",
		{
			level: GoalLevelEnum.optional().describe('Filter by goal level'),
			ownerEmployeeId: z.string().uuid().optional().describe('Filter by owner employee ID'),
			ownerTeamId: z.string().uuid().optional().describe('Filter by owner team ID'),
			startDate: z.string().optional().describe('Start date for goal statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for goal statistics (ISO format)')
		},
		async ({ level, ownerEmployeeId, ownerTeamId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(level && { level }),
					...(ownerEmployeeId && { ownerEmployeeId }),
					...(ownerTeamId && { ownerTeamId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/goals/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching goal statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch goal statistics: ${message}`);
			}
		}
	);

	// Align goals tool
	server.tool(
		'align_goals',
		'Align one goal with another (create goal alignment)',
		{
			parentGoalId: z.string().uuid().describe('The parent goal ID'),
			childGoalId: z.string().uuid().describe('The child goal ID to align with parent')
		},
		async ({ parentGoalId, childGoalId }) => {
			try {
				const response = await apiClient.post(`/api/goals/${parentGoalId}/align`, { childGoalId });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error aligning goals:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to align goals: ${message}`);
			}
		}
	);

	// Get goal templates tool
	server.tool(
		'get_goal_templates',
		"Get goal templates for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for template name'),
			level: GoalLevelEnum.optional().describe('Filter by goal level')
		},
		async ({ page = 1, limit = 10, search, level }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(level && { level })
				};

				const response = await apiClient.get('/api/goal-templates', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching goal templates:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch goal templates: ${message}`);
			}
		}
	);
};
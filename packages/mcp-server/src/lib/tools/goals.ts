import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { GoalSchema, GoalLevelEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('GoalTools');


/**
 * Helper function to convert date fields in goal data to Date objects
 */
interface GoalData {
	deadline?: string | Date;
	[key: string]: any; // Allow other properties since we spread them
}

interface ConvertedGoalData extends Omit<GoalData, 'deadline'> {
	deadline?: Date;
}

const convertGoalDateFields = (goalData: GoalData): ConvertedGoalData => {
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
				logger.error('Error fetching goals:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch goals: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching goal count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch goal count: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching goal:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch goal: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error creating goal:', sanitizeForLogging(error));
				throw new Error(`Failed to create goal: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error updating goal:', sanitizeForLogging(error));
				throw new Error(`Failed to update goal: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error updating goal progress:', sanitizeForLogging(error));
				throw new Error(`Failed to update goal progress: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error deleting goal:', sanitizeForLogging(error));
				throw new Error(`Failed to delete goal: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching my goals:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my goals: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching team goals:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch team goals: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching goal statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch goal statistics: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error aligning goals:', sanitizeForLogging(error));
				throw new Error(`Failed to align goals: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching goal templates:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch goal templates: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

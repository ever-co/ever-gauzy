import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { KeyResultSchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('KeyResultTools');


/**
 * Helper function to convert date fields in key result data to Date objects
 */
interface KeyResultData {
	deadline?: string | Date;
	[key: string]: any; // Allow other properties since we spread them
}

interface ConvertedKeyResultData extends Omit<KeyResultData, 'deadline'> {
	deadline?: Date;
}

const convertKeyResultDateFields = (keyResultData: KeyResultData): ConvertedKeyResultData => {
	return {
		...keyResultData,
		deadline: keyResultData.deadline ? new Date(keyResultData.deadline) : undefined
	};
};

export const registerKeyResultTools = (server: McpServer) => {
	// Get key results tool
	server.tool(
		'get_key_results',
		"Get list of key results for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for key result name or description'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["goal", "owner", "lead"])'),
			goalId: z.string().uuid().optional().describe('Filter by goal ID'),
			ownerId: z.string().uuid().optional().describe('Filter by owner ID'),
			status: z.string().optional().describe('Filter by key result status')
		},
		async ({ page = 1, limit = 10, search, relations, goalId, ownerId, status }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(goalId && { goalId }),
					...(ownerId && { ownerId }),
					...(status && { status })
				};

				const response = await apiClient.get('/api/key-results', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching key results:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch key results: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get key result count tool
	server.tool(
		'get_key_result_count',
		"Get key result count in the authenticated user's organization",
		{
			goalId: z.string().uuid().optional().describe('Filter by goal ID'),
			ownerId: z.string().uuid().optional().describe('Filter by owner ID'),
			status: z.string().optional().describe('Filter by key result status')
		},
		async ({ goalId, ownerId, status }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(goalId && { goalId }),
					...(ownerId && { ownerId }),
					...(status && { status })
				};

				const response = await apiClient.get('/api/key-results/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching key result count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch key result count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get key result by ID tool
	server.tool(
		'get_key_result',
		'Get a specific key result by ID',
		{
			id: z.string().uuid().describe('The key result ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["goal", "owner", "lead"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/key-results/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching key result:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch key result: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create key result tool
	server.tool(
		'create_key_result',
		"Create a new key result in the authenticated user's organization",
		{
			key_result_data: KeyResultSchema.partial()
				.required({
					name: true,
					goalId: true,
					deadline: true
				})
				.describe('The data for creating the key result')
		},
		async ({ key_result_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertKeyResultDateFields({
					...key_result_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/key-results', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating key result:', sanitizeForLogging(error));
				throw new Error(`Failed to create key result: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update key result tool
	server.tool(
		'update_key_result',
		'Update an existing key result',
		{
			id: z.string().uuid().describe('The key result ID'),
			key_result_data: KeyResultSchema.partial().describe('The data for updating the key result')
		},
		async ({ id, key_result_data }) => {
			try {
				const updateData = convertKeyResultDateFields(key_result_data);

				const response = await apiClient.put(`/api/key-results/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating key result:', sanitizeForLogging(error));
				throw new Error(`Failed to update key result: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update key result progress tool
	server.tool(
		'update_key_result_progress',
		'Update the progress of a key result',
		{
			id: z.string().uuid().describe('The key result ID'),
			progress: z.number().min(0).max(100).describe('The progress percentage (0-100)'),
			update: z.number().optional().describe('The current update value')
		},
		async ({ id, progress, update }) => {
			try {
				const updateData = {
					progress,
					...(update !== undefined && { update })
				};

				const response = await apiClient.put(`/api/key-results/${id}/progress`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating key result progress:', sanitizeForLogging(error));
				throw new Error(`Failed to update key result progress: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete key result tool
	server.tool(
		'delete_key_result',
		'Delete a key result',
		{
			id: z.string().uuid().describe('The key result ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/key-results/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Key result deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting key result:', sanitizeForLogging(error));
				throw new Error(`Failed to delete key result: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get key results by goal tool
	server.tool(
		'get_key_results_by_goal',
		'Get all key results for a specific goal',
		{
			goalId: z.string().uuid().describe('The goal ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: z.string().optional().describe('Filter by key result status'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ goalId, page = 1, limit = 10, status, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					goalId,
					page,
					limit,
					...(status && { status }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/key-results', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching key results by goal:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch key results by goal: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my key results tool
	server.tool(
		'get_my_key_results',
		'Get key results assigned to the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: z.string().optional().describe('Filter by key result status'),
			goalId: z.string().uuid().optional().describe('Filter by specific goal ID')
		},
		async ({ page = 1, limit = 10, status, goalId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(status && { status }),
					...(goalId && { goalId })
				};

				const response = await apiClient.get('/api/key-results/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my key results:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my key results: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create key result update tool
	server.tool(
		'create_key_result_update',
		'Create an update for a key result',
		{
			keyResultId: z.string().uuid().describe('The key result ID'),
			update_data: z.object({
				update: z.number().describe('The current value/update'),
				progress: z.number().min(0).max(100).describe('The progress percentage (0-100)'),
				description: z.string().optional().describe('Description of the update'),
				status: z.string().optional().describe('Status of the key result')
			}).describe('The update data')
		},
		async ({ keyResultId, update_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...update_data,
					keyResultId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/keyresult-updates', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating key result update:', sanitizeForLogging(error));
				throw new Error(`Failed to create key result update: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get key result updates tool
	server.tool(
		'get_key_result_updates',
		'Get updates for a specific key result',
		{
			keyResultId: z.string().uuid().describe('The key result ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page')
		},
		async ({ keyResultId, page = 1, limit = 10 }) => {
			try {
				const params = {
					keyResultId,
					page,
					limit
				};

				const response = await apiClient.get('/api/keyresult-updates', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching key result updates:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch key result updates: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get key result statistics tool
	server.tool(
		'get_key_result_statistics',
		"Get key result statistics for the authenticated user's organization",
		{
			goalId: z.string().uuid().optional().describe('Filter by specific goal ID'),
			ownerId: z.string().uuid().optional().describe('Filter by owner ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ goalId, ownerId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(goalId && { goalId }),
					...(ownerId && { ownerId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/key-results/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching key result statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch key result statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

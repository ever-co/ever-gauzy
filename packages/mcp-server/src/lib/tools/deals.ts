import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { DealSchema, DealStatusEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('DealTools');


export const registerDealTools = (server: McpServer) => {
	// Get deals tool
	server.tool(
		'get_deals',
		"Get list of deals for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for deal title'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["client", "createdByUser"])'),
			stage: DealStatusEnum.optional().describe('Filter by deal stage'),
			clientId: z.string().uuid().optional().describe('Filter by client ID'),
			createdByUserId: z.string().uuid().optional().describe('Filter by creator user ID')
		},
		async ({ page = 1, limit = 10, search, relations, stage, clientId, createdByUserId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(stage && { stage }),
					...(clientId && { clientId }),
					...(createdByUserId && { createdByUserId })
				};

				const response = await apiClient.get('/api/deals', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching deals:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deals: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get deal count tool
	server.tool(
		'get_deal_count',
		"Get deal count in the authenticated user's organization",
		{
			stage: DealStatusEnum.optional().describe('Filter by deal stage'),
			clientId: z.string().uuid().optional().describe('Filter by client ID'),
			createdByUserId: z.string().uuid().optional().describe('Filter by creator user ID')
		},
		async ({ stage, clientId, createdByUserId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(stage && { stage }),
					...(clientId && { clientId }),
					...(createdByUserId && { createdByUserId })
				};

				const response = await apiClient.get('/api/deals/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching deal count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deal count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get deal by ID tool
	server.tool(
		'get_deal',
		'Get a specific deal by ID',
		{
			id: z.string().uuid().describe('The deal ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["client", "createdByUser", "properties"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/deals/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching deal:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deal: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create deal tool
	server.tool(
		'create_deal',
		"Create a new deal in the authenticated user's organization",
		{
			deal_data: DealSchema.partial()
				.required({
					title: true
				})
				.describe('The data for creating the deal')
		},
		async ({ deal_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...deal_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/deals', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating deal:', sanitizeForLogging(error));
				throw new Error(`Failed to create deal: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update deal tool
	server.tool(
		'update_deal',
		'Update an existing deal',
		{
			id: z.string().uuid().describe('The deal ID'),
			deal_data: DealSchema.partial().describe('The data for updating the deal')
		},
		async ({ id, deal_data }) => {
			try {
				const response = await apiClient.put(`/api/deals/${id}`, deal_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating deal:', sanitizeForLogging(error));
				throw new Error(`Failed to update deal: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update deal stage tool
	server.tool(
		'update_deal_stage',
		'Update the stage of a deal',
		{
			id: z.string().uuid().describe('The deal ID'),
			stage: DealStatusEnum.describe('The new stage for the deal')
		},
		async ({ id, stage }) => {
			try {
				const response = await apiClient.put(`/api/deals/${id}/stage`, { stage });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating deal stage:', sanitizeForLogging(error));
				throw new Error(`Failed to update deal stage: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete deal tool
	server.tool(
		'delete_deal',
		'Delete a deal',
		{
			id: z.string().uuid().describe('The deal ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/deals/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Deal deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting deal:', sanitizeForLogging(error));
				throw new Error(`Failed to delete deal: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get deals by client tool
	server.tool(
		'get_deals_by_client',
		'Get deals for a specific client',
		{
			clientId: z.string().uuid().describe('The client ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			stage: DealStatusEnum.optional().describe('Filter by deal stage'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ clientId, page = 1, limit = 10, stage, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					clientId,
					page,
					limit,
					...(stage && { stage }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/deals', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching deals by client:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deals by client: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my deals tool
	server.tool(
		'get_my_deals',
		'Get deals created by the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			stage: DealStatusEnum.optional().describe('Filter by deal stage'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, stage, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(stage && { stage }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/deals/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my deals:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my deals: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get deal statistics tool
	server.tool(
		'get_deal_statistics',
		"Get deal statistics for the authenticated user's organization",
		{
			clientId: z.string().uuid().optional().describe('Filter by specific client ID'),
			createdByUserId: z.string().uuid().optional().describe('Filter by creator user ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ clientId, createdByUserId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(clientId && { clientId }),
					...(createdByUserId && { createdByUserId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/deals/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching deal statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deal statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Add deal property tool
	server.tool(
		'add_deal_property',
		'Add a custom property to a deal',
		{
			dealId: z.string().uuid().describe('The deal ID'),
			property: z.object({
				name: z.string().describe('Property name'),
				value: z.string().describe('Property value')
			}).describe('The property to add')
		},
		async ({ dealId, property }) => {
			try {
				const response = await apiClient.post(`/api/deals/${dealId}/properties`, property);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding deal property:', sanitizeForLogging(error));
				throw new Error(`Failed to add deal property: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update deal property tool
	server.tool(
		'update_deal_property',
		'Update a custom property of a deal',
		{
			dealId: z.string().uuid().describe('The deal ID'),
			propertyName: z.string().describe('The property name to update'),
			value: z.string().describe('The new property value')
		},
		async ({ dealId, propertyName, value }) => {
			try {
				const response = await apiClient.put(`/api/deals/${dealId}/properties/${propertyName}`, { value });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating deal property:', sanitizeForLogging(error));
				throw new Error(`Failed to update deal property: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Remove deal property tool
	server.tool(
		'remove_deal_property',
		'Remove a custom property from a deal',
		{
			dealId: z.string().uuid().describe('The deal ID'),
			propertyName: z.string().describe('The property name to remove')
		},
		async ({ dealId, propertyName }) => {
			try {
				await apiClient.delete(`/api/deals/${dealId}/properties/${propertyName}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Deal property removed successfully', dealId, propertyName }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error removing deal property:', sanitizeForLogging(error));
				throw new Error(`Failed to remove deal property: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get deals pipeline tool
	server.tool(
		'get_deals_pipeline',
		"Get deals organized by pipeline stages for the authenticated user's organization",
		{
			clientId: z.string().uuid().optional().describe('Filter by client ID'),
			createdByUserId: z.string().uuid().optional().describe('Filter by creator user ID')
		},
		async ({ clientId, createdByUserId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(clientId && { clientId }),
					...(createdByUserId && { createdByUserId })
				};

				const response = await apiClient.get('/api/deals/pipeline', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching deals pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deals pipeline: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search deals tool
	server.tool(
		'search_deals',
		'Search deals by title or properties',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			stage: DealStatusEnum.optional().describe('Filter by deal stage'),
			clientId: z.string().uuid().optional().describe('Filter by client ID')
		},
		async ({ query, limit = 20, stage, clientId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(stage && { stage }),
					...(clientId && { clientId })
				};

				const response = await apiClient.get('/api/deals/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching deals:', sanitizeForLogging(error));
				throw new Error(`Failed to search deals: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

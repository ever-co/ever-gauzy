// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { buildListQuery, notOfferedByApi, resolveOrganizationScope, validateOrganizationContext } from './utils';
import { DealStatusEnum } from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
import { TOOL_HINTS } from './tool-hints';
const logger = new Logger('DealTools');

export const registerDealTools = (server: McpServer) => {
	// Get deals tool
	registerTool(
		server,
		'get_deals',
		"Get list of deals for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for deal title'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["client", "createdByUser"])'),
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
		},
		TOOL_HINTS.readOnly
	);

	// Get deal count tool
	registerTool(
		server,
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
		},
		TOOL_HINTS.readOnly
	);

	// Get deal by ID tool
	registerTool(
		server,
		'get_deal',
		'Get a specific deal by ID',
		{
			id: z.string().uuid().describe('The deal ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["client", "createdByUser", "properties"])')
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
		},
		TOOL_HINTS.readOnly
	);

	// Create deal tool
	registerTool(
		server,
		'create_deal',
		"Create a new deal in the authenticated user's organization",
		{
			deal_data: z.object({ title: z.string().describe('The title (required)') }).passthrough()
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
		},
		TOOL_HINTS.write
	);

	// Update deal tool
	registerTool(
		server,
		'update_deal',
		'Update an existing deal',
		{
			id: z.string().uuid().describe('The deal ID'),
			deal_data: z.record(z.string(), z.any()).describe('The data for updating the deal')
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
		},
		TOOL_HINTS.destructive
	);

	// Update deal stage tool
	registerTool(
		server,
		'update_deal_stage',
		'Update the stage of a deal',
		{
			id: z.string().uuid().describe('The deal ID'),
			stage: DealStatusEnum.describe('The new stage for the deal')
		},
		async () => {
			try {
				throw notOfferedByApi(
					'fixed deal stages',
					'A deal moves between the stages of its pipeline: update_deal sets its stageId.'
				);
			} catch (error) {
				logger.error('Error updating deal stage:', sanitizeForLogging(error));
				throw new Error(`Failed to update deal stage: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Delete deal tool
	registerTool(
		server,
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
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Get deals by client tool
	registerTool(
		server,
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
		},
		TOOL_HINTS.readOnly
	);

	// Get my deals tool
	registerTool(
		server,
		'get_my_deals',
		'Get deals created by the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			stage: DealStatusEnum.optional().describe('Not offered: a deal is in a stage of its own pipeline'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, stage, relations }) => {
			try {
				if (stage) {
					throw notOfferedByApi('a filter on fixed deal stages');
				}
				const scope = resolveOrganizationScope();
				const createdByUserId = authManager.getUserId();
				if (!createdByUserId) {
					throw new Error('User ID not available. Please ensure you are logged in.');
				}

				// The guard reads the tenant at the top of the query, the list route its `where`
				const params = { ...scope, ...buildListQuery(scope, { createdByUserId }, { page, limit, relations }) };
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
				logger.error('Error fetching my deals:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my deals: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get deal statistics tool
	registerTool(
		server,
		'get_deal_statistics',
		"Get deal statistics for the authenticated user's organization",
		{
			clientId: z.string().uuid().optional().describe('Filter by specific client ID'),
			createdByUserId: z.string().uuid().optional().describe('Filter by creator user ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async () => {
			try {
				throw notOfferedByApi('deal statistics');
			} catch (error) {
				logger.error('Error fetching deal statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deal statistics: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Add deal property tool
	registerTool(
		server,
		'add_deal_property',
		'Add a custom property to a deal',
		{
			dealId: z.string().uuid().describe('The deal ID'),
			property: z
				.object({
					name: z.string().describe('Property name'),
					value: z.string().describe('Property value')
				})
				.describe('The property to add')
		},
		async () => {
			try {
				throw notOfferedByApi('custom properties on deals');
			} catch (error) {
				logger.error('Error adding deal property:', sanitizeForLogging(error));
				throw new Error(`Failed to add deal property: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.write
	);

	// Update deal property tool
	registerTool(
		server,
		'update_deal_property',
		'Update a custom property of a deal',
		{
			dealId: z.string().uuid().describe('The deal ID'),
			propertyName: z.string().describe('The property name to update'),
			value: z.string().describe('The new property value')
		},
		async () => {
			try {
				throw notOfferedByApi('custom properties on deals');
			} catch (error) {
				logger.error('Error updating deal property:', sanitizeForLogging(error));
				throw new Error(`Failed to update deal property: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Remove deal property tool
	registerTool(
		server,
		'remove_deal_property',
		'Remove a custom property from a deal',
		{
			dealId: z.string().uuid().describe('The deal ID'),
			propertyName: z.string().describe('The property name to remove')
		},
		async () => {
			try {
				throw notOfferedByApi('custom properties on deals');
			} catch (error) {
				logger.error('Error removing deal property:', sanitizeForLogging(error));
				throw new Error(`Failed to remove deal property: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Get deals pipeline tool
	registerTool(
		server,
		'get_deals_pipeline',
		"Get deals organized by pipeline stages for the authenticated user's organization",
		{
			clientId: z.string().uuid().optional().describe('Filter by client ID'),
			createdByUserId: z.string().uuid().optional().describe('Filter by creator user ID')
		},
		async () => {
			try {
				throw notOfferedByApi('deals grouped by pipeline stage across the organization');
			} catch (error) {
				logger.error('Error fetching deals pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch deals pipeline: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Search deals tool
	registerTool(
		server,
		'search_deals',
		'Search deals by title or properties',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			stage: DealStatusEnum.optional().describe('Filter by deal stage'),
			clientId: z.string().uuid().optional().describe('Filter by client ID')
		},
		async () => {
			try {
				throw notOfferedByApi('searching deals');
			} catch (error) {
				logger.error('Error searching deals:', sanitizeForLogging(error));
				throw new Error(`Failed to search deals: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);
};

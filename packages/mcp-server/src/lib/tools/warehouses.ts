import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { WarehouseSchemaFull } from '../schema';

const logger = new Logger('WarehouseTools');

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

export const registerWarehouseTools = (server: McpServer) => {
	// Get warehouses tool
	server.tool(
		'get_warehouses',
		"Get list of warehouses for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for warehouse name, code, or email'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["contact", "logo"])'),
			active: z.boolean().optional().describe('Filter by active status')
		},
		async ({ page = 1, limit = 10, search, relations, active }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(active !== undefined && { active })
				};

				const response = await apiClient.get('/api/warehouses', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching warehouses:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch warehouses: ${message}`);
			}
		}
	);

	// Get warehouse by ID tool
	server.tool(
		'get_warehouse',
		'Get a specific warehouse by ID',
		{
			id: z.string().uuid().describe('The warehouse ID'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/warehouses/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching warehouse:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch warehouse: ${message}`);
			}
		}
	);

	// Create warehouse tool
	server.tool(
		'create_warehouse',
		"Create a new warehouse in the authenticated user's organization",
		{
			warehouse_data: WarehouseSchemaFull.partial()
				.required({
					name: true,
					code: true
				})
				.describe('The data for creating the warehouse')
		},
		async ({ warehouse_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...warehouse_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/warehouses', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating warehouse:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create warehouse: ${message}`);
			}
		}
	);

	// Update warehouse tool
	server.tool(
		'update_warehouse',
		'Update an existing warehouse',
		{
			id: z.string().uuid().describe('The warehouse ID'),
			warehouse_data: WarehouseSchemaFull.partial().describe('The data for updating the warehouse')
		},
		async ({ id, warehouse_data }) => {
			try {
				const response = await apiClient.put(`/api/warehouses/${id}`, warehouse_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating warehouse:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update warehouse: ${message}`);
			}
		}
	);

	// Delete warehouse tool
	server.tool(
		'delete_warehouse',
		'Delete a warehouse',
		{
			id: z.string().uuid().describe('The warehouse ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/warehouses/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Warehouse deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting warehouse:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete warehouse: ${message}`);
			}
		}
	);

	// Get active warehouses tool
	server.tool(
		'get_active_warehouses',
		"Get only active warehouses for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					active: true,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/warehouses', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching active warehouses:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch active warehouses: ${message}`);
			}
		}
	);
};
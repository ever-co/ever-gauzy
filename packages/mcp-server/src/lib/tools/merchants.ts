import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { MerchantSchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('MerchantTools');


export const registerMerchantTools = (server: McpServer) => {
	// Get merchants tool
	server.tool(
		'get_merchants',
		"Get list of merchants for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for merchant name, code, or email'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["contact", "tags"])'),
			where: z.object({
				isActive: z.boolean().optional(),
				isArchived: z.boolean().optional()
			}).optional().describe('Additional filters')
		},
		async ({ page = 1, limit = 10, search, relations, where }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(where && { where })
				};

				const response = await apiClient.get('/api/merchants', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching merchants:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch merchants: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get merchant count tool
	server.tool(
		'get_merchant_count',
		"Get merchant count in the authenticated user's organization",
		{
			where: z.object({
				isActive: z.boolean().optional(),
				isArchived: z.boolean().optional()
			}).optional().describe('Additional filters')
		},
		async ({ where }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(where && { where })
				};

				const response = await apiClient.get('/api/merchants/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching merchant count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch merchant count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get merchant by ID tool
	server.tool(
		'get_merchant',
		'Get a specific merchant by ID',
		{
			id: z.string().uuid().describe('The merchant ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["contact", "tags"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/merchants/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching merchant:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch merchant: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create merchant tool
	server.tool(
		'create_merchant',
		"Create a new merchant in the authenticated user's organization",
		{
			merchant_data: MerchantSchema.partial()
				.required({
					name: true
				})
				.describe('The data for creating the merchant')
		},
		async ({ merchant_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...merchant_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/merchants', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating merchant:', sanitizeForLogging(error));
				throw new Error(`Failed to create merchant: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update merchant tool
	server.tool(
		'update_merchant',
		'Update an existing merchant',
		{
			id: z.string().uuid().describe('The merchant ID'),
			merchant_data: MerchantSchema.partial().describe('The data for updating the merchant')
		},
		async ({ id, merchant_data }) => {
			try {
				const response = await apiClient.put(`/api/merchants/${id}`, merchant_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating merchant:', sanitizeForLogging(error));
				throw new Error(`Failed to update merchant: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete merchant tool
	server.tool(
		'delete_merchant',
		'Delete a merchant',
		{
			id: z.string().uuid().describe('The merchant ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/merchants/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Merchant deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting merchant:', sanitizeForLogging(error));
				throw new Error(`Failed to delete merchant: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Archive merchant tool
	server.tool(
		'archive_merchant',
		'Archive a merchant (soft delete)',
		{
			id: z.string().uuid().describe('The merchant ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/merchants/${id}/archive`, { isArchived: true });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error archiving merchant:', sanitizeForLogging(error));
				throw new Error(`Failed to archive merchant: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Restore merchant tool
	server.tool(
		'restore_merchant',
		'Restore an archived merchant',
		{
			id: z.string().uuid().describe('The merchant ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/merchants/${id}/restore`, { isArchived: false });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error restoring merchant:', sanitizeForLogging(error));
				throw new Error(`Failed to restore merchant: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get merchant by code tool
	server.tool(
		'get_merchant_by_code',
		'Get a merchant by its unique code',
		{
			code: z.string().describe('The merchant code'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ code, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					code,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/merchants/by-code', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching merchant by code:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch merchant by code: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search merchants tool
	server.tool(
		'search_merchants',
		'Search merchants by name, code, email, or description',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			includeArchived: z.boolean().optional().default(false).describe('Include archived merchants in search')
		},
		async ({ query, limit = 20, includeArchived = false }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					includeArchived
				};

				const response = await apiClient.get('/api/merchants/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching merchants:', sanitizeForLogging(error));
				throw new Error(`Failed to search merchants: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get merchant statistics tool
	server.tool(
		'get_merchant_statistics',
		"Get merchant statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/merchants/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching merchant statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch merchant statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Bulk create merchants tool
	server.tool(
		'bulk_create_merchants',
		"Create multiple merchants in bulk for the authenticated user's organization",
		{
			merchants: z.array(
				MerchantSchema.partial()
					.required({
						name: true
					})
					.describe('Merchant data')
			).describe('Array of merchant data to create')
		},
		async ({ merchants }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each merchant
				const merchantsWithDefaults = merchants.map((merchant) => ({
					...merchant,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/merchants/bulk', { merchants: merchantsWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating merchants:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk create merchants: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get active merchants tool
	server.tool(
		'get_active_merchants',
		"Get only active (non-archived) merchants for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for merchant name, code, or email'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, search, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					where: { isActive: true, isArchived: false }
				};

				const response = await apiClient.get('/api/merchants', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching active merchants:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch active merchants: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get archived merchants tool
	server.tool(
		'get_archived_merchants',
		"Get archived merchants for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for merchant name, code, or email'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, search, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					where: { isArchived: true }
				};

				const response = await apiClient.get('/api/merchants', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching archived merchants:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch archived merchants: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

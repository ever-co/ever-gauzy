import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { IncomeSchemaFull, IncomeTypeEnum, CurrenciesEnum } from '../schema';

const logger = new Logger('IncomeTools');

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
 * Helper function to convert date fields in income data to Date objects
 */
const convertIncomeDateFields = (incomeData: any) => {
	return {
		...incomeData,
		valueDate: incomeData.valueDate ? new Date(incomeData.valueDate) : undefined
	};
};

export const registerIncomeTools = (server: McpServer) => {
	// Get incomes tool
	server.tool(
		'get_incomes',
		"Get list of incomes for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for income notes or reference'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "organizationContact", "tags"])'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationContactId: z.string().uuid().optional().describe('Filter by organization contact ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			isBonus: z.boolean().optional().describe('Filter by bonus status'),
			startDate: z.string().optional().describe('Filter incomes from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter incomes until this date (ISO format)')
		},
		async ({ page = 1, limit = 10, search, relations, employeeId, organizationContactId, currency, isBonus, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(employeeId && { employeeId }),
					...(organizationContactId && { organizationContactId }),
					...(currency && { currency }),
					...(isBonus !== undefined && { isBonus }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/incomes', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching incomes:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch incomes: ${message}`);
			}
		}
	);

	// Get income count tool
	server.tool(
		'get_income_count',
		"Get income count in the authenticated user's organization",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationContactId: z.string().uuid().optional().describe('Filter by organization contact ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			isBonus: z.boolean().optional().describe('Filter by bonus status'),
			startDate: z.string().optional().describe('Filter incomes from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter incomes until this date (ISO format)')
		},
		async ({ employeeId, organizationContactId, currency, isBonus, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId }),
					...(organizationContactId && { organizationContactId }),
					...(currency && { currency }),
					...(isBonus !== undefined && { isBonus }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/incomes/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching income count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch income count: ${message}`);
			}
		}
	);

	// Get income by ID tool
	server.tool(
		'get_income',
		'Get a specific income by ID',
		{
			id: z.string().uuid().describe('The income ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "organizationContact", "tags"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/incomes/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching income:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch income: ${message}`);
			}
		}
	);

	// Create income tool
	server.tool(
		'create_income',
		"Create a new income record in the authenticated user's organization",
		{
			income_data: IncomeSchemaFull.partial()
				.required({
					amount: true,
					currency: true
				})
				.describe('The data for creating the income')
		},
		async ({ income_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertIncomeDateFields({
					...income_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/incomes', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating income:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create income: ${message}`);
			}
		}
	);

	// Update income tool
	server.tool(
		'update_income',
		'Update an existing income record',
		{
			id: z.string().uuid().describe('The income ID'),
			income_data: IncomeSchemaFull.partial().describe('The data for updating the income')
		},
		async ({ id, income_data }) => {
			try {
				const updateData = convertIncomeDateFields(income_data);

				const response = await apiClient.put(`/api/incomes/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating income:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update income: ${message}`);
			}
		}
	);

	// Delete income tool
	server.tool(
		'delete_income',
		'Delete an income record',
		{
			id: z.string().uuid().describe('The income ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/incomes/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Income deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting income:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete income: ${message}`);
			}
		}
	);

	// Get incomes by employee tool
	server.tool(
		'get_incomes_by_employee',
		'Get income records for a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			isBonus: z.boolean().optional().describe('Filter by bonus status'),
			startDate: z.string().optional().describe('Filter incomes from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter incomes until this date (ISO format)')
		},
		async ({ employeeId, page = 1, limit = 10, currency, isBonus, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					employeeId,
					page,
					limit,
					...(currency && { currency }),
					...(isBonus !== undefined && { isBonus }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/incomes', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching incomes by employee:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch incomes by employee: ${message}`);
			}
		}
	);

	// Get my incomes tool
	server.tool(
		'get_my_incomes',
		'Get income records for the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			isBonus: z.boolean().optional().describe('Filter by bonus status'),
			startDate: z.string().optional().describe('Filter incomes from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter incomes until this date (ISO format)')
		},
		async ({ page = 1, limit = 10, currency, isBonus, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(currency && { currency }),
					...(isBonus !== undefined && { isBonus }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/incomes/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my incomes:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch my incomes: ${message}`);
			}
		}
	);

	// Get bonus incomes tool
	server.tool(
		'get_bonus_incomes',
		"Get bonus income records for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			startDate: z.string().optional().describe('Filter incomes from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter incomes until this date (ISO format)'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, employeeId, currency, startDate, endDate, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					isBonus: true,
					...(employeeId && { employeeId }),
					...(currency && { currency }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/incomes', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching bonus incomes:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch bonus incomes: ${message}`);
			}
		}
	);

	// Get income statistics tool
	server.tool(
		'get_income_statistics',
		"Get income statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			employeeId: z.string().uuid().optional().describe('Filter by specific employee ID'),
			organizationContactId: z.string().uuid().optional().describe('Filter by specific contact ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			includeBonus: z.boolean().optional().default(true).describe('Include bonus incomes in statistics')
		},
		async ({ startDate, endDate, employeeId, organizationContactId, currency, includeBonus = true }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(employeeId && { employeeId }),
					...(organizationContactId && { organizationContactId }),
					...(currency && { currency }),
					includeBonus
				};

				const response = await apiClient.get('/api/incomes/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching income statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch income statistics: ${message}`);
			}
		}
	);

	// Bulk create incomes tool
	server.tool(
		'bulk_create_incomes',
		"Create multiple income records in bulk for the authenticated user's organization",
		{
			incomes: z.array(
				IncomeSchemaFull.partial()
					.required({
						amount: true,
						currency: true
					})
					.describe('Income data')
			).describe('Array of income data to create')
		},
		async ({ incomes }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each income
				const incomesWithDefaults = incomes.map((income) => convertIncomeDateFields({
					...income,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/incomes/bulk', { incomes: incomesWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating incomes:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to bulk create incomes: ${message}`);
			}
		}
	);

	// Search incomes tool
	server.tool(
		'search_incomes',
		'Search income records by notes, reference, or employee name',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			isBonus: z.boolean().optional().describe('Filter by bonus status'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID')
		},
		async ({ query, limit = 20, currency, isBonus, employeeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(currency && { currency }),
					...(isBonus !== undefined && { isBonus }),
					...(employeeId && { employeeId })
				};

				const response = await apiClient.get('/api/incomes/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching incomes:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search incomes: ${message}`);
			}
		}
	);

	// Get income summary tool
	server.tool(
		'get_income_summary',
		"Get income summary grouped by employee, currency, or time period",
		{
			groupBy: z.enum(['employee', 'currency', 'month', 'year']).describe('Group income summary by'),
			startDate: z.string().optional().describe('Start date for summary (ISO format)'),
			endDate: z.string().optional().describe('End date for summary (ISO format)'),
			employeeId: z.string().uuid().optional().describe('Filter by specific employee ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			includeBonus: z.boolean().optional().default(true).describe('Include bonus incomes in summary')
		},
		async ({ groupBy, startDate, endDate, employeeId, currency, includeBonus = true }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					groupBy,
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(employeeId && { employeeId }),
					...(currency && { currency }),
					includeBonus
				};

				const response = await apiClient.get('/api/incomes/summary', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching income summary:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch income summary: ${message}`);
			}
		}
	);
};
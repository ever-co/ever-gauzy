import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { IncomeSchemaFull, CurrenciesEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('IncomeTools');


/**
 * Helper function to convert date fields in income data to Date objects
 */
interface IncomeData {
	valueDate?: string | Date;
	[key: string]: any; // Allow other properties since we spread them
}

interface ConvertedIncomeData extends Omit<IncomeData, 'valueDate'> {
	valueDate?: Date;
}

const convertIncomeDateFields = (incomeData: IncomeData): ConvertedIncomeData => {
	return {
		...incomeData,
		valueDate: incomeData.valueDate ? new Date(incomeData.valueDate) : undefined
	};
};

export const registerIncomeTools = (server: McpServer) => {
	// Get my incomes tool (only implemented endpoint)
	server.tool(
		'get_my_incomes',
		'Get income records for the current authenticated user',
		{
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "organizationContact", "tags"])'),
			findInput: z.object({}).optional().describe('Find input parameters'),
			filterDate: z.object({}).optional().describe('Date filter parameters')
		},
		async ({ relations, findInput, filterDate }) => {
			try {
				const data = {
					...(relations && { relations }),
					...(findInput && { findInput }),
					...(filterDate && { filterDate })
				};

				const response = await apiClient.get('/api/income/me', { 
					params: { data: JSON.stringify(data) }
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
				logger.error('Error fetching my incomes:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my incomes: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get income count tool
	server.tool(
		'get_income_count',
		"Get income count using available filters",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			organizationId: z.string().uuid().optional().describe('Filter by organization ID'),
			tenantId: z.string().uuid().optional().describe('Filter by tenant ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			amount: z.number().optional().describe('Filter by amount'),
			valueDate: z.string().optional().describe('Filter by value date (ISO format)')
		},
		async ({ employeeId, organizationId, tenantId, currency, amount, valueDate }) => {
			try {
				const params = {
					...(employeeId && { employeeId }),
					...(organizationId && { organizationId }),
					...(tenantId && { tenantId }),
					...(currency && { currency }),
					...(amount && { amount }),
					...(valueDate && { valueDate })
				};

				const response = await apiClient.get('/api/income/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching income count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch income count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get paginated incomes tool
	server.tool(
		'get_incomes_pagination',
		"Get paginated list of incomes",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			where: z.object({}).optional().describe('Where conditions')
		},
		async ({ page = 1, limit = 10, relations, where }) => {
			try {
				const params = {
					page,
					limit,
					...(relations && { relations }),
					...(where && { where })
				};

				const response = await apiClient.get('/api/income/pagination', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching paginated incomes:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch paginated incomes: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get all incomes tool
	server.tool(
		'get_incomes',
		"Get list of incomes with filtering options",
		{
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "organizationContact", "tags"])'),
			findInput: z.object({}).optional().describe('Find input parameters'),
			filterDate: z.object({}).optional().describe('Date filter parameters')
		},
		async ({ relations, findInput, filterDate }) => {
			try {
				const data = {
					...(relations && { relations }),
					...(findInput && { findInput }),
					...(filterDate && { filterDate })
				};

				const response = await apiClient.get('/api/income', { 
					params: { data: JSON.stringify(data) }
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
				logger.error('Error fetching incomes:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch incomes: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get income by ID tool
	server.tool(
		'get_income',
		'Get a specific income by ID',
		{
			id: z.string().uuid().describe('The income ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.get(`/api/income/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching income:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch income: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create income tool
	server.tool(
		'create_income',
		"Create a new income record",
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
				const createData = convertIncomeDateFields(income_data);

				const response = await apiClient.post('/api/income', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating income:', sanitizeForLogging(error));
				throw new Error(`Failed to create income: ${sanitizeErrorMessage(error)}`);
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

				const response = await apiClient.put(`/api/income/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating income:', sanitizeForLogging(error));
				throw new Error(`Failed to update income: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete income tool
	server.tool(
		'delete_income',
		'Delete an income record',
		{
			id: z.string().uuid().describe('The income ID'),
			employeeId: z.string().uuid().optional().describe('Employee ID (required by controller)')
		},
		async ({ id, employeeId }) => {
			try {
				const params = employeeId ? { employeeId } : {};
				await apiClient.delete(`/api/income/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Income deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting income:', sanitizeForLogging(error));
				throw new Error(`Failed to delete income: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

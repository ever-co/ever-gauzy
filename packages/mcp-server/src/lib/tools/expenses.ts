import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { ExpenseSchema, ExpenseCategoriesEnum, CurrenciesEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('ExpenseTools');


/**
 * Helper function to convert date fields in expense data to Date objects
 */
const convertExpenseDateFields = (expenseData: any) => {
	return {
		...expenseData,
		valueDate: expenseData.valueDate ? new Date(expenseData.valueDate) : undefined
	};
};

export const registerExpenseTools = (server: McpServer) => {
	// Get expenses tool
	server.tool(
		'get_expenses',
		"Get list of expenses for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for expense notes or purpose'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "category", "project", "tags"])'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			categoryId: z.string().uuid().optional().describe('Filter by expense category ID'),
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			status: z.string().optional().describe('Filter by expense status'),
			startDate: z.string().optional().describe('Filter expenses from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter expenses until this date (ISO format)'),
			currency: CurrenciesEnum.optional().describe('Filter by currency')
		},
		async ({ page = 1, limit = 10, search, relations, employeeId, categoryId, projectId, status, startDate, endDate, currency }) => {
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
					...(categoryId && { categoryId }),
					...(projectId && { projectId }),
					...(status && { status }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(currency && { currency })
				};

				const response = await apiClient.get('/api/expense', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expenses:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch expenses: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get expense count tool
	server.tool(
		'get_expense_count',
		"Get expense count in the authenticated user's organization",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			categoryId: z.string().uuid().optional().describe('Filter by expense category ID'),
			status: z.string().optional().describe('Filter by expense status'),
			startDate: z.string().optional().describe('Filter expenses from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter expenses until this date (ISO format)')
		},
		async ({ employeeId, categoryId, status, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId }),
					...(categoryId && { categoryId }),
					...(status && { status }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/expense/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expense count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch expense count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get expense by ID tool
	server.tool(
		'get_expense',
		'Get a specific expense by ID',
		{
			id: z.string().uuid().describe('The expense ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "category", "project", "tags"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/expense/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expense:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch expense: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create expense tool
	server.tool(
		'create_expense',
		"Create a new expense in the authenticated user's organization",
		{
			expense_data: ExpenseSchema.partial()
				.required({
					amount: true,
					currency: true
				})
				.describe('The data for creating the expense')
		},
		async ({ expense_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertExpenseDateFields({
					...expense_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/expense', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating expense:', sanitizeForLogging(error));
				throw new Error(`Failed to create expense: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update expense tool
	server.tool(
		'update_expense',
		'Update an existing expense',
		{
			id: z.string().uuid().describe('The expense ID'),
			expense_data: ExpenseSchema.partial().describe('The data for updating the expense')
		},
		async ({ id, expense_data }) => {
			try {
				const updateData = convertExpenseDateFields(expense_data);

				const response = await apiClient.put(`/api/expense/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating expense:', sanitizeForLogging(error));
				throw new Error(`Failed to update expense: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete expense tool
	server.tool(
		'delete_expense',
		'Delete an expense',
		{
			id: z.string().uuid().describe('The expense ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/expense/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Expense deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting expense:', sanitizeForLogging(error));
				throw new Error(`Failed to delete expense: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get expense categories tool
	server.tool(
		'get_expense_categories',
		"Get list of expense categories for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for category name')
		},
		async ({ page = 1, limit = 10, search }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search })
				};

				const response = await apiClient.get('/api/expense-categories', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expense categories:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch expense categories: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get expenses by employee tool
	server.tool(
		'get_expenses_by_employee',
		'Get expenses for a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: z.string().optional().describe('Filter by expense status'),
			startDate: z.string().optional().describe('Filter expenses from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter expenses until this date (ISO format)')
		},
		async ({ employeeId, page = 1, limit = 10, status, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					employeeId,
					page,
					limit,
					...(status && { status }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/expense', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expenses by employee:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch expenses by employee: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my expenses tool
	server.tool(
		'get_my_expenses',
		'Get expenses for the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: z.string().optional().describe('Filter by expense status'),
			categoryId: z.string().uuid().optional().describe('Filter by expense category ID'),
			startDate: z.string().optional().describe('Filter expenses from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter expenses until this date (ISO format)')
		},
		async ({ page = 1, limit = 10, status, categoryId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(status && { status }),
					...(categoryId && { categoryId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/expense/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my expenses:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my expenses: ${sanitizeErrorMessage(error)}`);
			}
		}
	);





};

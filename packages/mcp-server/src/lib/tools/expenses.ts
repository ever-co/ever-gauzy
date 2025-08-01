import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { ExpenseSchema, ExpenseCategoriesEnum, CurrenciesEnum } from '../schema';

const logger = new Logger('ExpenseTools');

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

				const response = await apiClient.get('/api/expenses', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expenses:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch expenses: ${message}`);
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

				const response = await apiClient.get('/api/expenses/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expense count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch expense count: ${message}`);
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

				const response = await apiClient.get(`/api/expenses/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expense:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch expense: ${message}`);
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

				const response = await apiClient.post('/api/expenses', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating expense:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create expense: ${message}`);
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

				const response = await apiClient.put(`/api/expenses/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating expense:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update expense: ${message}`);
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
				await apiClient.delete(`/api/expenses/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Expense deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting expense:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete expense: ${message}`);
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
				logger.error('Error fetching expense categories:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch expense categories: ${message}`);
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

				const response = await apiClient.get('/api/expenses', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expenses by employee:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch expenses by employee: ${message}`);
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

				const response = await apiClient.get('/api/expenses/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my expenses:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch my expenses: ${message}`);
			}
		}
	);

	// Get expense statistics tool
	server.tool(
		'get_expense_statistics',
		"Get expense statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			employeeId: z.string().uuid().optional().describe('Filter by specific employee ID'),
			categoryId: z.string().uuid().optional().describe('Filter by specific category ID')
		},
		async ({ startDate, endDate, employeeId, categoryId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(employeeId && { employeeId }),
					...(categoryId && { categoryId })
				};

				const response = await apiClient.get('/api/expenses/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching expense statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch expense statistics: ${message}`);
			}
		}
	);

	// Bulk create expenses tool
	server.tool(
		'bulk_create_expenses',
		"Create multiple expenses in bulk for the authenticated user's organization",
		{
			expenses: z.array(
				ExpenseSchema.partial()
					.required({
						amount: true,
						currency: true
					})
					.describe('Expense data')
			).describe('Array of expense data to create')
		},
		async ({ expenses }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each expense
				const expensesWithDefaults = expenses.map((expense) => convertExpenseDateFields({
					...expense,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/expenses/bulk', { expenses: expensesWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating expenses:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to bulk create expenses: ${message}`);
			}
		}
	);

	// Submit expense for approval tool
	server.tool(
		'submit_expense_for_approval',
		'Submit an expense for approval',
		{
			id: z.string().uuid().describe('The expense ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/expenses/${id}/submit`, { status: 'PENDING_APPROVAL' });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error submitting expense for approval:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to submit expense for approval: ${message}`);
			}
		}
	);

	// Approve expense tool
	server.tool(
		'approve_expense',
		'Approve a submitted expense',
		{
			id: z.string().uuid().describe('The expense ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/expenses/${id}/approve`, { status: 'APPROVED' });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error approving expense:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to approve expense: ${message}`);
			}
		}
	);

	// Reject expense tool
	server.tool(
		'reject_expense',
		'Reject a submitted expense',
		{
			id: z.string().uuid().describe('The expense ID'),
			reason: z.string().optional().describe('Reason for rejection')
		},
		async ({ id, reason }) => {
			try {
				const response = await apiClient.put(`/api/expenses/${id}/reject`, {
					status: 'REJECTED',
					...(reason && { rejectionReason: reason })
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
				logger.error('Error rejecting expense:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to reject expense: ${message}`);
			}
		}
	);
};

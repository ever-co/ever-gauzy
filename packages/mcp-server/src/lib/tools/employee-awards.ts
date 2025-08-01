import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { EmployeeAwardSchema } from '../schema';

const logger = new Logger('EmployeeAwardTools');

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

export const registerEmployeeAwardTools = (server: McpServer) => {
	// Get employee awards tool
	server.tool(
		'get_employee_awards',
		"Get list of employee awards for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for award name'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee"])'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			year: z.string().optional().describe('Filter by award year'),
			sortBy: z.enum(['name', 'year', 'createdAt', 'updatedAt']).optional().describe('Sort awards by field'),
			sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order')
		},
		async ({ page = 1, limit = 10, search, relations, employeeId, year, sortBy, sortOrder = 'DESC' }) => {
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
					...(year && { year }),
					...(sortBy && { sortBy }),
					sortOrder
				};

				const response = await apiClient.get('/api/employee-awards', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch employee awards: ${message}`);
			}
		}
	);

	// Get employee award count tool
	server.tool(
		'get_employee_award_count',
		"Get employee award count in the authenticated user's organization",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			year: z.string().optional().describe('Filter by award year')
		},
		async ({ employeeId, year }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId }),
					...(year && { year })
				};

				const response = await apiClient.get('/api/employee-awards/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee award count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch employee award count: ${message}`);
			}
		}
	);

	// Get employee award by ID tool
	server.tool(
		'get_employee_award',
		'Get a specific employee award by ID',
		{
			id: z.string().uuid().describe('The employee award ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/employee-awards/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee award:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch employee award: ${message}`);
			}
		}
	);

	// Create employee award tool
	server.tool(
		'create_employee_award',
		"Create a new employee award in the authenticated user's organization",
		{
			award_data: EmployeeAwardSchema.partial()
				.required({
					name: true,
					year: true,
					employeeId: true
				})
				.describe('The data for creating the employee award')
		},
		async ({ award_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...award_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/employee-awards', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating employee award:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create employee award: ${message}`);
			}
		}
	);

	// Update employee award tool
	server.tool(
		'update_employee_award',
		'Update an existing employee award',
		{
			id: z.string().uuid().describe('The employee award ID'),
			award_data: EmployeeAwardSchema.partial().describe('The data for updating the employee award')
		},
		async ({ id, award_data }) => {
			try {
				const response = await apiClient.put(`/api/employee-awards/${id}`, award_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating employee award:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update employee award: ${message}`);
			}
		}
	);

	// Delete employee award tool
	server.tool(
		'delete_employee_award',
		'Delete an employee award',
		{
			id: z.string().uuid().describe('The employee award ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/employee-awards/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Employee award deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting employee award:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete employee award: ${message}`);
			}
		}
	);

	// Get employee awards by employee tool
	server.tool(
		'get_employee_awards_by_employee',
		'Get awards for a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			year: z.string().optional().describe('Filter by award year'),
			sortBy: z.enum(['name', 'year', 'createdAt']).optional().default('year').describe('Sort awards by field'),
			sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order')
		},
		async ({ employeeId, page = 1, limit = 10, year, sortBy = 'year', sortOrder = 'DESC' }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					employeeId,
					page,
					limit,
					...(year && { year }),
					sortBy,
					sortOrder
				};

				const response = await apiClient.get('/api/employee-awards', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards by employee:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch employee awards by employee: ${message}`);
			}
		}
	);

	// Get my employee awards tool
	server.tool(
		'get_my_employee_awards',
		'Get awards for the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			year: z.string().optional().describe('Filter by award year'),
			sortBy: z.enum(['name', 'year', 'createdAt']).optional().default('year').describe('Sort awards by field'),
			sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order')
		},
		async ({ page = 1, limit = 10, year, sortBy = 'year', sortOrder = 'DESC' }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(year && { year }),
					sortBy,
					sortOrder
				};

				const response = await apiClient.get('/api/employee-awards/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my employee awards:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch my employee awards: ${message}`);
			}
		}
	);

	// Get awards by year tool
	server.tool(
		'get_employee_awards_by_year',
		'Get employee awards for a specific year',
		{
			year: z.string().describe('The award year'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			sortBy: z.enum(['name', 'createdAt', 'employee']).optional().default('name').describe('Sort awards by field'),
			sortOrder: z.enum(['ASC', 'DESC']).optional().default('ASC').describe('Sort order')
		},
		async ({ year, page = 1, limit = 10, employeeId, relations, sortBy = 'name', sortOrder = 'ASC' }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					year,
					page,
					limit,
					...(employeeId && { employeeId }),
					...(relations && { relations }),
					sortBy,
					sortOrder
				};

				const response = await apiClient.get('/api/employee-awards', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards by year:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch employee awards by year: ${message}`);
			}
		}
	);

	// Search employee awards tool
	server.tool(
		'search_employee_awards',
		'Search employee awards by name or employee name',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			year: z.string().optional().describe('Filter by award year'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID')
		},
		async ({ query, limit = 20, year, employeeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(year && { year }),
					...(employeeId && { employeeId })
				};

				const response = await apiClient.get('/api/employee-awards/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching employee awards:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search employee awards: ${message}`);
			}
		}
	);

	// Get employee award statistics tool
	server.tool(
		'get_employee_award_statistics',
		"Get employee award statistics for the authenticated user's organization",
		{
			startYear: z.string().optional().describe('Start year for statistics'),
			endYear: z.string().optional().describe('End year for statistics'),
			employeeId: z.string().uuid().optional().describe('Filter by specific employee ID'),
			groupBy: z.enum(['employee', 'year', 'month']).optional().default('year').describe('Group statistics by')
		},
		async ({ startYear, endYear, employeeId, groupBy = 'year' }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startYear && { startYear }),
					...(endYear && { endYear }),
					...(employeeId && { employeeId }),
					groupBy
				};

				const response = await apiClient.get('/api/employee-awards/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee award statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch employee award statistics: ${message}`);
			}
		}
	);

	// Bulk create employee awards tool
	server.tool(
		'bulk_create_employee_awards',
		"Create multiple employee awards in bulk for the authenticated user's organization",
		{
			awards: z.array(
				EmployeeAwardSchema.partial()
					.required({
						name: true,
						year: true,
						employeeId: true
					})
					.describe('Employee award data')
			).describe('Array of employee award data to create')
		},
		async ({ awards }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each award
				const awardsWithDefaults = awards.map((award) => ({
					...award,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/employee-awards/bulk', { awards: awardsWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating employee awards:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to bulk create employee awards: ${message}`);
			}
		}
	);

	// Get top awarded employees tool
	server.tool(
		'get_top_awarded_employees',
		'Get employees with the most awards',
		{
			limit: z.number().optional().default(10).describe('Maximum number of employees to return'),
			year: z.string().optional().describe('Filter by specific year'),
			startYear: z.string().optional().describe('Start year for filtering'),
			endYear: z.string().optional().describe('End year for filtering')
		},
		async ({ limit = 10, year, startYear, endYear }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(year && { year }),
					...(startYear && { startYear }),
					...(endYear && { endYear })
				};

				const response = await apiClient.get('/api/employee-awards/top-employees', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching top awarded employees:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch top awarded employees: ${message}`);
			}
		}
	);

	// Get award years tool
	server.tool(
		'get_award_years',
		'Get available award years in the organization',
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID')
		},
		async ({ employeeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId })
				};

				const response = await apiClient.get('/api/employee-awards/years', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching award years:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch award years: ${message}`);
			}
		}
	);
};
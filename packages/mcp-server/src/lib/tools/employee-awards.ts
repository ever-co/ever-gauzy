import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { EmployeeAwardSchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('EmployeeAwardTools');


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

				const response = await apiClient.get('/api/employee-award', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
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

				const response = await apiClient.get(`/api/employee-award/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee award:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
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

				const response = await apiClient.post('/api/employee-award', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating employee award:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
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
				const response = await apiClient.put(`/api/employee-award/${id}`, award_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating employee award:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
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
				await apiClient.delete(`/api/employee-award/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Employee award deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting employee award:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
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

				const response = await apiClient.get('/api/employee-award', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards by employee:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
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

				const response = await apiClient.get('/api/employee-award', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards by year:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		}
	);

	// Get employee awards count tool
	server.tool(
		'get_employee_awards_count',
		"Get employee awards count in the authenticated user's organization",
		{
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			year: z.string().optional().describe('Filter by award year'),
			search: z.string().optional().describe('Search term for award name')
		},
		async ({ employeeId, year, search }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId }),
					...(year && { year }),
					...(search && { search })
				};

				const response = await apiClient.get('/api/employee-award/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards count:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		}
	);

	// Get employee awards statistics tool
	server.tool(
		'get_employee_awards_statistics',
		"Get employee awards statistics for the authenticated user's organization",
		{
			employeeId: z.string().uuid().optional().describe('Filter by specific employee ID'),
			year: z.string().optional().describe('Filter by award year'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			groupBy: z.enum(['employee', 'year', 'month']).optional().describe('Group statistics by field')
		},
		async ({ employeeId, year, startDate, endDate, groupBy }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(employeeId && { employeeId }),
					...(year && { year }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(groupBy && { groupBy })
				};

				const response = await apiClient.get('/api/employee-award/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching employee awards statistics:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		}
	);

	// Bulk create employee awards tool
	server.tool(
		'bulk_create_employee_awards',
		"Create multiple employee awards in bulk for the authenticated user's organization",
		{
			awards: z
				.array(
					EmployeeAwardSchema.partial()
						.required({
							name: true,
							year: true,
							employeeId: true
						})
						.describe('Employee award data')
				)
				.describe('Array of employee award data to create')
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

				const response = await apiClient.post('/api/employee-award/bulk', {
					awards: awardsWithDefaults
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
				logger.error('Error bulk creating employee awards:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		}
	);

	// Bulk update employee awards tool
	server.tool(
		'bulk_update_employee_awards',
		'Update multiple employee awards in bulk',
		{
			awards: z
				.array(
					z.object({
						id: z.string().uuid().describe('The employee award ID'),
						data: EmployeeAwardSchema.partial().describe('The data to update')
					})
				)
				.describe('Array of employee award updates')
		},
		async ({ awards }) => {
			try {
				const response = await apiClient.put('/api/employee-award/bulk', {
					awards
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
				logger.error('Error bulk updating employee awards:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		}
	);

	// Bulk delete employee awards tool
	server.tool(
		'bulk_delete_employee_awards',
		'Delete multiple employee awards in bulk',
		{
			ids: z.array(z.string().uuid()).describe('Array of employee award IDs to delete')
		},
		async ({ ids }) => {
			try {
				await apiClient.delete('/api/employee-award/bulk', {
					data: { ids }
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ 
								success: true, 
								message: `Successfully deleted ${ids.length} employee awards`,
								deletedIds: ids 
							}, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk deleting employee awards:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		}
	);
};

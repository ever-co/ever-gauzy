import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import log from 'electron-log';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { EmployeeSchema } from '../schema';

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
 * Helper function to convert date fields in employee data to Date objects
 */
const convertEmployeeDateFields = (employeeData: any) => {
	return {
		...employeeData,
		valueDate: employeeData.valueDate ? new Date(employeeData.valueDate) : undefined,
		startedWorkOn: employeeData.startedWorkOn ? new Date(employeeData.startedWorkOn) : undefined,
		endWork: employeeData.endWork ? new Date(employeeData.endWork) : undefined,
		offerDate: employeeData.offerDate ? new Date(employeeData.offerDate) : undefined,
		acceptDate: employeeData.acceptDate ? new Date(employeeData.acceptDate) : undefined,
		rejectDate: employeeData.rejectDate ? new Date(employeeData.rejectDate) : undefined
	};
};

export const registerEmployeeTools = (server: McpServer) => {
	// Get employees tool
	server.tool(
		'get_employees',
		"Get list of employees for the authenticated user's organization with pagination",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for employee name or email'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["user", "contact"])'),
			where: z
				.object({
					isActive: z.boolean().optional(),
					isArchived: z.boolean().optional()
				})
				.optional()
				.describe('Additional filters')
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

				const response = await apiClient.get('/api/employee', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching employees:', error);
				throw new Error('Failed to fetch employees');
			}
		}
	);

	// Get employee count tool
	server.tool(
		'get_employee_count',
		"Get employee count in the authenticated user's organization",
		{
			where: z
				.object({
					isActive: z.boolean().optional(),
					isArchived: z.boolean().optional()
				})
				.optional()
				.describe('Additional filters')
		},
		async ({ where }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(where && { where })
				};

				const response = await apiClient.get('/api/employee/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching employee count:', error);
				throw new Error('Failed to fetch employee count');
			}
		}
	);

	// Get employees pagination tool
	server.tool(
		'get_employees_pagination',
		"Get employees by pagination in the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page'),
			search: z.string().optional().describe('Search term for employee name or email'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			where: z
				.object({
					isActive: z.boolean().optional(),
					isArchived: z.boolean().optional()
				})
				.optional()
				.describe('Additional filters')
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

				const response = await apiClient.get('/api/employee/pagination', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching employees pagination:', error);
				throw new Error('Failed to fetch employees pagination');
			}
		}
	);

	// Get working employees tool
	server.tool(
		'get_working_employees',
		"Get all working employees in the authenticated user's organization",
		{
			forRange: z
				.object({
					start: z.string().datetime().optional().describe('Start date in ISO format'),
					end: z.string().datetime().optional().describe('End date in ISO format')
				})
				.optional()
				.describe('Date range for filtering')
		},
		async ({ forRange }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const data = {
					findInput: {
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
						...(forRange && { forRange })
					}
				};

				const response = await apiClient.get('/api/employee/working', {
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
				log.error('Error fetching working employees:', error);
				throw new Error('Failed to fetch working employees');
			}
		}
	);

	// Get working employees count tool
	server.tool(
		'get_working_employees_count',
		"Get working employees count in the authenticated user's organization",
		{
			forRange: z
				.object({
					start: z.date().optional(),
					end: z.date().optional()
				})
				.optional()
				.describe('Date range for filtering')
		},
		async ({ forRange }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const data = {
					findInput: {
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
						...(forRange && { forRange })
					}
				};

				const response = await apiClient.get('/api/employee/working/count', {
					params: { data: JSON.stringify(data) }
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching working employees count:', error);
				throw new Error('Failed to fetch working employees count');
			}
		}
	);

	// Get organization members tool
	server.tool(
		'get_organization_members',
		"Get members of the authenticated user's organization",
		{
			organizationTeamId: z.string().uuid().optional().describe('Filter by organization team ID'),
			organizationProjectId: z.string().uuid().optional().describe('Filter by organization project ID'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ organizationTeamId, organizationProjectId, page = 1, limit = 10 }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(organizationTeamId && { organizationTeamId }),
					...(organizationProjectId && { organizationProjectId }),
					page,
					limit
				};

				const response = await apiClient.get('/api/employee/members', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching organization members:', error);
				throw new Error('Failed to fetch organization members');
			}
		}
	);

	// Get employee by ID tool
	server.tool(
		'get_employee',
		'Get a specific employee by ID',
		{
			id: z.string().uuid().describe('The employee ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["user", "contact", "tasks"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/employee/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching employee:', error);
				throw new Error('Failed to fetch employee');
			}
		}
	);

	// Get employee statistics tool
	server.tool(
		'get_employee_statistics',
		"Get statistics for an employee in the authenticated user's organization",
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ employeeId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					employeeId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/employee/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching employee statistics:', error);
				throw new Error('Failed to fetch employee statistics');
			}
		}
	);

	// Get current employee tool
	server.tool(
		'get_current_employee',
		'Get the current authenticated employee profile',
		{
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["user", "contact", "tasks"])')
		},
		async ({ relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/employee/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error fetching current employee:', error);
				throw new Error('Failed to fetch current employee');
			}
		}
	);

	// Create employee tool
	server.tool(
		'create_employee',
		"Create a new employee in the authenticated user's organization",
		{
			employee_data: EmployeeSchema.partial()
				.required({
					userId: true
				})
				.describe('The data for creating the employee')
		},
		async ({ employee_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertEmployeeDateFields({
					...employee_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/employee', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error creating employee:', error);
				throw new Error('Failed to create employee');
			}
		}
	);

	// Update employee tool
	server.tool(
		'update_employee',
		'Update an existing employee',
		{
			id: z.string().uuid().describe('The employee ID'),
			employee_data: EmployeeSchema.partial().describe('The data for updating the employee')
		},
		async ({ id, employee_data }) => {
			try {
				const updateData = convertEmployeeDateFields(employee_data);

				const response = await apiClient.put(`/api/employee/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error updating employee:', error);
				throw new Error('Failed to update employee');
			}
		}
	);

	// Update employee profile tool
	server.tool(
		'update_employee_profile',
		"Update the current authenticated employee's profile",
		{
			employee_data: EmployeeSchema.partial().describe('The data for updating the employee profile')
		},
		async ({ employee_data }) => {
			try {
				const updateData = convertEmployeeDateFields(employee_data);

				const response = await apiClient.put('/api/employee/me', updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error updating employee profile:', error);
				throw new Error('Failed to update employee profile');
			}
		}
	);

	// Soft delete employee tool
	server.tool(
		'soft_delete_employee',
		'Soft delete an employee (archive)',
		{
			id: z.string().uuid().describe('The employee ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.delete(`/api/employee/${id}/soft`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Employee soft deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				log.error('Error soft deleting employee:', error);
				throw new Error('Failed to soft delete employee');
			}
		}
	);

	// Restore employee tool
	server.tool(
		'restore_employee',
		'Restore a soft deleted employee',
		{
			id: z.string().uuid().describe('The employee ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.post(`/api/employee/${id}/restore`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Employee restored successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				log.error('Error restoring employee:', error);
				throw new Error('Failed to restore employee');
			}
		}
	);

	// Bulk create employees tool
	server.tool(
		'bulk_create_employees',
		"Create multiple employees in bulk for the authenticated user's organization",
		{
			employees: z
				.array(
					EmployeeSchema.partial()
						.required({
							userId: true
						})
						.describe('Employee data')
				)
				.describe('Array of employee data to create')
		},
		async ({ employees }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each employee
				const employeesWithDefaults = employees.map((employee) =>
					convertEmployeeDateFields({
						...employee,
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
					})
				);

				const response = await apiClient.post('/api/employee/bulk', { employees: employeesWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				log.error('Error bulk creating employees:', error);
				throw new Error('Failed to bulk create employees');
			}
		}
	);
};

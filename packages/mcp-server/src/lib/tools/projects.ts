import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { ProjectSchema, CurrenciesEnum } from '../schema';

const logger = new Logger('ProjectTools');

/**
 * Helper function to convert startDate and endDate strings to Date objects
 * @param data - Object that may contain startDate and endDate properties
 * @returns New object with converted dates
 */
const convertProjectDates = <T extends { startDate?: any; endDate?: any }>(data: T): T => {
	return {
		...data,
		startDate: data.startDate ? new Date(data.startDate) : undefined,
		endDate: data.endDate ? new Date(data.endDate) : undefined
	};
};

export const registerProjectTools = (server: McpServer) => {
	// Get projects tool
	server.tool(
		'get_projects',
		"Get list of projects for the authenticated user's organization",
		{
			name: z.string().optional().describe('Filter by project name (partial match)'),
			code: z.string().optional().describe('Filter by project code'),
			public: z.boolean().optional().describe('Filter by public/private projects'),
			billing: z.string().optional().describe('Filter by billing type'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["members", "teams", "tasks", "tags"])'),
			usePaginationEndpoint: z
				.boolean()
				.optional()
				.default(false)
				.describe('Use pagination endpoint for advanced pagination features')
		},
		async ({
			name,
			code,
			public: isPublic,
			billing,
			currency,
			page = 1,
			limit = 10,
			relations,
			usePaginationEndpoint = false
		}) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(name && { name }),
					...(code && { code }),
					...(isPublic !== undefined && { public: isPublic }),
					...(billing && { billing }),
					...(currency && { currency }),
					page,
					limit,
					...(relations && { relations })
				};

				const endpoint = usePaginationEndpoint
					? '/api/organization-project/pagination'
					: '/api/organization-project';
				const response = await apiClient.get(endpoint, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching projects:', error);
				throw new Error('Failed to fetch projects');
			}
		}
	);

	// Get project count tool
	server.tool(
		'get_project_count',
		"Get project count in the authenticated user's organization",
		{
			public: z.boolean().optional().describe('Filter by public/private projects'),
			billing: z.string().optional().describe('Filter by billing type')
		},
		async ({ public: isPublic, billing }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(isPublic !== undefined && { public: isPublic }),
					...(billing && { billing })
				};

				const response = await apiClient.get('/api/organization-project/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching project count:', error);
				throw new Error('Failed to fetch project count');
			}
		}
	);

	// Get projects by employee tool
	server.tool(
		'get_projects_by_employee',
		'Get projects assigned to a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			public: z.boolean().optional().describe('Filter by public/private projects'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ employeeId, public: isPublic, page = 1, limit = 10 }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(isPublic !== undefined && { public: isPublic }),
					page,
					limit
				};

				const response = await apiClient.get(`/api/organization-project/employee/${employeeId}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching projects by employee:', error);
				throw new Error('Failed to fetch projects by employee');
			}
		}
	);

	// Get my projects tool
	server.tool(
		'get_my_projects',
		'Get projects assigned to the current authenticated user',
		{
			public: z.boolean().optional().describe('Filter by public/private projects'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ public: isPublic, page = 1, limit = 10 }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(isPublic !== undefined && { public: isPublic }),
					page,
					limit
				};

				const response = await apiClient.get('/api/organization-project/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my projects:', error);
				throw new Error('Failed to fetch my projects');
			}
		}
	);

	// Get project by ID tool
	server.tool(
		'get_project',
		'Get a specific project by ID',
		{
			id: z.string().uuid().describe('The project ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["members", "teams", "tasks", "tags", "image"])')
		},
		async ({ id, relations }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/organization-project/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching project:', error);
				throw new Error('Failed to fetch project');
			}
		}
	);

	// Create project tool
	server.tool(
		'create_project',
		"Create a new project in the authenticated user's organization",
		{
			project_data: ProjectSchema.partial()
				.required({
					name: true
				})
				.describe('The data for creating the project')
		},
		async ({ project_data }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const createData = convertProjectDates({
					...project_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/organization-project', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating project:', error);
				throw new Error('Failed to create project');
			}
		}
	);

	// Update project tool
	server.tool(
		'update_project',
		'Update an existing project',
		{
			id: z.string().uuid().describe('The project ID'),
			project_data: ProjectSchema.partial().describe('The data for updating the project')
		},
		async ({ id, project_data }) => {
			try {
				// Retrieve and validate organization/tenant context
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization context is missing. Please ensure you are logged in with an organization.'
					);
				}
				const existing = await apiClient.get(`/api/organization-project/${id}`, { params: defaultParams });
				if (!existing) throw new Error('Project not found or access denied');
				const updateData = convertProjectDates({
					...project_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.put(`/api/organization-project/${id}`, updateData, {
					params: defaultParams
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
				logger.error('Error updating project:', error);
				throw new Error('Failed to update project');
			}
		}
	);

	// Delete project tool
	server.tool(
		'delete_project',
		'Delete a project',
		{
			id: z.string().uuid().describe('The project ID')
		},
		async ({ id }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};
				const response = await apiClient.delete(`/api/organization-project/${id}`, { params });
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response || { success: true, id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting project:', error);
				throw new Error('Failed to delete project');
			}
		}
	);

	// Bulk create projects tool
	server.tool(
		'bulk_create_projects',
		"Create multiple projects in bulk for the authenticated user's organization",
		{
			projects: z
				.array(
					ProjectSchema.partial()
						.required({
							name: true
						})
						.describe('Project data')
				)
				.describe('Array of project data to create')
		},
		async ({ projects }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				// Add organization and tenant ID to each project
				const projectsWithDefaults = projects.map((project) =>
					convertProjectDates({
						...project,
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
					})
				);

				const response = await apiClient.post('/api/organization-project/bulk', {
					projects: projectsWithDefaults
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
				logger.error('Error bulk creating projects:', error);
				throw new Error('Failed to bulk create projects');
			}
		}
	);

	// Bulk update projects tool
	server.tool(
		'bulk_update_projects',
		'Update multiple projects in bulk',
		{
			updates: z
				.array(
					z.object({
						id: z.string().uuid().describe('The project ID'),
						data: ProjectSchema.partial().describe('The data to update')
					})
				)
				.describe('Array of project updates')
		},
		async ({ updates }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				// Process date conversions for each update
				const processedUpdates = updates.map((update) => ({
					...update,
					data: convertProjectDates({
						...update.data,
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
					})
				}));

				const response = await apiClient.put('/api/organization-project/bulk', { updates: processedUpdates });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk updating projects:', error);
				throw new Error('Failed to bulk update projects');
			}
		}
	);

	// Bulk delete projects tool
	server.tool(
		'bulk_delete_projects',
		'Delete multiple projects in bulk',
		{
			ids: z.array(z.string().uuid()).describe('Array of project IDs to delete')
		},
		async ({ ids }) => {
			try {
				const defaultParams = authManager.getDefaultParams();
				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					ids
				};
				const response = await apiClient.delete('/api/organization-project/bulk', { data: { ids }, params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk deleting projects:', error);
				throw new Error('Failed to bulk delete projects');
			}
		}
	);

	// Get project statistics tool
	server.tool(
		'get_project_statistics',
		"Get project statistics for the authenticated user's organization",
		{
			projectId: z.string().uuid().optional().describe('Filter by specific project ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ projectId, employeeId, startDate, endDate }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(projectId && { projectId }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/organization-project/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching project statistics:', error);
				throw new Error('Failed to fetch project statistics');
			}
		}
	);

	// Assign project to employee tool
	server.tool(
		'assign_project_to_employee',
		'Assign a project to an employee',
		{
			projectId: z.string().uuid().describe('The project ID'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ projectId, employeeId }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const response = await apiClient.post(`/api/organization-project/${projectId}/assign`, {
					employeeId,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
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
				logger.error('Error assigning project to employee:', error);
				throw new Error('Failed to assign project to employee');
			}
		}
	);

	// Unassign project from employee tool
	server.tool(
		'unassign_project_from_employee',
		'Unassign a project from an employee',
		{
			projectId: z.string().uuid().describe('The project ID'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ projectId, employeeId }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const response = await apiClient.delete(`/api/organization-project/${projectId}/assign`, {
					data: {
						employeeId,
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
					}
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
				logger.error('Error unassigning project from employee:', error);
				throw new Error('Failed to unassign project from employee');
			}
		}
	);
};

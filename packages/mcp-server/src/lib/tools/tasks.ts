import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import {
	TaskSchema,
	TaskStatusEnum,
	TaskPriorityEnum,
	TaskSizeEnum,
	TaskTypeEnum,
} from '../schema';

const logger = new Logger('TaskTools');

interface TaskDateFields {
	dueDate?: string | Date;
	startDate?: string | Date;
	[key: string]: any; // For other fields that may be spread
}

const convertDateFields = (data: TaskDateFields) => ({
	...data,
	dueDate: data.dueDate ? (isNaN(Date.parse(data.dueDate.toString())) ? undefined : new Date(data.dueDate)) : undefined,
	startDate: data.startDate ? (isNaN(Date.parse(data.startDate.toString())) ? undefined : new Date(data.startDate)) : undefined
});

export const registerTaskTools = (server: McpServer) => {
	// Get tasks tool
	server.tool(
		'get_tasks',
		"Get list of tasks for the authenticated user's organization or project",
		{
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: TaskStatusEnum.optional().describe('Filter by task status'),
			priority: TaskPriorityEnum.optional().describe('Filter by task priority'),
			size: TaskSizeEnum.optional().describe('Filter by task size'),
			issueType: TaskTypeEnum.optional().describe('Filter by task issue type'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for task title or description'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["members", "tags", "project"])')
		},
		async ({
			projectId,
			employeeId,
			status,
			priority,
			size,
			issueType,
			page = 1,
			limit = 10,
			search,
			relations
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
					...(projectId && { projectId }),
					...(employeeId && { employeeId }),
					...(status && { status }),
					...(priority && { priority }),
					...(size && { size }),
					...(issueType && { issueType }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/tasks', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching tasks:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch tasks: ${message}`);
			}
		}
	);

	// Get task count tool
	server.tool(
		'get_task_count',
		"Get task count in the authenticated user's organization",
		{
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: TaskStatusEnum.optional().describe('Filter by task status')
		},
		async ({ projectId, employeeId, status }) => {
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
					...(status && { status })
				};

				const response = await apiClient.get('/api/tasks/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching task count:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch task count: ${errorMsg}`);
			}
		}
	);

	// Get tasks by pagination tool
	server.tool(
		'get_tasks_pagination',
		"Get tasks by pagination in the authenticated user's organization",
		{
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: TaskStatusEnum.optional().describe('Filter by task status'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ projectId, employeeId, status, page = 1, limit = 10, relations }) => {
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
					...(status && { status }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/tasks/pagination', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching tasks pagination:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch tasks pagination: ${errorMsg}`);
			}
		}
	);

	// Get tasks by employee tool
	server.tool(
		'get_tasks_by_employee',
		'Get tasks assigned to a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			status: TaskStatusEnum.optional().describe('Filter by task status'),
			priority: TaskPriorityEnum.optional().describe('Filter by task priority'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ employeeId, status, priority, page = 1, limit = 10 }) => {
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
					...(status && { status }),
					...(priority && { priority }),
					page,
					limit
				};

				const response = await apiClient.get(`/api/tasks/employee/${employeeId}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching tasks by employee:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch tasks by employee: ${errorMsg}`);
			}
		}
	);

	// Get my tasks tool
	server.tool(
		'get_my_tasks',
		'Get tasks assigned to the current authenticated user',
		{
			status: TaskStatusEnum.optional().describe('Filter by task status'),
			priority: TaskPriorityEnum.optional().describe('Filter by task priority'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ status, priority, page = 1, limit = 10 }) => {
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
					...(status && { status }),
					...(priority && { priority }),
					page,
					limit
				};

				const response = await apiClient.get('/api/tasks/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my tasks:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch my tasks: ${errorMsg}`);
			}
		}
	);

	// Get team tasks tool
	server.tool(
		'get_team_tasks',
		'Get tasks assigned to a specific team',
		{
			teamId: z.string().uuid().describe('The team ID'),
			status: TaskStatusEnum.optional().describe('Filter by task status'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ teamId, status, page = 1, limit = 10 }) => {
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
					...(status && { status }),
					page,
					limit
				};

				const response = await apiClient.get(`/api/tasks/team/${teamId}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching team tasks:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch team tasks: ${errorMsg}`);
			}
		}
	);

	// Create task tool
	server.tool(
		'create_task',
		"Create a new task in the authenticated user's organization",
		{
			task_data: TaskSchema.partial()
				.required({
					title: true
				})
				.describe('The data for creating the task')
		},
		async ({ task_data }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const createData = convertDateFields({
					...task_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
				});

				const response = await apiClient.post('/api/tasks', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating task:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to create task: ${errorMsg}`);
			}
		}
	);

	// Get task by ID tool
	server.tool(
		'get_task',
		'Get a specific task by ID',
		{
			id: z.string().uuid().describe('The task ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["members", "tags", "project"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/tasks/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching task:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch task: ${errorMsg}`);
			}
		}
	);

	// Update task tool
	server.tool(
		'update_task',
		'Update an existing task',
		{
			id: z.string().uuid().describe('The task ID'),
			task_data: TaskSchema.partial().describe('The data for updating the task')
		},
		async ({ id, task_data }) => {
			try {
				const updateData = convertDateFields(task_data);

				const response = await apiClient.put(`/api/tasks/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating task:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to update task: ${errorMsg}`);
			}
		}
	);

	// Delete task tool
	server.tool(
		'delete_task',
		'Delete a task',
		{
			id: z.string().uuid().describe('The task ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/tasks/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Task deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting task:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to delete task: ${errorMsg}`);
			}
		}
	);

	// Bulk create tasks tool
	server.tool(
		'bulk_create_tasks',
		"Create multiple tasks in bulk for the authenticated user's organization",
		{
			tasks: z
				.array(
					TaskSchema.partial()
						.required({
							title: true
						})
						.describe('Task data')
				)
				.describe('Array of task data to create')
		},
		async ({ tasks }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				// Add organization and tenant ID to each task
				const tasksWithDefaults = tasks.map((task) => convertDateFields({
					...task,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/tasks/bulk', { tasks: tasksWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating tasks:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to bulk create tasks: ${errorMsg}`);
			}
		}
	);

	// Bulk update tasks tool
	server.tool(
		'bulk_update_tasks',
		'Update multiple tasks in bulk',
		{
			updates: z
				.array(
					z.object({
						id: z.string().uuid().describe('The task ID'),
						data: TaskSchema.partial().describe('The data to update')
					})
				)
				.describe('Array of task updates')
		},
		async ({ updates }) => {
			try {
				// Process date conversions for each update
				const processedUpdates = updates.map((update) => ({
					...update,
					data: convertDateFields(update.data)
				}));

				const response = await apiClient.put('/api/tasks/bulk', { updates: processedUpdates });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk updating tasks:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to bulk update tasks: ${errorMsg}`);
			}
		}
	);

	// Bulk delete tasks tool
	server.tool(
		'bulk_delete_tasks',
		'Delete multiple tasks in bulk',
		{
			ids: z.array(z.string().uuid()).describe('Array of task IDs to delete')
		},
		async ({ ids }) => {
			try {
				const response = await apiClient.delete('/api/tasks/bulk', { data: { ids } });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Tasks deleted successfully', deletedIds: ids },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk deleting tasks:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to bulk delete tasks: ${errorMsg}`);
			}
		}
	);

	// Get task statistics tool
	server.tool(
		'get_task_statistics',
		"Get task statistics for the authenticated user's organization",
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

				const response = await apiClient.get('/api/tasks/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching task statistics:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to fetch task statistics: ${errorMsg}`);
			}
		}
	);

	// Assign task to employee tool
	server.tool(
		'assign_task_to_employee',
		'Assign a task to an employee',
		{
			taskId: z.string().uuid().describe('The task ID'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ taskId, employeeId }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const response = await apiClient.post(`/api/tasks/${taskId}/assign`, {
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
				logger.error('Error assigning task to employee:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to assign task to employee: ${errorMsg}`);
			}
		}
	);

	// Unassign task from employee tool
	server.tool(
		'unassign_task_from_employee',
		'Unassign a task from an employee',
		{
			taskId: z.string().uuid().describe('The task ID'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ taskId, employeeId }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const response = await apiClient.delete(`/api/tasks/${taskId}/assign`, {
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
				logger.error('Error unassigning task from employee:', error);
				const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
				throw new Error(`Failed to unassign task from employee: ${errorMsg}`);
			}
		}
	);
};

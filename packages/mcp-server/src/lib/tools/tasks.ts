// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { sanitizeErrorMessage } from '../common/error-utils';
import {
	TASK_PRIORITY_VALUES,
	TASK_SIZE_VALUES,
	TASK_STATUS_VALUES,
	TASK_TYPE_VALUES,
	TaskPriorityFilter,
	TaskSizeFilter,
	TaskStatusFilter,
	TaskTypeFilter
} from '../input-schemas';
import { registerTool } from './tool-helper';
import { TOOL_HINTS } from './tool-hints';
import {
	applyInTurn,
	buildListQuery,
	countByGroup,
	isWithinDates,
	ListQueryOptions,
	pageOf,
	readAllPages,
	toApiValue
} from './utils';

const logger = new Logger('TaskTools');

interface TaskDateFields {
	dueDate?: string | Date;
	startDate?: string | Date;
	[key: string]: any; // For other fields that may be spread
}

const convertDateFields = (data: TaskDateFields) => ({
	...data,
	dueDate: data.dueDate
		? isNaN(Date.parse(data.dueDate.toString()))
			? undefined
			: new Date(data.dueDate)
		: undefined,
	startDate: data.startDate
		? isNaN(Date.parse(data.startDate.toString()))
			? undefined
			: new Date(data.startDate)
		: undefined
});

/** The task fields the tool schemas name by key, with the values the API stores for those keys. */
const TASK_FIELD_VALUES: Record<string, Record<string, string>> = {
	status: TASK_STATUS_VALUES,
	priority: TASK_PRIORITY_VALUES,
	size: TASK_SIZE_VALUES,
	issueType: TASK_TYPE_VALUES
};

/**
 * A task to write, with a status, priority, size or type given by its key (`OPEN`, `HIGH`) turned into the value the
 * API stores (`open`, `high`), as the list filters send it. Any other value, a custom status included, is kept.
 */
const withStoredTaskValues = <T extends Record<string, unknown>>(data: T): T => {
	const stored: Record<string, unknown> = { ...data };
	for (const [field, values] of Object.entries(TASK_FIELD_VALUES)) {
		const value = stored[field];
		if (typeof value === 'string') {
			stored[field] = toApiValue(values, value);
		}
	}
	return stored as T;
};

type TaskWithMembers = { title: string; status: string; members?: { id: string }[] };

/**
 * Changes the task's assignees through `PUT /api/tasks/:id`, the task API's only way to assign. That
 * route requires `title` and `status`, so they are sent back as the task has them.
 */
const updateTaskMembers = async (
	taskId: string,
	defaultParams: { tenantId?: string; organizationId?: string },
	change: (memberIds: string[]) => string[]
) => {
	const task = await apiClient.get<TaskWithMembers>(`/api/tasks/${taskId}`, { params: { relations: ['members'] } });
	const memberIds = (task.members ?? []).map(({ id }) => id);

	return apiClient.put(`/api/tasks/${taskId}`, {
		title: task.title,
		status: task.status,
		members: change(memberIds).map((id) => ({ id })),
		organizationId: defaultParams.organizationId,
		...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
	});
};

/** `PUT /api/tasks/:id` requires `title` and `status`: an update that leaves them out sends the task's own. */
const withRequiredTaskFields = async (id: string, data: Record<string, unknown>) => {
	if (data.title !== undefined && data.status !== undefined) {
		return data;
	}

	const task = await apiClient.get<TaskWithMembers>(`/api/tasks/${id}`);
	return { ...data, title: data.title ?? task.title, status: data.status ?? task.status };
};

/**
 * The route and query of a task list. `/api/tasks` matches a title only exactly: a search reads the pagination
 * route, which matches part of the title and reads `skip` as a page number.
 */
const taskListQuery = (
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	search: string | undefined,
	options: ListQueryOptions
) => {
	if (!search) {
		return { path: '/api/tasks', params: buildListQuery(defaultParams, where, options) };
	}

	return {
		path: '/api/tasks/pagination',
		params: buildListQuery(defaultParams, { ...where, title: search }, { ...options, skipIsPage: true })
	};
};

export const registerTaskTools = (server: McpServer) => {
	// Get tasks tool
	registerTool(
		server,
		'get_tasks',
		"Get list of tasks for the authenticated user's organization or project",
		{
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: TaskStatusFilter.optional().describe('Filter by task status'),
			priority: TaskPriorityFilter.optional().describe(
				'Filter by task priority (HIGHEST matches urgent, LOWEST matches low)'
			),
			size: TaskSizeFilter.optional().describe('Filter by task size'),
			issueType: TaskTypeFilter.optional().describe('Filter by task issue type'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for the task title (partial match)'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["members", "tags", "project"])')
		},
		async (args) => {
			const {
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
			} = args as {
				projectId?: string;
				employeeId?: string;
				status?: string;
				priority?: string;
				size?: string;
				issueType?: string;
				page?: number;
				limit?: number;
				search?: string;
				relations?: string[];
			};
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				// A task has no `employeeId`: it is matched on the employees it is assigned to
				const where = {
					projectId,
					status: toApiValue(TASK_STATUS_VALUES, status),
					priority: toApiValue(TASK_PRIORITY_VALUES, priority),
					size: toApiValue(TASK_SIZE_VALUES, size),
					issueType: toApiValue(TASK_TYPE_VALUES, issueType),
					...(employeeId && { members: { id: employeeId } })
				};
				const { path, params } = taskListQuery(defaultParams, where, search, { page, limit, relations });

				const response = await apiClient.get(path, { params });

				return {
					content: [
						{
							type: 'text' as const,
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching tasks:', error);
				const message = sanitizeErrorMessage(error);
				throw new Error(`Failed to fetch tasks: ${message}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get task count tool
	server.tool(
		'get_task_count',
		"Get task count in the authenticated user's organization",
		{
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: TaskStatusFilter.optional().describe('Filter by task status')
		},
		TOOL_HINTS.readOnly,
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
					...(status && { status: toApiValue(TASK_STATUS_VALUES, status) })
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
				const errorMsg = sanitizeErrorMessage(error);
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
			status: TaskStatusFilter.optional().describe('Filter by task status'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		TOOL_HINTS.readOnly,
		async ({ projectId, employeeId, status, page = 1, limit = 10, relations }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				// A task has no `employeeId`: it is matched on the employees it is assigned to
				const where = {
					projectId,
					status: toApiValue(TASK_STATUS_VALUES, status),
					...(employeeId && { members: { id: employeeId } })
				};
				const params = buildListQuery(defaultParams, where, { page, limit, relations, skipIsPage: true });

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
				const errorMsg = sanitizeErrorMessage(error);
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
			status: TaskStatusFilter.optional().describe('Filter by task status'),
			priority: TaskPriorityFilter.optional().describe(
				'Filter by task priority (HIGHEST matches urgent, LOWEST matches low)'
			),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		TOOL_HINTS.readOnly,
		async ({ employeeId, status, priority, page = 1, limit = 10 }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const where = {
					status: toApiValue(TASK_STATUS_VALUES, status),
					priority: toApiValue(TASK_PRIORITY_VALUES, priority)
				};
				// The route answers every task of the employee, whatever page is asked: the page is cut here
				const params = { where: buildListQuery(defaultParams, where).where };
				const tasks = await apiClient.get<unknown[]>(`/api/tasks/employee/${employeeId}`, { params });
				const response = pageOf(tasks, page, limit);

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
				const errorMsg = sanitizeErrorMessage(error);
				throw new Error(`Failed to fetch tasks by employee: ${errorMsg}`);
			}
		}
	);

	// Get my tasks tool
	server.tool(
		'get_my_tasks',
		'Get tasks assigned to the current authenticated user',
		{
			status: TaskStatusFilter.optional().describe('Filter by task status'),
			priority: TaskPriorityFilter.optional().describe(
				'Filter by task priority (HIGHEST matches urgent, LOWEST matches low)'
			),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		TOOL_HINTS.readOnly,
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
					...buildListQuery(
						defaultParams,
						{ status: toApiValue(TASK_STATUS_VALUES, status) },
						{ page, limit, skipIsPage: true }
					),
					// The route reads no priority in `where`: its advanced filters carry it
					...(priority && { filters: { priorities: [toApiValue(TASK_PRIORITY_VALUES, priority)] } })
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
				const errorMsg = sanitizeErrorMessage(error);
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
			status: TaskStatusFilter.optional().describe('Filter by task status'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		TOOL_HINTS.readOnly,
		async ({ teamId, status, page = 1, limit = 10 }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const params = buildListQuery(
					defaultParams,
					{ teams: [teamId], status: toApiValue(TASK_STATUS_VALUES, status) },
					{ page, limit, skipIsPage: true }
				);

				const response = await apiClient.get('/api/tasks/team', { params });

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
				const errorMsg = sanitizeErrorMessage(error);
				throw new Error(`Failed to fetch team tasks: ${errorMsg}`);
			}
		}
	);

	// Create task tool
	server.tool(
		'create_task',
		"Create a new task in the authenticated user's organization",
		{
			task_data: z.object({ title: z.string().describe('The title (required)') }).passthrough()
				.describe('The data for creating the task')
		},
		TOOL_HINTS.write,
		async ({ task_data }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const createData = convertDateFields(
					withStoredTaskValues({
						...task_data,
						organizationId: defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
					})
				);

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
				const errorMsg = sanitizeErrorMessage(error);
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
		TOOL_HINTS.readOnly,
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
				const errorMsg = sanitizeErrorMessage(error);
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
			task_data: z.record(z.string(), z.any()).describe('The data for updating the task')
		},
		TOOL_HINTS.destructive,
		async ({ id, task_data }) => {
			try {
				const updateData = convertDateFields(withStoredTaskValues(task_data));

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
				const errorMsg = sanitizeErrorMessage(error);
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
		TOOL_HINTS.idempotentDestructive,
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
				const errorMsg = sanitizeErrorMessage(error);
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
					z.object({ title: z.string().describe('The title (required)') }).passthrough()
						.describe('Task data')
				)
				.describe('Array of task data to create')
		},
		TOOL_HINTS.write,
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
				const tasksWithDefaults = tasks.map((task) =>
					convertDateFields(
						withStoredTaskValues({
							...task,
							organizationId: defaultParams.organizationId,
							...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
						})
					)
				);

				const response = await apiClient.post('/api/tasks/bulk', { items: tasksWithDefaults });

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
				const errorMsg = sanitizeErrorMessage(error);
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
						data: z.record(z.string(), z.any()).describe('The data to update')
					})
				)
				.describe('Array of task updates')
		},
		TOOL_HINTS.destructive,
		async ({ updates }) => {
			try {
				// Process date conversions for each update
				const processedUpdates = updates.map((update) => ({
					...update,
					data: convertDateFields(withStoredTaskValues(update.data))
				}));

				const response = await applyInTurn(processedUpdates, async ({ id, data }) =>
					apiClient.put(`/api/tasks/${id}`, await withRequiredTaskFields(id, data))
				);

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
				const errorMsg = sanitizeErrorMessage(error);
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
		TOOL_HINTS.idempotentDestructive,
		async ({ ids }) => {
			try {
				await applyInTurn(ids, (id) => apiClient.delete(`/api/tasks/${id}`));

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
				const errorMsg = sanitizeErrorMessage(error);
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
		TOOL_HINTS.readOnly,
		async ({ projectId, employeeId, startDate, endDate }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				// No statistics route: count the tasks the pagination route lists, created in the date range
				const where = { projectId, ...(employeeId && { members: { id: employeeId } }) };
				const tasks = (
					await readAllPages<Record<string, string>>('/api/tasks/pagination', (page, take) =>
						buildListQuery(defaultParams, where, { page, limit: take, skipIsPage: true })
					)
				).filter(({ createdAt }) => isWithinDates(createdAt, startDate, endDate));
				const response = {
					total: tasks.length,
					...countByGroup(tasks, {
						byStatus: ({ status }) => status,
						byPriority: ({ priority }) => priority,
						bySize: ({ size }) => size,
						byIssueType: ({ issueType }) => issueType
					})
				};

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
				const errorMsg = sanitizeErrorMessage(error);
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
		TOOL_HINTS.destructive,
		async ({ taskId, employeeId }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const response = await updateTaskMembers(taskId, defaultParams, (memberIds) => [
					...new Set([...memberIds, employeeId])
				]);

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
				const errorMsg = sanitizeErrorMessage(error);
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
		TOOL_HINTS.idempotentDestructive,
		async ({ taskId, employeeId }) => {
			try {
				// Get default parameters from authenticated user
				const defaultParams = authManager.getDefaultParams();

				if (!defaultParams.organizationId) {
					throw new Error(
						'Organization ID not available. Please ensure you are logged in and have an organization.'
					);
				}

				const response = await updateTaskMembers(taskId, defaultParams, (memberIds) =>
					memberIds.filter((id) => id !== employeeId)
				);

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
				const errorMsg = sanitizeErrorMessage(error);
				throw new Error(`Failed to unassign task from employee: ${errorMsg}`);
			}
		}
	);
};

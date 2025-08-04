import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { ActivityLogSchema, ActivityLogActionEnum, ActivityLogEntityEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('ActivityLogTools');


export const registerActivityLogTools = (server: McpServer) => {
	// Get activity logs tool
	server.tool(
		'get_activity_logs',
		"Get list of activity logs for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["createdBy", "employee"])'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			actorType: z.string().optional().describe('Filter by actor type'),
			createdByUserId: z.string().uuid().optional().describe('Filter by user who performed the action'),
			employeeId: z.string().uuid().optional().describe('Filter by employee context'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)'),
			sortBy: z.enum(['createdAt', 'updatedAt', 'entity', 'action']).optional().default('createdAt').describe('Sort logs by field'),
			sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order')
		},
		async ({ page = 1, limit = 10, relations, entity, entityId, action, actorType, createdByUserId, employeeId, startDate, endDate, sortBy = 'createdAt', sortOrder = 'DESC' }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(relations && { relations }),
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(action && { action }),
					...(actorType && { actorType }),
					...(createdByUserId && { createdByUserId }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					sortBy,
					sortOrder
				};

				const response = await apiClient.get('/api/activity-logs', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity log count tool
	server.tool(
		'get_activity_log_count',
		"Get activity log count in the authenticated user's organization",
		{
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			actorType: z.string().optional().describe('Filter by actor type'),
			createdByUserId: z.string().uuid().optional().describe('Filter by user who performed the action'),
			employeeId: z.string().uuid().optional().describe('Filter by employee context'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)')
		},
		async ({ entity, entityId, action, actorType, createdByUserId, employeeId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(action && { action }),
					...(actorType && { actorType }),
					...(createdByUserId && { createdByUserId }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/activity-logs/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity log count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity log count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity log by ID tool
	server.tool(
		'get_activity_log',
		'Get a specific activity log by ID',
		{
			id: z.string().uuid().describe('The activity log ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["createdBy", "employee"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/activity-logs/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity log:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity log: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create activity log tool
	server.tool(
		'create_activity_log',
		"Create a new activity log entry in the authenticated user's organization",
		{
			log_data: ActivityLogSchema.partial()
				.required({
					entity: true,
					entityId: true,
					action: true
				})
				.describe('The data for creating the activity log')
		},
		async ({ log_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...log_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/activity-logs', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating activity log:', sanitizeForLogging(error));
				throw new Error(`Failed to create activity log: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity logs by entity tool
	server.tool(
		'get_activity_logs_by_entity',
		'Get activity logs for a specific entity',
		{
			entity: ActivityLogEntityEnum.describe('The entity type'),
			entityId: z.string().uuid().describe('The entity ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC').describe('Sort order by creation date')
		},
		async ({ entity, entityId, page = 1, limit = 10, action, startDate, endDate, relations, sortOrder = 'DESC' }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					entity,
					entityId,
					page,
					limit,
					...(action && { action }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(relations && { relations }),
					sortBy: 'createdAt',
					sortOrder
				};

				const response = await apiClient.get('/api/activity-logs', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity logs by entity:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity logs by entity: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity logs by user tool
	server.tool(
		'get_activity_logs_by_user',
		'Get activity logs created by a specific user',
		{
			userId: z.string().uuid().describe('The user ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ userId, page = 1, limit = 10, entity, action, startDate, endDate, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					createdByUserId: userId,
					page,
					limit,
					...(entity && { entity }),
					...(action && { action }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(relations && { relations }),
					sortBy: 'createdAt',
					sortOrder: 'DESC'
				};

				const response = await apiClient.get('/api/activity-logs', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity logs by user:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity logs by user: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my activity logs tool
	server.tool(
		'get_my_activity_logs',
		'Get activity logs created by the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, entity, action, startDate, endDate, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(entity && { entity }),
					...(action && { action }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/activity-logs/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get recent activity logs tool
	server.tool(
		'get_recent_activity_logs',
		"Get recent activity logs for the authenticated user's organization",
		{
			limit: z.number().optional().default(20).describe('Maximum number of recent logs'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			hours: z.number().optional().default(24).describe('Get logs from the last N hours'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ limit = 20, entity, action, hours = 24, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Calculate the start date based on hours
				const startDate = new Date(Date.now() - (hours * 60 * 60 * 1000)).toISOString();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					startDate,
					...(entity && { entity }),
					...(action && { action }),
					...(relations && { relations }),
					sortBy: 'createdAt',
					sortOrder: 'DESC'
				};

				const response = await apiClient.get('/api/activity-logs', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching recent activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch recent activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity log statistics tool
	server.tool(
		'get_activity_log_statistics',
		"Get activity log statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			groupBy: z.enum(['entity', 'action', 'user', 'date', 'hour']).optional().default('entity').describe('Group statistics by'),
			userId: z.string().uuid().optional().describe('Filter by specific user ID')
		},
		async ({ startDate, endDate, entity, action, groupBy = 'entity', userId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(entity && { entity }),
					...(action && { action }),
					...(userId && { userId }),
					groupBy
				};

				const response = await apiClient.get('/api/activity-logs/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity log statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity log statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete activity logs tool
	server.tool(
		'delete_activity_logs',
		'Delete activity logs based on criteria (for cleanup purposes)',
		{
			olderThanDays: z.number().optional().describe('Delete logs older than N days'),
			entity: ActivityLogEntityEnum.optional().describe('Delete logs for specific entity type'),
			entityId: z.string().uuid().optional().describe('Delete logs for specific entity ID'),
			action: ActivityLogActionEnum.optional().describe('Delete logs for specific action type'),
			confirm: z.boolean().describe('Confirmation flag - must be true to proceed with deletion')
		},
		async ({ olderThanDays, entity, entityId, action, confirm }) => {
			try {
				if (!confirm) {
					throw new Error('Deletion not confirmed. Set confirm parameter to true to proceed.');
				}

				const defaultParams = validateOrganizationContext();

				const deleteData = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(olderThanDays && { olderThanDays }),
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(action && { action })
				};

				const response = await apiClient.delete('/api/activity-logs/bulk', { data: deleteData });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to delete activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search activity logs tool
	server.tool(
		'search_activity_logs',
		'Search activity logs by metadata or data content',
		{
			query: z.string().describe('Search query for data content'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)')
		},
		async ({ query, limit = 20, entity, action, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(entity && { entity }),
					...(action && { action }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/activity-logs/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to search activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity timeline tool
	server.tool(
		'get_activity_timeline',
		'Get activity timeline for a specific entity',
		{
			entity: ActivityLogEntityEnum.describe('The entity type'),
			entityId: z.string().uuid().describe('The entity ID'),
			limit: z.number().optional().default(50).describe('Maximum number of timeline entries'),
			startDate: z.string().optional().describe('Timeline start date (ISO format)'),
			endDate: z.string().optional().describe('Timeline end date (ISO format)'),
			includeRelated: z.boolean().optional().default(false).describe('Include related entity activities')
		},
		async ({ entity, entityId, limit = 50, startDate, endDate, includeRelated = false }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					entity,
					entityId,
					limit,
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					includeRelated,
					sortBy: 'createdAt',
					sortOrder: 'DESC',
					relations: ['createdBy', 'employee']
				};

				const response = await apiClient.get('/api/activity-logs/timeline', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching activity timeline:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity timeline: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

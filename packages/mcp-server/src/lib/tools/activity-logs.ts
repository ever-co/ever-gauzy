// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { containsText, countByGroup, isWithinDates, readAllPages, validateOrganizationContext } from './utils';
import {
	ActivityLogActionEnum,
	ActivityLogEntityEnum,
	ActorTypeEnum,
	SortOrderEnum,
	ActivityLogSortByEnum,
	ActivityLogRelationsSchema
} from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
const ActivityLogGroupBy = z.enum(['entity', 'action', 'user', 'date', 'hour']);

const logger = new Logger('ActivityLogTools');

type DefaultParams = { tenantId?: string; organizationId?: string };
type ActivityLog = Record<string, unknown> & { createdAt?: string; createdByUserId?: string };

/**
 * Query of `GET /api/activity-log`, the only activity log route: its filters sit at the top level,
 * `skip` is a page number and `take` is at most 100.
 */
const activityLogQuery = (defaultParams: DefaultParams, filters: Record<string, unknown>) => ({
	organizationId: defaultParams.organizationId,
	...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
	...filters
});

/** Reads the logs newest first, page by page, until `stop`: the API cannot search or group them. */
const readNewestLogs = (
	defaultParams: DefaultParams,
	filters: Record<string, unknown>,
	stop?: (logs: ActivityLog[]) => boolean
) =>
	readAllPages<ActivityLog>(
		'/api/activity-log',
		(page, take) =>
			activityLogQuery(defaultParams, { ...filters, orderBy: 'createdAt', order: 'DESC', skip: page, take }),
		stop
	);

/** Whether the oldest log read so far is older than `startDate`, past which newest-first logs cannot match. */
const isPastStartDate = (logs: ActivityLog[], startDate?: string) =>
	!!startDate && new Date(logs[logs.length - 1]?.createdAt).getTime() < new Date(startDate).getTime();

/**
 * The newest logs `matches` accepts, for the filters the API does not have (user, dates, content):
 * read until `count` of them are found or the logs are older than `startDate`.
 */
const findNewestLogs = async (
	defaultParams: DefaultParams,
	filters: Record<string, unknown>,
	matches: (log: ActivityLog) => boolean,
	count: number,
	startDate?: string
) => {
	const found: ActivityLog[] = [];
	let checked = 0;
	const collect = (read: ActivityLog[]) => {
		for (; checked < read.length; checked++) {
			if (matches(read[checked])) {
				found.push(read[checked]);
			}
		}
	};

	const logs = await readNewestLogs(defaultParams, filters, (read) => {
		collect(read);
		return found.length >= count || isPastStartDate(read, startDate);
	});
	collect(logs);

	return found;
};

interface UserLogsFilters {
	page?: number;
	limit?: number;
	entity?: string;
	action?: string;
	startDate?: string;
	endDate?: string;
	relations?: string[];
}

/** One page of the newest logs created by `userId`: the API cannot filter by user. */
const findUserLogsPage = async (
	defaultParams: DefaultParams,
	userId: string,
	{ page = 1, limit = 10, entity, action, startDate, endDate, relations }: UserLogsFilters
) => {
	const logs = await findNewestLogs(
		defaultParams,
		{ ...(entity && { entity }), ...(action && { action }), ...(relations && { relations }) },
		(log) => log.createdByUserId === userId && isWithinDates(log.createdAt, startDate, endDate),
		page * limit,
		startDate
	);
	return { items: logs.slice((page - 1) * limit, page * limit) };
};

export const registerActivityLogTools = (server: McpServer) => {
	// Get activity logs tool
	registerTool(
		server,
		'get_activity_logs',
		"Get list of activity logs for the authenticated user's organization",
		{
			page: z.number().int().min(1).optional().default(1).describe('Page number for pagination'),
			limit: z.number().int().min(1).max(100).optional().default(10).describe('Number of items per page'),
			relations: ActivityLogRelationsSchema,
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			actorType: ActorTypeEnum.optional().describe('Filter by actor type (System, User or Agent)'),
			createdByUserId: z.string().uuid().optional().describe('Filter by user who performed the action'),
			employeeId: z.string().uuid().optional().describe('Filter by employee context'),
			startDate: z
				.string()
				.datetime({ offset: true })
				.optional()
				.describe('Filter logs from this date (ISO format)'),
			endDate: z
				.string()
				.datetime({ offset: true })
				.optional()
				.describe('Filter logs until this date (ISO format)'),
			sortBy: ActivityLogSortByEnum.optional().default('createdAt').describe('Sort logs by field'),
			sortOrder: SortOrderEnum.optional().default('DESC').describe('Sort order')
		},
		async ({
			page = 1,
			limit = 10,
			relations,
			entity,
			entityId,
			action,
			actorType,
			createdByUserId,
			employeeId,
			startDate,
			endDate,
			sortBy = 'createdAt',
			sortOrder = 'DESC'
		}) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = activityLogQuery(defaultParams, {
					skip: page,
					take: limit,
					...(relations !== undefined ? { relations } : {}),
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(action && { action }),
					...(actorType && { actorType }),
					...(createdByUserId && { createdByUserId }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					orderBy: sortBy,
					order: sortOrder
				});

				const response = await apiClient.get('/api/activity-log', { params });

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
	registerTool(
		server,
		'get_activity_log_count',
		"Get activity log count in the authenticated user's organization",
		{
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			entityId: z.string().uuid().optional().describe('Filter by entity ID'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			actorType: ActorTypeEnum.optional().describe('Filter by actor type (System, User or Agent)'),
			createdByUserId: z.string().uuid().optional().describe('Filter by user who performed the action'),
			employeeId: z.string().uuid().optional().describe('Filter by employee context'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)')
		},
		async ({ entity, entityId, action, actorType, createdByUserId, employeeId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// No count route: the list route answers the total
				const params = activityLogQuery(defaultParams, {
					take: 1,
					...(entity && { entity }),
					...(entityId && { entityId }),
					...(action && { action }),
					...(actorType && { actorType }),
					...(createdByUserId && { createdByUserId }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				});

				const { total } = await apiClient.get<{ total: number }>('/api/activity-log', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: total }, null, 2)
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
	registerTool(
		server,
		'get_activity_log',
		'Get a specific activity log by ID',
		{
			id: z.string().uuid().describe('The activity log ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["createdBy", "employee"])')
		},
		async () => {
			try {
				throw new Error(
					'The Gauzy API only lists activity logs. Use get_activity_logs or get_activity_logs_by_entity.'
				);
			} catch (error) {
				logger.error('Error fetching activity log:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity log: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create activity log tool
	registerTool(
		server,
		'create_activity_log',
		"Create a new activity log entry in the authenticated user's organization",
		{
			// Dedicated MCP input schema (ISO/JSON-safe). Do not reuse ActivityLogSchema:
			// nested entity refs still contain z.date() fields that break tools/list.
			log_data: z
				.object({
					entity: ActivityLogEntityEnum,
					entityId: z.string().uuid(),
					action: ActivityLogActionEnum,
					data: z.record(z.string(), z.any()).optional(),
					previousValues: z.record(z.string(), z.any()).optional(),
					updatedFields: z.array(z.string()).optional(),
					actorType: ActorTypeEnum.optional(),
					createdByUserId: z.string().uuid().optional(),
					employeeId: z.string().uuid().optional(),
					// JSON-safe employee payload (do not reuse EmployeeSchema — it contains z.date())
					employee: z.record(z.string(), z.any()).optional()
				})
				.describe('The data for creating the activity log')
		},
		async () => {
			try {
				throw new Error('The Gauzy API records activity logs itself and has no route to create one.');
			} catch (error) {
				logger.error('Error creating activity log:', sanitizeForLogging(error));
				throw new Error(`Failed to create activity log: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get activity logs by entity tool
	registerTool(
		server,
		'get_activity_logs_by_entity',
		'Get activity logs for a specific entity',
		{
			entity: ActivityLogEntityEnum.describe('The entity type'),
			entityId: z.string().uuid().describe('The entity ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: ActivityLogRelationsSchema,
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			actorType: ActorTypeEnum.optional().describe('Filter by actor type (System, User or Agent)'),
			createdByUserId: z.string().uuid().optional().describe('Filter by user who performed the action'),
			employeeId: z.string().uuid().optional().describe('Filter by employee context'),
			startDate: z.string().optional().describe('Filter logs from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter logs until this date (ISO format)'),
			sortBy: ActivityLogSortByEnum.optional().default('createdAt').describe('Sort logs by field'),
			sortOrder: SortOrderEnum.optional().default('DESC').describe('Sort order')
		},
		async ({
			entity,
			entityId,
			page = 1,
			limit = 10,
			relations,
			action,
			actorType,
			createdByUserId,
			employeeId,
			startDate,
			endDate,
			sortBy = 'createdAt',
			sortOrder = 'DESC'
		}) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = activityLogQuery(defaultParams, {
					entity,
					entityId,
					skip: page,
					take: limit,
					...(relations !== undefined ? { relations } : {}),
					...(action && { action }),
					...(actorType && { actorType }),
					...(createdByUserId && { createdByUserId }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					orderBy: sortBy,
					order: sortOrder
				});

				const response = await apiClient.get('/api/activity-log', { params });

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
	registerTool(
		server,
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

				const response = await findUserLogsPage(defaultParams, userId, {
					page,
					limit,
					entity,
					action,
					startDate,
					endDate,
					relations
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
				logger.error('Error fetching activity logs by user:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch activity logs by user: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my activity logs tool
	registerTool(
		server,
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
				const userId = authManager.getUserId();
				if (!userId) {
					throw new Error('User ID not available. Please ensure you are logged in.');
				}

				const response = await findUserLogsPage(defaultParams, userId, {
					page,
					limit,
					entity,
					action,
					startDate,
					endDate,
					relations
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
				logger.error('Error fetching my activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get recent activity logs tool
	registerTool(
		server,
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
				const startDate = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

				const params = activityLogQuery(defaultParams, {
					take: limit,
					...(entity && { entity }),
					...(action && { action }),
					...(relations && { relations }),
					orderBy: 'createdAt',
					order: 'DESC'
				});

				// The API has no date filter: keep the newest logs that fall in the window
				const { items = [] } = await apiClient.get<{ items?: ActivityLog[] }>('/api/activity-log', { params });
				const recent = items.filter(({ createdAt }) => isWithinDates(createdAt, startDate));
				const response = { items: recent, total: recent.length };

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
	registerTool(
		server,
		'get_activity_log_statistics',
		"Get activity log statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			entity: ActivityLogEntityEnum.optional().describe('Filter by entity type'),
			action: ActivityLogActionEnum.optional().describe('Filter by action type'),
			groupBy: ActivityLogGroupBy.optional().default('entity').describe('Group statistics by'),
			userId: z.string().uuid().optional().describe('Filter by specific user ID')
		},
		async ({ startDate, endDate, entity, action, groupBy = 'entity', userId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// No statistics route: count the logs of the date range, read newest first
				const logs = await findNewestLogs(
					defaultParams,
					{ ...(entity && { entity }), ...(action && { action }) },
					(log) =>
						isWithinDates(log.createdAt, startDate, endDate) && (!userId || log.createdByUserId === userId),
					Infinity,
					startDate
				);
				const groupings = {
					entity: (log: ActivityLog) => log.entity,
					action: (log: ActivityLog) => log.action,
					user: (log: ActivityLog) => log.createdByUserId,
					date: (log: ActivityLog) => log.createdAt && new Date(log.createdAt).toISOString().slice(0, 10),
					hour: (log: ActivityLog) => log.createdAt && new Date(log.createdAt).toISOString().slice(0, 13)
				};
				const response = { total: logs.length, groupBy, ...countByGroup(logs, { groups: groupings[groupBy] }) };

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
	registerTool(
		server,
		'delete_activity_logs',
		'Delete activity logs based on criteria (for cleanup purposes)',
		{
			olderThanDays: z.number().optional().describe('Delete logs older than N days'),
			entity: ActivityLogEntityEnum.optional().describe('Delete logs for specific entity type'),
			entityId: z.string().uuid().optional().describe('Delete logs for specific entity ID'),
			action: ActivityLogActionEnum.optional().describe('Delete logs for specific action type'),
			confirm: z.boolean().describe('Confirmation flag - must be true to proceed with deletion')
		},
		async ({ confirm }) => {
			try {
				if (!confirm) {
					throw new Error('Deletion not confirmed. Set confirm parameter to true to proceed.');
				}

				throw new Error('The Gauzy API keeps activity logs and has no route to delete them.');
			} catch (error) {
				logger.error('Error deleting activity logs:', sanitizeForLogging(error));
				throw new Error(`Failed to delete activity logs: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search activity logs tool
	registerTool(
		server,
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

				// No search route: match the content of the newest logs
				const logs = await findNewestLogs(
					defaultParams,
					{ ...(entity && { entity }), ...(action && { action }) },
					(log) =>
						isWithinDates(log.createdAt, startDate, endDate) &&
						containsText(JSON.stringify(Object.values(log)), query),
					limit,
					startDate
				);
				const response = { items: logs.slice(0, limit) };

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
	registerTool(
		server,
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
		async ({ entity, entityId, limit = 50, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = activityLogQuery(defaultParams, {
					entity,
					entityId,
					take: limit,
					orderBy: 'createdAt',
					order: 'DESC',
					// ActivityLog has no `createdBy` relation: its author is `createdByUserId`
					relations: ['employee']
				});

				// The API has no date filter: keep the logs of the page that fall in the range
				const { items = [] } = await apiClient.get<{ items?: ActivityLog[] }>('/api/activity-log', { params });
				const timeline = items.filter(({ createdAt }) => isWithinDates(createdAt, startDate, endDate));
				const response = { items: timeline, total: timeline.length };

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

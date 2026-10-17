// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import {
	containsText,
	countByGroup,
	getCurrentEmployeeId,
	isWithinDates,
	pageOf,
	validateOrganizationContext
} from './utils';
import { TimeOffStatusEnum, TimeOffTypeEnum } from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
const logger = new Logger('TimeOffTools');

/**
 * Helper function to convert date fields in time-off data to Date objects
 */
interface TimeOffData {
	startDate?: string | Date;
	endDate?: string | Date;
	requestDate?: string | Date;
	approvedDate?: string | Date;
	carryForwardExpiryDate?: string | Date;
	[key: string]: any; // Allow other properties since we spread them
}

interface ConvertedTimeOffData
	extends Omit<TimeOffData, 'startDate' | 'endDate' | 'requestDate' | 'approvedDate' | 'carryForwardExpiryDate'> {
	startDate?: Date;
	endDate?: Date;
	requestDate?: Date;
	approvedDate?: Date;
	carryForwardExpiryDate?: Date;
}

const convertTimeOffDateFields = (timeOffData: TimeOffData): ConvertedTimeOffData => {
	return {
		...timeOffData,
		startDate: timeOffData.startDate ? new Date(timeOffData.startDate) : undefined,
		endDate: timeOffData.endDate ? new Date(timeOffData.endDate) : undefined,
		requestDate: timeOffData.requestDate ? new Date(timeOffData.requestDate) : undefined,
		approvedDate: timeOffData.approvedDate ? new Date(timeOffData.approvedDate) : undefined,
		carryForwardExpiryDate: timeOffData.carryForwardExpiryDate
			? new Date(timeOffData.carryForwardExpiryDate)
			: undefined
	};
};

type DefaultParams = { tenantId?: string; organizationId?: string };

interface TimeOffRequestFilters {
	employeeId?: string;
	startDate?: string;
	endDate?: string;
	status?: string;
	policyId?: string;
	search?: string;
	relations?: string[];
}

/** `LeaveTypeEnum` of the API, which names two of the tool's time-off types differently. */
const API_LEAVE_TYPES = new Set([
	'ANNUAL',
	'SICK',
	'MATERNITY',
	'PATERNITY',
	'UNPAID',
	'COMPENSATORY',
	'BEREAVEMENT',
	'STUDY',
	'OTHER'
]);
const LEAVE_TYPE_ALIASES: Record<string, string> = { VACATION: 'ANNUAL', SICK_LEAVE: 'SICK' };

/** The API leave type of a tool time-off type: `VACATION` is `ANNUAL` there and `SICK_LEAVE` is `SICK`. */
const toLeaveType = (type?: string) => (type && LEAVE_TYPE_ALIASES[type]) || type;

/** The `leaveType` a policy write sends for `type`, left out when the API has no such leave type. */
const leaveTypeField = (type?: string) => {
	const leaveType = toLeaveType(type);
	return API_LEAVE_TYPES.has(leaveType) ? { leaveType } : {};
};

/**
 * The organization's time-off requests. `GET /api/time-off-request` answers the whole list for its
 * employee filter, and for its date filter only when both dates are given; it has no other filter or
 * paging, so the rest is applied here.
 */
const findTimeOffRequests = async (
	defaultParams: DefaultParams,
	{ employeeId, startDate, endDate, status, policyId, search, relations }: TimeOffRequestFilters
) => {
	const { organizationId, tenantId } = defaultParams;
	const { items = [] } = await apiClient.get<{ items?: Record<string, unknown>[] }>('/api/time-off-request', {
		params: {
			data: JSON.stringify({ relations, findInput: { organizationId, tenantId, employeeId, startDate, endDate } })
		}
	});

	return items.filter(
		(request) =>
			(!status || request.status === status) &&
			(!policyId || request.policyId === policyId) &&
			isWithinDates(request.start as string, startDate, endDate) &&
			containsText(request.description, search)
	);
};

/**
 * The organization's time-off policies, from `GET /api/time-off-policy`, which matches `findInput`
 * exactly and answers the whole list.
 */
const findTimeOffPolicies = async (
	defaultParams: DefaultParams,
	findInput: Record<string, unknown>,
	relations?: string[]
) => {
	const { organizationId, tenantId } = defaultParams;
	const { items = [] } = await apiClient.get<{ items?: Record<string, unknown>[] }>('/api/time-off-policy', {
		params: { data: JSON.stringify({ relations, findInput: { organizationId, tenantId, ...findInput } }) }
	});
	return items;
};

/**
 * Updates a policy through `PUT /api/time-off-policy/:id`, which rewrites the whole policy and its
 * employees: the fields the update leaves out are sent as the policy has them.
 */
const updateTimeOffPolicy = async (
	id: string,
	defaultParams: DefaultParams,
	update: (employeeIds: string[]) => Record<string, unknown>
) => {
	const [policy] = await findTimeOffPolicies(defaultParams, { id }, ['employees']);
	if (!policy) {
		throw new Error('Time-off policy not found');
	}

	const { employees = [], ...fields } = policy;
	const employeeIds = employees.map((employee) => employee.id);
	return apiClient.put(`/api/time-off-policy/${id}`, {
		...fields,
		employees: employeeIds,
		...update(employeeIds),
		organizationId: defaultParams.organizationId,
		...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
	});
};

export const registerTimeOffTools = (server: McpServer) => {
	// Get time-off requests tool
	registerTool(
		server,
		'get_time_off_requests',
		"Get list of time-off requests for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for request description'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["employee", "policy", "approvedBy"])'),
			status: TimeOffStatusEnum.optional().describe('Filter by request status'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			policyId: z.string().uuid().optional().describe('Filter by policy ID'),
			startDate: z.string().optional().describe('Filter requests from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter requests until this date (ISO format)')
		},
		async ({ page = 1, limit = 10, search, relations, status, employeeId, policyId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requests = await findTimeOffRequests(defaultParams, {
					employeeId,
					startDate,
					endDate,
					status,
					policyId,
					search,
					relations
				});
				const response = pageOf(requests, page, limit);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching time-off requests:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off requests: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get time-off request count tool
	registerTool(
		server,
		'get_time_off_request_count',
		"Get time-off request count in the authenticated user's organization",
		{
			status: TimeOffStatusEnum.optional().describe('Filter by request status'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			policyId: z.string().uuid().optional().describe('Filter by policy ID'),
			startDate: z.string().optional().describe('Filter requests from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter requests until this date (ISO format)')
		},
		async ({ status, employeeId, policyId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requests = await findTimeOffRequests(defaultParams, {
					status,
					employeeId,
					policyId,
					startDate,
					endDate
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: requests.length }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching time-off request count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off request count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get time-off request by ID tool
	registerTool(
		server,
		'get_time_off_request',
		'Get a specific time-off request by ID',
		{
			id: z.string().uuid().describe('The time-off request ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["employee", "policy", "approvedBy"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/time-off-request/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create time-off request tool
	registerTool(
		server,
		'create_time_off_request',
		"Create a new time-off request in the authenticated user's organization",
		{
			request_data: z
				.object({
					startDate: z.string().describe('The start date (required)'),
					endDate: z.string().describe('The end date (required)'),
					employeeId: z.string().describe('The employee ID (required)'),
					policyId: z.string().describe('The policy ID (required)')
				})
				.passthrough()
				.describe('The data for creating the time-off request')
		},
		async ({ request_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// The request entity names these fields `start`, `end` and `employees`, and requires a status
				const createData = convertTimeOffDateFields({
					start: new Date(request_data.startDate),
					end: new Date(request_data.endDate),
					employees: [{ id: request_data.employeeId }],
					status: TimeOffStatusEnum.enum.REQUESTED,
					...request_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					requestDate: new Date()
				});

				const response = await apiClient.post('/api/time-off-request', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to create time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update time-off request tool
	registerTool(
		server,
		'update_time_off_request',
		'Update an existing time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID'),
			request_data: z.record(z.string(), z.any()).describe('The data for updating the time-off request')
		},
		async ({ id, request_data }) => {
			try {
				// The request entity names the dates `start` and `end`, as create_time_off_request sends them
				const { startDate, endDate, ...fields } = request_data;
				const updateData = convertTimeOffDateFields({
					...(startDate && { start: new Date(startDate) }),
					...(endDate && { end: new Date(endDate) }),
					...fields
				});

				const response = await apiClient.put(`/api/time-off-request/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to update time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete time-off request tool
	registerTool(
		server,
		'delete_time_off_request',
		'Delete a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/time-off-request/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Time-off request deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to delete time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Approve time-off request tool
	registerTool(
		server,
		'approve_time_off_request',
		'Approve a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/time-off-request/approval/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error approving time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to approve time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Deny time-off request tool
	registerTool(
		server,
		'deny_time_off_request',
		'Deny a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID'),
			reason: z.string().optional().describe('Reason for denial')
		},
		async ({ id }) => {
			try {
				// The API records no denial reason
				const response = await apiClient.put(`/api/time-off-request/denied/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error denying time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to deny time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Cancel time-off request tool
	registerTool(
		server,
		'cancel_time_off_request',
		'Cancel a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID')
		},
		async () => {
			try {
				throw new Error(
					'The Gauzy API has no cancelled status for time-off requests. Use deny_time_off_request or delete_time_off_request.'
				);
			} catch (error) {
				logger.error('Error cancelling time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to cancel time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my time-off requests tool
	registerTool(
		server,
		'get_my_time_off_requests',
		'Get time-off requests for the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: TimeOffStatusEnum.optional().describe('Filter by request status'),
			policyId: z.string().uuid().optional().describe('Filter by policy ID'),
			startDate: z.string().optional().describe('Filter requests from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter requests until this date (ISO format)'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, status, policyId, startDate, endDate, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const employeeId = await getCurrentEmployeeId();
				const requests = await findTimeOffRequests(defaultParams, {
					employeeId,
					status,
					policyId,
					startDate,
					endDate,
					relations
				});
				const response = pageOf(requests, page, limit);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my time-off requests:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my time-off requests: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get pending time-off requests tool
	registerTool(
		server,
		'get_pending_time_off_requests',
		"Get pending time-off requests for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			policyId: z.string().uuid().optional().describe('Filter by policy ID'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, employeeId, policyId, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requests = await findTimeOffRequests(defaultParams, {
					status: TimeOffStatusEnum.enum.REQUESTED,
					employeeId,
					policyId,
					relations
				});
				const response = pageOf(requests, page, limit);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching pending time-off requests:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch pending time-off requests: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// TIME-OFF POLICIES

	// Get time-off policies tool
	registerTool(
		server,
		'get_time_off_policies',
		"Get list of time-off policies for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for policy name'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employees"])'),
			type: TimeOffTypeEnum.optional().describe('Filter by policy type'),
			requiresApproval: z.boolean().optional().describe('Filter by approval requirement'),
			paid: z.boolean().optional().describe('Filter by paid status')
		},
		async ({ page = 1, limit = 10, search, relations, type, requiresApproval, paid }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const policies = await findTimeOffPolicies(
					defaultParams,
					{
						...(type && { leaveType: toLeaveType(type) }),
						...(requiresApproval !== undefined && { requiresApproval }),
						...(paid !== undefined && { paid })
					},
					relations
				);
				const response = pageOf(
					policies.filter(({ name }) => containsText(name, search)),
					page,
					limit
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
				logger.error('Error fetching time-off policies:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off policies: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get time-off policy by ID tool
	registerTool(
		server,
		'get_time_off_policy',
		'Get a specific time-off policy by ID',
		{
			id: z.string().uuid().describe('The time-off policy ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employees"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/time-off-policy/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching time-off policy:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off policy: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create time-off policy tool
	registerTool(
		server,
		'create_time_off_policy',
		"Create a new time-off policy in the authenticated user's organization",
		{
			policy_data: z
				.object({
					name: z.string().describe('The policy name (required)'),
					type: z.string().describe('The policy type (required)')
				})
				.passthrough()
				.describe('The data for creating the time-off policy')
		},
		async ({ policy_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// The policy entity names its type `leaveType`
				const createData = convertTimeOffDateFields({
					employees: [],
					...leaveTypeField(policy_data.type),
					...policy_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/time-off-policy', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating time-off policy:', sanitizeForLogging(error));
				throw new Error(`Failed to create time-off policy: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update time-off policy tool
	registerTool(
		server,
		'update_time_off_policy',
		'Update an existing time-off policy',
		{
			id: z.string().uuid().describe('The time-off policy ID'),
			policy_data: z.record(z.string(), z.any()).describe('The data for updating the time-off policy')
		},
		async ({ id, policy_data }) => {
			try {
				const defaultParams = validateOrganizationContext();
				const response = await updateTimeOffPolicy(id, defaultParams, () =>
					convertTimeOffDateFields({ ...leaveTypeField(policy_data.type), ...policy_data })
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
				logger.error('Error updating time-off policy:', sanitizeForLogging(error));
				throw new Error(`Failed to update time-off policy: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete time-off policy tool
	registerTool(
		server,
		'delete_time_off_policy',
		'Delete a time-off policy',
		{
			id: z.string().uuid().describe('The time-off policy ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/time-off-policy/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Time-off policy deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting time-off policy:', sanitizeForLogging(error));
				throw new Error(`Failed to delete time-off policy: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Assign employees to time-off policy tool
	registerTool(
		server,
		'assign_employees_to_time_off_policy',
		'Assign employees to a time-off policy',
		{
			policyId: z.string().uuid().describe('The time-off policy ID'),
			employeeIds: z.array(z.string().uuid()).describe('Array of employee IDs to assign')
		},
		async ({ policyId, employeeIds }) => {
			try {
				const defaultParams = validateOrganizationContext();
				const response = await updateTimeOffPolicy(policyId, defaultParams, (assignedIds) => ({
					employees: [...new Set([...assignedIds, ...employeeIds])]
				}));

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error assigning employees to time-off policy:', sanitizeForLogging(error));
				throw new Error(`Failed to assign employees to time-off policy: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get time-off balance tool
	registerTool(
		server,
		'get_time_off_balance',
		'Get time-off balance for an employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			policyId: z.string().uuid().optional().describe('Filter by specific policy ID'),
			year: z.number().optional().describe('Filter by specific year')
		},
		async ({ employeeId, policyId, year }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					employeeId,
					...(policyId && { policyId }),
					...(year && { year })
				};

				const response = await apiClient.get('/api/time-off-balance', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching time-off balance:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off balance: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my time-off balance tool
	registerTool(
		server,
		'get_my_time_off_balance',
		'Get time-off balance for the current authenticated user',
		{
			policyId: z.string().uuid().optional().describe('Filter by specific policy ID'),
			year: z.number().optional().describe('Filter by specific year')
		},
		async ({ policyId, year }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(policyId && { policyId }),
					...(year && { year })
				};

				const response = await apiClient.get('/api/time-off-balance/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my time-off balance:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my time-off balance: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get time-off statistics tool
	registerTool(
		server,
		'get_time_off_statistics',
		"Get time-off statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			employeeId: z.string().uuid().optional().describe('Filter by specific employee ID'),
			policyId: z.string().uuid().optional().describe('Filter by specific policy ID'),
			type: TimeOffTypeEnum.optional().describe('Filter by time-off type'),
			groupBy: z.enum(['employee', 'policy', 'type', 'month']).optional().describe('Group statistics by')
		},
		async ({ startDate, endDate, employeeId, policyId, type, groupBy }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// No statistics route: count the requests the list route answers
				const requests = (
					await findTimeOffRequests(defaultParams, { startDate, endDate, employeeId, policyId })
				).filter(({ policy }) => !type || policy?.leaveType === toLeaveType(type));
				const groupings = {
					employee: (request) => (request.employees ?? []).map(({ id }) => id),
					policy: (request) => request.policy?.name,
					type: (request) => request.policy?.leaveType,
					month: (request) => (request.start ? new Date(request.start).toISOString().slice(0, 7) : undefined)
				};
				const response = {
					total: requests.length,
					groupBy,
					...countByGroup(requests, {
						byStatus: ({ status }) => status,
						...(groupBy && { groups: groupings[groupBy] })
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
				logger.error('Error fetching time-off statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch time-off statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

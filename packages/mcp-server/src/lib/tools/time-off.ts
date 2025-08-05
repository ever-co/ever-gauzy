import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { TimeOffRequestSchema, TimeOffPolicySchema, TimeOffStatusEnum, TimeOffTypeEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

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

interface ConvertedTimeOffData extends Omit<TimeOffData, 'startDate' | 'endDate' | 'requestDate' | 'approvedDate' | 'carryForwardExpiryDate'> {
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
		carryForwardExpiryDate: timeOffData.carryForwardExpiryDate ? new Date(timeOffData.carryForwardExpiryDate) : undefined
	};
};

export const registerTimeOffTools = (server: McpServer) => {
	// Get time-off requests tool
	server.tool(
		'get_time_off_requests',
		"Get list of time-off requests for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for request description'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "policy", "approvedBy"])'),
			status: TimeOffStatusEnum.optional().describe('Filter by request status'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			policyId: z.string().uuid().optional().describe('Filter by policy ID'),
			startDate: z.string().optional().describe('Filter requests from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter requests until this date (ISO format)')
		},
		async ({ page = 1, limit = 10, search, relations, status, employeeId, policyId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(status && { status }),
					...(employeeId && { employeeId }),
					...(policyId && { policyId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/time-off-requests', { params });

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
	server.tool(
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(status && { status }),
					...(employeeId && { employeeId }),
					...(policyId && { policyId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/time-off-requests/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
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
	server.tool(
		'get_time_off_request',
		'Get a specific time-off request by ID',
		{
			id: z.string().uuid().describe('The time-off request ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employee", "policy", "approvedBy"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/time-off-requests/${id}`, { params });

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
	server.tool(
		'create_time_off_request',
		"Create a new time-off request in the authenticated user's organization",
		{
			request_data: TimeOffRequestSchema.partial()
				.required({
					startDate: true,
					endDate: true,
					employeeId: true,
					policyId: true
				})
				.describe('The data for creating the time-off request')
		},
		async ({ request_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertTimeOffDateFields({
					...request_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					requestDate: new Date()
				});

				const response = await apiClient.post('/api/time-off-requests', createData);

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
	server.tool(
		'update_time_off_request',
		'Update an existing time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID'),
			request_data: TimeOffRequestSchema.partial().describe('The data for updating the time-off request')
		},
		async ({ id, request_data }) => {
			try {
				const updateData = convertTimeOffDateFields(request_data);

				const response = await apiClient.put(`/api/time-off-requests/${id}`, updateData);

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
	server.tool(
		'delete_time_off_request',
		'Delete a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/time-off-requests/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Time-off request deleted successfully', id }, null, 2)
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
	server.tool(
		'approve_time_off_request',
		'Approve a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/time-off-requests/${id}/approve`, {
					status: TimeOffStatusEnum.enum.APPROVED,
					approvedDate: new Date()
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
				logger.error('Error approving time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to approve time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Deny time-off request tool
	server.tool(
		'deny_time_off_request',
		'Deny a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID'),
			reason: z.string().optional().describe('Reason for denial')
		},
		async ({ id, reason }) => {
			try {
				const response = await apiClient.put(`/api/time-off-requests/${id}/deny`, {
					status: TimeOffStatusEnum.enum.DENIED,
					...(reason && { denialReason: reason })
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
				logger.error('Error denying time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to deny time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Cancel time-off request tool
	server.tool(
		'cancel_time_off_request',
		'Cancel a time-off request',
		{
			id: z.string().uuid().describe('The time-off request ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/time-off-requests/${id}/cancel`, {
					status: TimeOffStatusEnum.enum.CANCELLED
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
				logger.error('Error cancelling time-off request:', sanitizeForLogging(error));
				throw new Error(`Failed to cancel time-off request: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my time-off requests tool
	server.tool(
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(status && { status }),
					...(policyId && { policyId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/time-off-requests/me', { params });

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
	server.tool(
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					status: 'REQUESTED',
					...(employeeId && { employeeId }),
					...(policyId && { policyId }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/time-off-requests', { params });

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
	server.tool(
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(type && { type }),
					...(requiresApproval !== undefined && { requiresApproval }),
					...(paid !== undefined && { paid })
				};

				const response = await apiClient.get('/api/time-off-policies', { params });

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
	server.tool(
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

				const response = await apiClient.get(`/api/time-off-policies/${id}`, { params });

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
	server.tool(
		'create_time_off_policy',
		"Create a new time-off policy in the authenticated user's organization",
		{
			policy_data: TimeOffPolicySchema.partial()
				.required({
					name: true,
					type: true
				})
				.describe('The data for creating the time-off policy')
		},
		async ({ policy_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertTimeOffDateFields({
					...policy_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/time-off-policies', createData);

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
	server.tool(
		'update_time_off_policy',
		'Update an existing time-off policy',
		{
			id: z.string().uuid().describe('The time-off policy ID'),
			policy_data: TimeOffPolicySchema.partial().describe('The data for updating the time-off policy')
		},
		async ({ id, policy_data }) => {
			try {
				const updateData = convertTimeOffDateFields(policy_data);

				const response = await apiClient.put(`/api/time-off-policies/${id}`, updateData);

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
	server.tool(
		'delete_time_off_policy',
		'Delete a time-off policy',
		{
			id: z.string().uuid().describe('The time-off policy ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/time-off-policies/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Time-off policy deleted successfully', id }, null, 2)
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
	server.tool(
		'assign_employees_to_time_off_policy',
		'Assign employees to a time-off policy',
		{
			policyId: z.string().uuid().describe('The time-off policy ID'),
			employeeIds: z.array(z.string().uuid()).describe('Array of employee IDs to assign')
		},
		async ({ policyId, employeeIds }) => {
			try {
				const response = await apiClient.put(`/api/time-off-policies/${policyId}/employees`, {
					employeeIds
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
				logger.error('Error assigning employees to time-off policy:', sanitizeForLogging(error));
				throw new Error(`Failed to assign employees to time-off policy: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get time-off balance tool
	server.tool(
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
	server.tool(
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
	server.tool(
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

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(employeeId && { employeeId }),
					...(policyId && { policyId }),
					...(type && { type }),
					...(groupBy && { groupBy })
				};

				const response = await apiClient.get('/api/time-off-requests/statistics', { params });

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

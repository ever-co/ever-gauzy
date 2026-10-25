// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { pageOf, validateOrganizationContext } from './utils';
import { EquipmentTypeEnum, EquipmentStatusEnum } from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
const logger = new Logger('EquipmentTools');

/**
 * Helper function to convert date fields in equipment data to Date objects
 */
interface EquipmentDateFields {
	purchaseDate?: string | Date;
	warrantyEndDate?: string | Date;
	[key: string]: any; // Allow other fields to pass through
}

const convertEquipmentDateFields = (equipmentData: EquipmentDateFields) => {
	return {
		...equipmentData,
		purchaseDate: equipmentData.purchaseDate ? new Date(equipmentData.purchaseDate) : undefined,
		warrantyEndDate: equipmentData.warrantyEndDate ? new Date(equipmentData.warrantyEndDate) : undefined
	};
};

/**
 * The status a filed equipment sharing starts at: `RequestApprovalStatusTypesEnum.REQUESTED` (`1`). The column is an
 * integer of the request approval's vocabulary; the server decides the status anyway for a caller who may not decide
 * a sharing (requested, or approved when the equipment auto-approves its shares).
 */
const EQUIPMENT_SHARING_REQUESTED = 1;

/**
 * The label a request is filed under when the caller states neither a name nor a reason: the request approval filed
 * beside the sharing requires a name, and the route saves the sharing before it files the approval, so a request
 * without one would leave a sharing without its approval.
 */
export const EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME = 'Equipment sharing request';

/**
 * An ISO 8601 date (`2026-11-02`) or date-time (`2026-11-02T09:00`, `2026-11-02T09:00:00.000Z`,
 * `2026-11-02T09:00:00+02:00`), and nothing else: `new Date()` alone also reads `Nov 2 2026`, and rolls an impossible
 * day such as `2026-02-30` over into March.
 */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-](\d{2}):(\d{2}))?)?$/;

/** The arguments of the `request_equipment_sharing` tool. */
export interface EquipmentSharingRequestArgs {
	equipmentId: string;
	shareWithEmployeeId: string;
	shareStartDate: string;
	shareEndDate: string;
	name?: string;
	reason?: string;
}

/**
 * Reads an ISO date argument of the `request_equipment_sharing` tool: the grammar of {@link ISO_DATE_PATTERN}, a day
 * the calendar has, a time of day and an offset in range.
 *
 * @param value The argument.
 * @param field The argument's name, for the error.
 * @throws Error when the value is not an ISO date, or names a day, time or offset that does not exist.
 */
const toShareDate = (value: string, field: string): Date => {
	const invalid = () => new Error(`${field} is not a valid date (ISO 8601 expected, e.g. 2026-11-02T09:00:00Z)`);
	const match = typeof value === 'string' ? ISO_DATE_PATTERN.exec(value.trim()) : null;
	if (!match) {
		throw invalid();
	}
	const [, year, month, day, hour = '0', minute = '0', second = '0', , offsetHour = '0', offsetMinute = '0'] = match;
	const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	if (
		calendar.getUTCFullYear() !== Number(year) ||
		calendar.getUTCMonth() !== Number(month) - 1 ||
		calendar.getUTCDate() !== Number(day) ||
		Number(hour) > 23 ||
		Number(minute) > 59 ||
		Number(second) > 59 ||
		Number(offsetHour) > 23 ||
		Number(offsetMinute) > 59
	) {
		throw invalid();
	}
	const date = new Date(value.trim());
	if (Number.isNaN(date.getTime())) {
		throw invalid();
	}
	return date;
};

/**
 * The body `POST /api/equipment-sharing/organization/:organizationId` files an equipment sharing request from, in the
 * field names the equipment sharing carries.
 *
 * The tool used to post its arguments under their own names (`shareStartDate`, `shareEndDate`, `shareRequestDate`,
 * `shareWithEmployeeId`, `reason`) and a string `status: 'REQUESTED'` to `POST /api/equipment-sharing`. No column maps
 * those names, so the period and the employee were dropped, the status was not the integer the column holds, and that
 * route (the CRUD base's raw create, which needs the decision permission) files no request approval beside the row.
 * The request route is the one the web app files a request through: open to `EQUIPMENT_MAKE_REQUEST`, it stores the
 * row in the organization of its path and records the request approval an approver acts on.
 *
 * An equipment sharing has no reason column: the reason is filed as the request's `name` (its label) when no name is
 * given, and {@link EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME} when neither is (the request approval requires a name).
 *
 * @param args The tool's arguments.
 * @param now When the request is filed.
 * @returns The body to post.
 * @throws Error when a date argument is not an ISO date, or the period ends before it starts.
 */
export const equipmentSharingRequestBody = (args: EquipmentSharingRequestArgs, now: Date = new Date()) => {
	const name = [args.name, args.reason].find((label) => typeof label === 'string' && label.trim() !== '');
	const shareStartDay = toShareDate(args.shareStartDate, 'shareStartDate');
	const shareEndDay = toShareDate(args.shareEndDate, 'shareEndDate');
	if (shareEndDay.getTime() < shareStartDay.getTime()) {
		throw new Error('shareEndDate is before shareStartDate: a sharing period ends after it starts');
	}
	return {
		name: name?.trim() ?? EQUIPMENT_SHARING_REQUEST_DEFAULT_NAME,
		equipmentId: args.equipmentId,
		employees: [{ id: args.shareWithEmployeeId }],
		shareRequestDay: now,
		shareStartDay,
		shareEndDay,
		status: EQUIPMENT_SHARING_REQUESTED
	};
};

/**
 * The statuses an equipment sharing can be at, by the names the `get_equipment_sharing_requests` tool accepts: the
 * integer vocabulary of the request approval (`RequestApprovalStatusTypesEnum`) that the `status` column holds.
 */
export const EQUIPMENT_SHARING_STATUSES: Readonly<Record<string, number>> = Object.freeze({
	REQUESTED: 1,
	APPROVED: 2,
	REFUSED: 3
});

/**
 * Reads the `status` filter of the `get_equipment_sharing_requests` tool: a status name (`REQUESTED`, `APPROVED`,
 * `REFUSED`, any case) or its integer (`1`, `2`, `3`, as a number or a string). The column is an integer, so the
 * string the tool used to forward could never match it.
 *
 * @param status The filter as given.
 * @returns The integer the `status` column holds.
 * @throws Error for any other value, rather than a filter that matches nothing.
 */
export const equipmentSharingStatusValue = (status: string | number): number => {
	const text = String(status).trim().toUpperCase();
	if (Object.prototype.hasOwnProperty.call(EQUIPMENT_SHARING_STATUSES, text)) {
		return EQUIPMENT_SHARING_STATUSES[text];
	}
	const value = Number(text);
	if (text !== '' && Object.values(EQUIPMENT_SHARING_STATUSES).includes(value)) {
		return value;
	}
	throw new Error(
		`status must be one of ${Object.keys(EQUIPMENT_SHARING_STATUSES).join(', ')} (or ${Object.values(
			EQUIPMENT_SHARING_STATUSES
		).join(', ')})`
	);
};

/** The filters of the `get_equipment_sharing_requests` tool the route itself applies. */
export interface EquipmentSharingRequestsFindInput {
	equipmentId?: string;
	status?: string | number;
}

/** The relations `get_equipment_sharing_requests` reads each sharing with (`employees` also serves its filter). */
export const EQUIPMENT_SHARING_REQUESTS_RELATIONS = Object.freeze(['equipment', 'employees', 'teams']);

/**
 * The query `GET /api/equipment-sharing` reads: one `data` parameter, the JSON of `{ relations, findInput }`
 * (`ParseJsonPipe`), whose `findInput` becomes the read's `where`.
 *
 * The tool used to send `organizationId`, `equipmentId`, `employeeId`, `status`, `page` and `limit` as query parameters
 * of their own. The route reads none of them (a missing `data` parses to `{}`), so every filter was dropped and the
 * tool answered every sharing of the tenant, unpaged. The organization, the equipment and the status are columns of
 * the sharing, so they go into `findInput`; the employee is a membership and the route has no paging, so those two
 * are applied to the answer ({@link selectEquipmentSharingRequests}).
 *
 * @param defaultParams The caller's organization and tenant.
 * @param filters The tool's column filters.
 * @returns The query parameters to send.
 * @throws Error for a status the column cannot hold.
 */
export const equipmentSharingRequestsQuery = (
	defaultParams: { organizationId: string; tenantId?: string | null },
	{ equipmentId, status }: EquipmentSharingRequestsFindInput = {}
) => {
	const findInput: Record<string, unknown> = {
		organizationId: defaultParams.organizationId,
		...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
		...(equipmentId && { equipmentId }),
		...(status !== undefined && status !== null && status !== '' && { status: equipmentSharingStatusValue(status) })
	};
	return { data: JSON.stringify({ relations: [...EQUIPMENT_SHARING_REQUESTS_RELATIONS], findInput }) };
};

/**
 * The page of sharings `get_equipment_sharing_requests` answers: the sharings shared with the employee, when one is
 * named, then the page asked for. `total` counts every sharing that passed the filters.
 *
 * @param items The sharings the route answered.
 * @param options The employee filter and the page.
 */
export const selectEquipmentSharingRequests = (
	items: Array<Record<string, any>>,
	{ employeeId, page = 1, limit = 10 }: { employeeId?: string; page?: number; limit?: number } = {}
) => {
	const shared = employeeId
		? items.filter(
				(sharing) =>
					Array.isArray(sharing?.employees) &&
					sharing.employees.some((employee: { id?: string } | null) => employee?.id === employeeId)
			)
		: items;
	return pageOf(shared, page, limit);
};

export const registerEquipmentTools = (server: McpServer) => {
	// Get equipment tool
	registerTool(
		server,
		'get_equipment',
		"Get list of equipment for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for equipment name, model, or serial number'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["assignedTo", "image", "tags", "equipmentSharings"])'),
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			status: EquipmentStatusEnum.optional().describe('Filter by equipment status'),
			assignedToEmployeeId: z.string().uuid().optional().describe('Filter by assigned employee ID'),
			manufacturer: z.string().optional().describe('Filter by manufacturer'),
			available: z.boolean().optional().describe('Filter by availability (status = AVAILABLE)')
		},
		async ({
			page = 1,
			limit = 10,
			search,
			relations,
			type,
			status,
			assignedToEmployeeId,
			manufacturer,
			available
		}) => {
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
					...(status && { status }),
					...(assignedToEmployeeId && { assignedToEmployeeId }),
					...(manufacturer && { manufacturer }),
					...(!available && status && { status }),
					...(available && { status: 'AVAILABLE' })
				};

				const response = await apiClient.get('/api/equipment', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get equipment count tool
	registerTool(
		server,
		'get_equipment_count',
		"Get equipment count in the authenticated user's organization",
		{
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			status: EquipmentStatusEnum.optional().describe('Filter by equipment status'),
			assignedToEmployeeId: z.string().uuid().optional().describe('Filter by assigned employee ID'),
			manufacturer: z.string().optional().describe('Filter by manufacturer')
		},
		async ({ type, status, assignedToEmployeeId, manufacturer }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(type && { type }),
					...(status && { status }),
					...(assignedToEmployeeId && { assignedToEmployeeId }),
					...(manufacturer && { manufacturer })
				};

				const response = await apiClient.get('/api/equipment/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching equipment count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch equipment count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get equipment by ID tool
	registerTool(
		server,
		'get_equipment_by_id',
		'Get a specific equipment by ID',
		{
			id: z.string().uuid().describe('The equipment ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["assignedTo", "image", "tags", "equipmentSharings"])')
		},
		async ({ id, relations }) => {
			try {
				// Validate organization context and get authenticated user's organization ID
				const defaultParams = validateOrganizationContext();

				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/equipment/${id}`, { params });

				// Verify that the equipment belongs to the authenticated user's organization
				if ((response as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Access denied: Equipment does not belong to your organization');
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching equipment by ID:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create equipment tool
	registerTool(
		server,
		'create_equipment',
		"Create a new equipment in the authenticated user's organization",
		{
			equipment_data: z.object({ name: z.string().describe('The name (required)') }).passthrough()
				.describe('The data for creating the equipment')
		},
		async ({ equipment_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertEquipmentDateFields({
					...equipment_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/equipment', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to create equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update equipment tool
	registerTool(
		server,
		'update_equipment',
		'Update an existing equipment',
		{
			id: z.string().uuid().describe('The equipment ID'),
			equipment_data: z.record(z.string(), z.any()).describe('The data for updating the equipment')
		},
		async ({ id, equipment_data }) => {
			try {
				const updateData = convertEquipmentDateFields(equipment_data);

				const response = await apiClient.put(`/api/equipment/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to update equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update equipment status tool
	registerTool(
		server,
		'update_equipment_status',
		'Update the status of equipment',
		{
			id: z.string().uuid().describe('The equipment ID'),
			status: EquipmentStatusEnum.describe('The new status for the equipment')
		},
		async ({ id, status }) => {
			try {
				const response = await apiClient.put(`/api/equipment/${id}/status`, { status });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating equipment status:', sanitizeForLogging(error));
				throw new Error(`Failed to update equipment status: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Assign equipment tool
	registerTool(
		server,
		'assign_equipment',
		'Assign equipment to an employee',
		{
			id: z.string().uuid().describe('The equipment ID'),
			employeeId: z.string().uuid().describe('The employee ID to assign to')
		},
		async ({ id, employeeId }) => {
			try {
				const response = await apiClient.put(`/api/equipment/${id}/assign`, {
					assignedToEmployeeId: employeeId,
					status: 'ASSIGNED'
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
				logger.error('Error assigning equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to assign equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Unassign equipment tool
	registerTool(
		server,
		'unassign_equipment',
		'Unassign equipment from an employee (make it available)',
		{
			id: z.string().uuid().describe('The equipment ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/equipment/${id}/unassign`, {
					assignedToEmployeeId: null,
					status: 'AVAILABLE'
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
				logger.error('Error unassigning equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to unassign equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete equipment tool
	registerTool(
		server,
		'delete_equipment',
		'Delete equipment',
		{
			id: z.string().uuid().describe('The equipment ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/equipment/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Equipment deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to delete equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get equipment by employee tool
	registerTool(
		server,
		'get_equipment_by_employee',
		'Get equipment assigned to a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			status: EquipmentStatusEnum.optional().describe('Filter by equipment status'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ employeeId, page = 1, limit = 10, type, status, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					assignedToEmployeeId: employeeId,
					page,
					limit,
					...(type && { type }),
					...(status && { status }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/equipment', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching equipment by employee:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch equipment by employee: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get my equipment tool
	registerTool(
		server,
		'get_my_equipment',
		'Get equipment assigned to the current authenticated user',
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			status: EquipmentStatusEnum.optional().describe('Filter by equipment status'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, type, status, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(type && { type }),
					...(status && { status }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/equipment/me', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching my equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch my equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get available equipment tool
	registerTool(
		server,
		'get_available_equipment',
		"Get available (unassigned) equipment for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			manufacturer: z.string().optional().describe('Filter by manufacturer'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, type, manufacturer, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					status: 'AVAILABLE',
					...(type && { type }),
					...(manufacturer && { manufacturer }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/equipment', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching available equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch available equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get equipment statistics tool
	registerTool(
		server,
		'get_equipment_statistics',
		"Get equipment statistics for the authenticated user's organization",
		{
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			manufacturer: z.string().optional().describe('Filter by manufacturer'),
			groupBy: z.enum(['type', 'status', 'manufacturer', 'assignee']).optional().describe('Group statistics by')
		},
		async ({ type, manufacturer, groupBy }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(type && { type }),
					...(manufacturer && { manufacturer }),
					...(groupBy && { groupBy })
				};

				const response = await apiClient.get('/api/equipment/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching equipment statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch equipment statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Request equipment sharing tool
	registerTool(
		server,
		'request_equipment_sharing',
		'Request to share equipment with another employee',
		{
			equipmentId: z.string().uuid().describe('The equipment ID'),
			shareWithEmployeeId: z.string().uuid().describe('The employee ID to share with'),
			shareStartDate: z.string().describe('The start date for sharing (ISO 8601, e.g. 2026-11-02T09:00:00Z)'),
			shareEndDate: z.string().describe('The end date for sharing (ISO 8601, not before the start date)'),
			name: z
				.string()
				.optional()
				.describe('A label for the sharing request (defaults to the reason, else "Equipment sharing request")'),
			reason: z
				.string()
				.optional()
				.describe('Reason for sharing request (filed as the request label when no name is given)')
		},
		async ({ equipmentId, shareWithEmployeeId, shareStartDate, shareEndDate, name, reason }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// The request route reads the organization from its path and the tenant from the caller's token.
				const requestData = equipmentSharingRequestBody({
					equipmentId,
					shareWithEmployeeId,
					shareStartDate,
					shareEndDate,
					name,
					reason
				});

				const response = await apiClient.post(
					`/api/equipment-sharing/organization/${defaultParams.organizationId}`,
					requestData
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
				logger.error('Error requesting equipment sharing:', sanitizeForLogging(error));
				throw new Error(`Failed to request equipment sharing: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get equipment sharing requests tool
	registerTool(
		server,
		'get_equipment_sharing_requests',
		'Get equipment sharing requests',
		{
			equipmentId: z.string().uuid().optional().describe('Filter by equipment ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: z
				.union([z.string(), z.number()])
				.optional()
				.describe('Filter by sharing status: REQUESTED, APPROVED or REFUSED (or 1, 2, 3)'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page')
		},
		async ({ equipmentId, employeeId, status, page = 1, limit = 10 }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// The route reads a `data` JSON find-input only; the employee and the page are applied to its answer.
				const params = equipmentSharingRequestsQuery(defaultParams, { equipmentId, status });
				const { items = [] } = await apiClient.get<{ items?: Array<Record<string, any>> }>(
					'/api/equipment-sharing',
					{ params }
				);
				const response = selectEquipmentSharingRequests(items, { employeeId, page, limit });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching equipment sharing requests:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch equipment sharing requests: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search equipment tool
	registerTool(
		server,
		'search_equipment',
		'Search equipment by name, model, serial number, or description',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			status: EquipmentStatusEnum.optional().describe('Filter by equipment status'),
			manufacturer: z.string().optional().describe('Filter by manufacturer')
		},
		async ({ query, limit = 20, type, status, manufacturer }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(type && { type }),
					...(status && { status }),
					...(manufacturer && { manufacturer })
				};

				const response = await apiClient.get('/api/equipment/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching equipment:', sanitizeForLogging(error));
				throw new Error(`Failed to search equipment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

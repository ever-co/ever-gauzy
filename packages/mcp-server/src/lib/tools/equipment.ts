import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { EquipmentSchema, EquipmentTypeEnum, EquipmentStatusEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

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

export const registerEquipmentTools = (server: McpServer) => {
	// Get equipment tool
	server.tool(
		'get_equipment',
		"Get list of equipment for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for equipment name, model, or serial number'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["assignedTo", "image", "tags", "equipmentSharings"])'),
			type: EquipmentTypeEnum.optional().describe('Filter by equipment type'),
			status: EquipmentStatusEnum.optional().describe('Filter by equipment status'),
			assignedToEmployeeId: z.string().uuid().optional().describe('Filter by assigned employee ID'),
			manufacturer: z.string().optional().describe('Filter by manufacturer'),
			available: z.boolean().optional().describe('Filter by availability (status = AVAILABLE)')
		},
		async ({ page = 1, limit = 10, search, relations, type, status, assignedToEmployeeId, manufacturer, available }) => {
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
	server.tool(
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
	server.tool(
		'get_equipment_by_id',
		'Get a specific equipment by ID',
		{
			id: z.string().uuid().describe('The equipment ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["assignedTo", "image", "tags", "equipmentSharings"])')
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
	server.tool(
		'create_equipment',
		"Create a new equipment in the authenticated user's organization",
		{
			equipment_data: EquipmentSchema.partial()
				.required({
					name: true
				})
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
	server.tool(
		'update_equipment',
		'Update an existing equipment',
		{
			id: z.string().uuid().describe('The equipment ID'),
			equipment_data: EquipmentSchema.partial().describe('The data for updating the equipment')
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
	server.tool(
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
	server.tool(
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
	server.tool(
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
	server.tool(
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
							text: JSON.stringify({ success: true, message: 'Equipment deleted successfully', id }, null, 2)
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
	server.tool(
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
	server.tool(
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
	server.tool(
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
	server.tool(
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
	server.tool(
		'request_equipment_sharing',
		'Request to share equipment with another employee',
		{
			equipmentId: z.string().uuid().describe('The equipment ID'),
			shareWithEmployeeId: z.string().uuid().describe('The employee ID to share with'),
			shareStartDate: z.string().describe('The start date for sharing (ISO format)'),
			shareEndDate: z.string().describe('The end date for sharing (ISO format)'),
			reason: z.string().optional().describe('Reason for sharing request')
		},
		async ({ equipmentId, shareWithEmployeeId, shareStartDate, shareEndDate, reason }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const requestData = {
					equipmentId,
					shareWithEmployeeId,
					shareStartDate: new Date(shareStartDate),
					shareEndDate: new Date(shareEndDate),
					shareRequestDate: new Date(),
					status: 'REQUESTED',
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(reason && { reason })
				};

				const response = await apiClient.post(`/api/equipment-sharing`, requestData);

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
	server.tool(
		'get_equipment_sharing_requests',
		'Get equipment sharing requests',
		{
			equipmentId: z.string().uuid().optional().describe('Filter by equipment ID'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			status: z.string().optional().describe('Filter by sharing status'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page')
		},
		async ({ equipmentId, employeeId, status, page = 1, limit = 10 }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(equipmentId && { equipmentId }),
					...(employeeId && { employeeId }),
					...(status && { status }),
					page,
					limit
				};

				const response = await apiClient.get('/api/equipment-sharing', { params });

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
	server.tool(
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

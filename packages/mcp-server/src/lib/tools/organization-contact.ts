import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { OrganizationContactSchema, ContactTypeEnum } from '../schema';

const logger = new Logger('OrganizationContactTools');

export const registerOrganizationContactTools = (server: McpServer) => {
	// Get organization contacts tool
	server.tool(
		'get_organization_contacts',
		'Get all organization contacts with filters',
		{
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			contactType: ContactTypeEnum.optional().describe('Filter by contact type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			name: z.string().optional().describe('Filter by name (partial match)'),
			primaryEmail: z.string().optional().describe('Filter by primary email (partial match)'),
			primaryPhone: z.string().optional().describe('Filter by primary phone (partial match)'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["contact", "projects", "members"])')
		},
		async ({
			organizationId,
			tenantId,
			contactType,
			employeeId,
			name,
			primaryEmail,
			primaryPhone,
			page = 1,
			limit = 10,
			relations
		}) => {
			try {
				const response = await apiClient.get('/api/organization-contact', {
					params: {
						organizationId,
						...(tenantId && { tenantId }),
						...(contactType && { contactType }),
						...(employeeId && { employeeId }),
						...(name && { name }),
						...(primaryEmail && { primaryEmail }),
						...(primaryPhone && { primaryPhone }),
						relations: relations || [],
						page,
						limit
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
				logger.error('Error fetching organization contacts:', error);
				throw new Error('Failed to fetch organization contacts');
			}
		}
	);

	// Get organization contact count tool
	server.tool(
		'get_organization_contact_count',
		'Get organization contact count in the same tenant',
		{
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			contactType: ContactTypeEnum.optional().describe('Filter by contact type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID')
		},
		async ({ organizationId, tenantId, contactType, employeeId }) => {
			try {
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(contactType && { contactType }),
					...(employeeId && { employeeId })
				};

				const response = await apiClient.get('/api/organization-contact/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching organization contact count:', error);
				throw new Error('Failed to fetch organization contact count');
			}
		}
	);

	// Get organization contacts by pagination tool
	server.tool(
		'get_organization_contacts_pagination',
		'Get organization contacts by pagination in the same tenant',
		{
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			contactType: ContactTypeEnum.optional().describe('Filter by contact type'),
			name: z.string().optional().describe('Filter by name (partial match)'),
			primaryEmail: z.string().optional().describe('Filter by primary email (partial match)'),
			primaryPhone: z.string().optional().describe('Filter by primary phone (partial match)'),
			members: z.array(z.string().uuid()).optional().describe('Filter by member IDs'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({
			organizationId,
			tenantId,
			contactType,
			name,
			primaryEmail,
			primaryPhone,
			members,
			page = 1,
			limit = 10,
			relations
		}) => {
			try {
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(contactType && { contactType }),
					...(name && { name }),
					...(primaryEmail && { primaryEmail }),
					...(primaryPhone && { primaryPhone }),
					...(members && { members }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/organization-contact/pagination', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching organization contacts pagination:', error);
				throw new Error('Failed to fetch organization contacts pagination');
			}
		}
	);

	// Get organization contacts by employee tool
	server.tool(
		'get_organization_contacts_by_employee',
		'Get organization contacts assigned to a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			contactType: ContactTypeEnum.optional().describe('Filter by contact type')
		},
		async ({ employeeId, organizationId, tenantId, contactType }) => {
			try {
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(contactType && { contactType })
				};

				const response = await apiClient.get(`/api/organization-contact/employee/${employeeId}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching organization contacts by employee:', error);
				throw new Error('Failed to fetch organization contacts by employee');
			}
		}
	);

	// Get organization contact by ID tool
	server.tool(
		'get_organization_contact',
		'Get a specific organization contact by ID',
		{
			id: z.string().uuid().describe('The organization contact ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["contact", "projects", "members", "tags"])')
		},
		async ({ id, relations }) => {
			try {
				const response = await apiClient.get(`/api/organization-contact/${id}`, {
					params: {
						relations: relations || []
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
				logger.error('Error fetching organization contact:', error);
				throw new Error('Failed to fetch organization contact');
			}
		}
	);

	// Create organization contact tool
	server.tool(
		'create_organization_contact',
		'Create a new organization contact',
		{
			contact_data: OrganizationContactSchema.partial()
				.required({
					name: true,
					organizationId: true
				})
				.describe('The data for creating the organization contact')
		},
		async ({ contact_data }) => {
			try {
				const response = await apiClient.post('/api/organization-contact', contact_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating organization contact:', error);
				throw new Error('Failed to create organization contact');
			}
		}
	);

	// Update organization contact tool
	server.tool(
		'update_organization_contact',
		'Update an existing organization contact',
		{
			id: z.string().uuid().describe('The organization contact ID'),
			contact_data: OrganizationContactSchema.partial().describe(
				'The fields to update on the organization contact'
			)
		},
		async ({ id, contact_data }) => {
			try {
				const response = await apiClient.put(`/api/organization-contact/${id}`, contact_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating organization contact:', error);
				throw new Error('Failed to update organization contact');
			}
		}
	);

	// Update organization contact by employee tool
	server.tool(
		'update_organization_contact_by_employee',
		'Update organization contact by employee',
		{
			id: z.string().uuid().describe('The organization contact ID'),
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			contact_data: OrganizationContactSchema.partial().describe(
				'The fields to update on the organization contact'
			)
		},
		async ({ id, organizationId, tenantId, contact_data }) => {
			try {
				const updateData = {
					...contact_data,
					organizationId,
					...(tenantId && { tenantId })
				};

				const response = await apiClient.put(`/api/organization-contact/${id}/employee`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating organization contact by employee:', error);
				throw new Error('Failed to update organization contact by employee');
			}
		}
	);

	// Delete organization contact tool
	server.tool(
		'delete_organization_contact',
		'Delete an organization contact by ID',
		{
			id: z.string().uuid().describe('The organization contact ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/organization-contact/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Organization contact deleted successfully' },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting organization contact:', error);
				throw new Error('Failed to delete organization contact');
			}
		}
	);

	// Bulk create organization contacts tool
	server.tool(
		'bulk_create_organization_contacts',
		'Create multiple organization contacts in bulk',
		{
			contacts: z
				.array(
					OrganizationContactSchema.partial().required({
						name: true,
						organizationId: true
					})
				)
				.describe('Array of organization contacts to create')
		},
		async ({ contacts }) => {
			try {
				const response = await apiClient.post('/api/organization-contact/bulk', { contacts });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating organization contacts:', error);
				throw new Error('Failed to bulk create organization contacts');
			}
		}
	);

	// Bulk update organization contacts tool
	server.tool(
		'bulk_update_organization_contacts',
		'Update multiple organization contacts in bulk',
		{
			contacts: z
				.array(
					OrganizationContactSchema.partial().required({
						id: true,
						name: true,
						organizationId: true,
						tenantId: true
					})
				)
				.describe('Array of organization contacts to update')
		},
		async ({ contacts }) => {
			try {
				const response = await apiClient.put('/api/organization-contact/bulk', { contacts });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk updating organization contacts:', error);
				throw new Error('Failed to bulk update organization contacts');
			}
		}
	);

	// Bulk delete organization contacts tool
	server.tool(
		'bulk_delete_organization_contacts',
		'Delete multiple organization contacts in bulk',
		{
			ids: z.array(z.string().uuid()).describe('Array of organization contact IDs to delete')
		},
		async ({ ids }) => {
			try {
				const response = await apiClient.delete('/api/organization-contact/bulk', { data: { ids } });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									success: true,
									message: 'Organization contacts deleted successfully',
									deletedIds: ids
								},
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk deleting organization contacts:', error);
				throw new Error('Failed to bulk delete organization contacts');
			}
		}
	);

	// Get organization contact statistics tool
	server.tool(
		'get_organization_contact_statistics',
		'Get organization contact statistics',
		{
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			contactType: ContactTypeEnum.optional().describe('Filter by contact type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ organizationId, tenantId, contactType, employeeId, startDate, endDate }) => {
			try {
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					...(contactType && { contactType }),
					...(employeeId && { employeeId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/organization-contact/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching organization contact statistics:', error);
				throw new Error('Failed to fetch organization contact statistics');
			}
		}
	);

	// Assign contact to employee tool
	server.tool(
		'assign_contact_to_employee',
		'Assign an organization contact to an employee',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			employeeId: z.string().uuid().describe('The employee ID'),
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID')
		},
		async ({ contactId, employeeId, organizationId, tenantId }) => {
			try {
				const response = await apiClient.post(`/api/organization-contact/${contactId}/assign`, {
					employeeId,
					organizationId,
					...(tenantId && { tenantId })
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
				logger.error('Error assigning contact to employee:', error);
				throw new Error('Failed to assign contact to employee');
			}
		}
	);

	// Unassign contact from employee tool
	server.tool(
		'unassign_contact_from_employee',
		'Unassign an organization contact from an employee',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			employeeId: z.string().uuid().describe('The employee ID'),
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID')
		},
		async ({ contactId, employeeId, organizationId, tenantId }) => {
			try {
				const response = await apiClient.delete(`/api/organization-contact/${contactId}/assign`, {
					data: {
						employeeId,
						organizationId,
						...(tenantId && { tenantId })
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
				logger.error('Error unassigning contact from employee:', error);
				throw new Error('Failed to unassign contact from employee');
			}
		}
	);

	// Get contact projects tool
	server.tool(
		'get_contact_projects',
		'Get projects associated with an organization contact',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ contactId, organizationId, tenantId, page = 1, limit = 10 }) => {
			try {
				const params = {
					organizationId,
					...(tenantId && { tenantId }),
					page,
					limit
				};

				const response = await apiClient.get(`/api/organization-contact/${contactId}/projects`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching contact projects:', error);
				throw new Error('Failed to fetch contact projects');
			}
		}
	);

	// Invite organization contact tool
	server.tool(
		'invite_organization_contact',
		'Send invitation to an organization contact',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			organizationId: z.string().uuid().describe('The organization ID'),
			tenantId: z.string().uuid().optional().describe('The tenant ID'),
			inviteType: z.enum(['EMAIL', 'SMS']).optional().default('EMAIL').describe('Invitation type'),
			customMessage: z.string().optional().describe('Custom message for the invitation')
		},
		async ({ contactId, organizationId, tenantId, inviteType = 'EMAIL', customMessage }) => {
			try {
				const response = await apiClient.post(`/api/organization-contact/${contactId}/invite`, {
					organizationId,
					...(tenantId && { tenantId }),
					inviteType,
					...(customMessage && { customMessage })
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
				logger.error('Error inviting organization contact:', error);
				throw new Error('Failed to invite organization contact');
			}
		}
	);
};

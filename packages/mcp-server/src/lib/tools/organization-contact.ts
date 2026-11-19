// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { ContactTypeEnum } from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
import { TOOL_HINTS } from './tool-hints';
import { applyInTurn, buildListQuery, notOfferedByApi, resolveOrganizationScope } from './utils';
const logger = new Logger('OrganizationContactTools');

const ORGANIZATION_ID_DESCRIPTION = "The organization ID (defaults to the signed-in user's organization)";
const TENANT_ID_DESCRIPTION = "The tenant ID (defaults to the signed-in user's tenant)";
const organizationIdParam = z.string().uuid().optional().describe(ORGANIZATION_ID_DESCRIPTION);
const tenantIdParam = z.string().uuid().optional().describe(TENANT_ID_DESCRIPTION);

/**
 * Adds a contact to an employee's contacts, or removes it, through `PUT /organization-contact/employee`, the route
 * that edits the employees of a contact: it reads them in the organization and writes them back with the change.
 * That route answers a success for a contact it does not find, so the contact is read first, in the same scope: one
 * the API does not find, or finds in another organization, is not found, and nothing is written.
 */
const editContactsOfEmployee = async (
	contactId: string,
	employeeId: string,
	change: 'addedEntityIds' | 'removedEntityIds',
	scope: { organizationId: string; tenantId?: string }
) => {
	const contact = await apiClient.get<{ organizationId?: string }>(`/api/organization-contact/${contactId}`, {
		params: { data: JSON.stringify({ findInput: scope }) }
	});
	if (contact?.organizationId !== scope.organizationId) {
		throw new Error(`Organization contact ${contactId} not found in organization ${scope.organizationId}.`);
	}
	return apiClient.put('/api/organization-contact/employee', {
		...scope,
		member: { id: employeeId },
		[change]: [contactId]
	});
};

export const registerOrganizationContactTools = (server: McpServer) => {
	// Get organization contacts tool
	registerTool(
		server,
		'get_organization_contacts',
		'Get all organization contacts with filters',
		{
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
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
						...resolveOrganizationScope(organizationId, tenantId),
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
				logger.error('Error fetching organization contacts:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch organization contacts: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get organization contact count tool
	registerTool(
		server,
		'get_organization_contact_count',
		'Get organization contact count in the same tenant',
		{
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
			contactType: ContactTypeEnum.optional().describe('Filter by contact type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID')
		},
		async ({ organizationId, tenantId, contactType, employeeId }) => {
			try {
				const params = {
					...resolveOrganizationScope(organizationId, tenantId),
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
				logger.error('Error fetching organization contact count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch organization contact count: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get organization contacts by pagination tool
	registerTool(
		server,
		'get_organization_contacts_pagination',
		'Get organization contacts by pagination in the same tenant',
		{
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
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
					...resolveOrganizationScope(organizationId, tenantId),
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
				logger.error('Error fetching organization contacts pagination:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch organization contacts pagination: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get organization contacts by employee tool
	registerTool(
		server,
		'get_organization_contacts_by_employee',
		'Get organization contacts assigned to a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
			contactType: ContactTypeEnum.optional().describe('Filter by contact type')
		},
		async ({ employeeId, organizationId, tenantId, contactType }) => {
			try {
				const params = {
					...resolveOrganizationScope(organizationId, tenantId),
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
				logger.error('Error fetching organization contacts by employee:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch organization contacts by employee: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Get organization contact by ID tool
	registerTool(
		server,
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
				logger.error('Error fetching organization contact:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch organization contact: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Create organization contact tool
	registerTool(
		server,
		'create_organization_contact',
		'Create a new organization contact',
		{
			contact_data: z
				.object({
					name: z.string().describe('The name (required)'),
					organizationId: z.string().optional().describe(ORGANIZATION_ID_DESCRIPTION)
				})
				.passthrough()
				.describe('The data for creating the organization contact')
		},
		async ({ contact_data }) => {
			try {
				const createData = {
					...contact_data,
					...resolveOrganizationScope(contact_data.organizationId, contact_data.tenantId)
				};
				const response = await apiClient.post('/api/organization-contact', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating organization contact:', sanitizeForLogging(error));
				throw new Error(`Failed to create organization contact: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.write
	);

	// Update organization contact tool
	registerTool(
		server,
		'update_organization_contact',
		'Update an existing organization contact',
		{
			id: z.string().uuid().describe('The organization contact ID'),
			contact_data: z.record(z.string(), z.any()).describe('The fields to update on the organization contact')
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
				logger.error('Error updating organization contact:', sanitizeForLogging(error));
				throw new Error(`Failed to update organization contact: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Update organization contact by employee tool
	registerTool(
		server,
		'update_organization_contact_by_employee',
		'Update organization contact by employee',
		{
			id: z.string().uuid().describe('The organization contact ID'),
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
			contact_data: z.record(z.string(), z.any()).describe('The fields to update on the organization contact')
		},
		async () => {
			try {
				throw notOfferedByApi(
					'updating the fields of a contact on behalf of an employee',
					'update_organization_contact changes its fields, ' +
						'assign_contact_to_employee and unassign_contact_from_employee its employees.'
				);
			} catch (error) {
				logger.error('Error updating organization contact by employee:', sanitizeForLogging(error));
				throw new Error(`Failed to update organization contact by employee: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Delete organization contact tool
	registerTool(
		server,
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
				logger.error('Error deleting organization contact:', sanitizeForLogging(error));
				throw new Error(`Failed to delete organization contact: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Bulk create organization contacts tool
	registerTool(
		server,
		'bulk_create_organization_contacts',
		'Create multiple organization contacts in bulk',
		{
			contacts: z
				.array(
					z
						.object({
							name: z.string().describe('The name (required)'),
							organizationId: z.string().optional().describe(ORGANIZATION_ID_DESCRIPTION)
						})
						.passthrough()
				)
				.describe('Array of organization contacts to create')
		},
		async ({ contacts }) => {
			try {
				const contactsInScope = contacts.map((contact) => ({
					...contact,
					...resolveOrganizationScope(contact.organizationId, contact.tenantId)
				}));
				const response = await applyInTurn(contactsInScope, (contact) =>
					apiClient.post('/api/organization-contact', contact)
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
				logger.error('Error bulk creating organization contacts:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk create organization contacts: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.write
	);

	// Bulk update organization contacts tool
	registerTool(
		server,
		'bulk_update_organization_contacts',
		'Update multiple organization contacts in bulk',
		{
			contacts: z
				.array(
					z
						.object({
							id: z.string().describe('The ID (required)'),
							name: z.string().describe('The name (required)'),
							organizationId: z.string().optional().describe(ORGANIZATION_ID_DESCRIPTION),
							tenantId: z.string().optional().describe(TENANT_ID_DESCRIPTION)
						})
						.passthrough()
				)
				.describe('Array of organization contacts to update')
		},
		async ({ contacts }) => {
			try {
				const contactsInScope = contacts.map((contact) => ({
					...contact,
					...resolveOrganizationScope(contact.organizationId, contact.tenantId)
				}));
				const response = await applyInTurn(contactsInScope, ({ id, ...contact }) =>
					apiClient.put(`/api/organization-contact/${id}`, contact)
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
				logger.error('Error bulk updating organization contacts:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk update organization contacts: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Bulk delete organization contacts tool
	registerTool(
		server,
		'bulk_delete_organization_contacts',
		'Delete multiple organization contacts in bulk',
		{
			ids: z.array(z.string().uuid()).describe('Array of organization contact IDs to delete')
		},
		async ({ ids }) => {
			try {
				const params = resolveOrganizationScope();
				await applyInTurn(ids, (id) => apiClient.delete(`/api/organization-contact/${id}`, { params }));

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
				logger.error('Error bulk deleting organization contacts:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk delete organization contacts: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Get organization contact statistics tool
	registerTool(
		server,
		'get_organization_contact_statistics',
		'Get organization contact statistics',
		{
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
			contactType: ContactTypeEnum.optional().describe('Filter by contact type'),
			employeeId: z.string().uuid().optional().describe('Filter by employee ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async () => {
			try {
				throw notOfferedByApi('organization contact statistics');
			} catch (error) {
				logger.error('Error fetching organization contact statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch organization contact statistics: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.readOnly
	);

	// Assign contact to employee tool
	registerTool(
		server,
		'assign_contact_to_employee',
		'Assign an organization contact to an employee',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			employeeId: z.string().uuid().describe('The employee ID'),
			organizationId: organizationIdParam,
			tenantId: tenantIdParam
		},
		async ({ contactId, employeeId, organizationId, tenantId }) => {
			try {
				const scope = resolveOrganizationScope(organizationId, tenantId);
				const response = await editContactsOfEmployee(contactId, employeeId, 'addedEntityIds', scope);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error assigning contact to employee:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		},
		TOOL_HINTS.write
	);

	// Unassign contact from employee tool
	registerTool(
		server,
		'unassign_contact_from_employee',
		'Unassign an organization contact from an employee',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			employeeId: z.string().uuid().describe('The employee ID'),
			organizationId: organizationIdParam,
			tenantId: tenantIdParam
		},
		async ({ contactId, employeeId, organizationId, tenantId }) => {
			try {
				const scope = resolveOrganizationScope(organizationId, tenantId);
				const response = await editContactsOfEmployee(contactId, employeeId, 'removedEntityIds', scope);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error unassigning contact from employee:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Get contact projects tool
	registerTool(
		server,
		'get_contact_projects',
		'Get projects associated with an organization contact',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page')
		},
		async ({ contactId, organizationId, tenantId, page = 1, limit = 10 }) => {
			try {
				const scope = resolveOrganizationScope(organizationId, tenantId);
				// The guard reads the tenant at the top of the query, the list route its `where`
				const params = {
					...scope,
					...buildListQuery(scope, { organizationContactId: contactId }, { page, limit })
				};
				const response = await apiClient.get('/api/organization-projects', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching contact projects:', sanitizeForLogging(error));
				throw new Error(sanitizeErrorMessage(error));
			}
		},
		TOOL_HINTS.readOnly
	);

	// Invite organization contact tool
	registerTool(
		server,
		'invite_organization_contact',
		'Send invitation to an organization contact',
		{
			contactId: z.string().uuid().describe('The organization contact ID'),
			organizationId: organizationIdParam,
			tenantId: tenantIdParam,
			inviteType: z.enum(['EMAIL', 'SMS']).optional().default('EMAIL').describe('Invitation type'),
			customMessage: z.string().optional().describe('Custom message for the invitation')
		},
		async ({ contactId, organizationId, tenantId, inviteType = 'EMAIL', customMessage }) => {
			try {
				if (inviteType === 'SMS') {
					throw notOfferedByApi('inviting a contact by SMS');
				}
				if (customMessage) {
					throw notOfferedByApi('a custom message on a contact invitation');
				}

				// The route emails the invitation to the contact's primary email. It takes no body: the scope is there
				// for its guard, which reads the tenant from the body.
				const scope = resolveOrganizationScope(organizationId, tenantId);
				const response = await apiClient.put(`/api/invite/organization-contact/${contactId}`, scope);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error inviting organization contact:', sanitizeForLogging(error));
				throw new Error(`Failed to invite organization contact: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.openWorldDestructive
	);
};

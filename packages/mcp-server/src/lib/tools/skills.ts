import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { SkillSchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('SkillTools');


export const registerSkillTools = (server: McpServer) => {
	// Get skills tool
	server.tool(
		'get_skills',
		"Get list of skills for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for skill name or description'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employees"])')
		},
		async ({ page = 1, limit = 10, search, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/skills', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching skills:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch skills: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get skill by ID tool
	server.tool(
		'get_skill',
		'Get a specific skill by ID',
		{
			id: z.string().uuid().describe('The skill ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["employees"])')
		},
		async ({ id, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();
				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/skills/${id}`, { params });
				// Verify the returned skill belongs to the user's organization
				if (response && (response as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Skill not found or does not belong to your organization');
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
				logger.error('Error fetching skill:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch skill: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create skill tool
	server.tool(
		'create_skill',
		"Create a new skill in the authenticated user's organization",
		{
			skill_data: SkillSchema.partial()
				.required({
					name: true
				})
				.describe('The data for creating the skill')
		},
		async ({ skill_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...skill_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/skills', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating skill:', sanitizeForLogging(error));
				throw new Error(`Failed to create skill: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update skill tool
	server.tool(
		'update_skill',
		'Update an existing skill',
		{
			id: z.string().uuid().describe('The skill ID'),
			skill_data: SkillSchema.partial().describe('The data for updating the skill')
		},
		async ({ id, skill_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// First verify the skill belongs to the organization
				const existing = await apiClient.get(`/api/skills/${id}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!existing) {
					throw new Error('Skill not found');
				}
				// Verify organization ownership
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot update skills from other organizations');
				}

				const response = await apiClient.put(`/api/skills/${id}`, skill_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating skill:', sanitizeForLogging(error));
				throw new Error(`Failed to update skill: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete skill tool
	server.tool(
		'delete_skill',
		'Delete a skill',
		{
			id: z.string().uuid().describe('The skill ID')
		},
		async ({ id }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// First verify the skill belongs to the organization
				const existing = await apiClient.get(`/api/skills/${id}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!existing) {
					throw new Error('Skill not found');
				}

				// Type assertion since we know the response shape
				const existingSkill = existing as { organizationId: string };
				if (existingSkill.organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot delete skills from other organizations');
				}

				await apiClient.delete(`/api/skills/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Skill deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting skill:', sanitizeForLogging(error));
				throw new Error(`Failed to delete skill: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Assign skill to employee tool
	server.tool(
		'assign_skill_to_employee',
		'Assign a skill to an employee',
		{
			skillId: z.string().uuid().describe('The skill ID'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ skillId, employeeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify skill belongs to organization
				const skill = await apiClient.get(`/api/skills/${skillId}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!skill || (skill as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Skill not found or does not belong to your organization');
				}

				// Verify employee belongs to the same organization
				const employee = await apiClient.get(`/api/employees/${employeeId}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!employee || (employee as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Employee not found or does not belong to your organization');
				}

				const response = await apiClient.post(`/api/skills/${skillId}/employees`, {
					employeeId
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
				logger.error('Error assigning skill to employee:', sanitizeForLogging(error));
				throw new Error(`Failed to assign skill to employee: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Remove skill from employee tool
	server.tool(
		'remove_skill_from_employee',
		'Remove a skill from an employee',
		{
			skillId: z.string().uuid().describe('The skill ID'),
			employeeId: z.string().uuid().describe('The employee ID')
		},
		async ({ skillId, employeeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify skill belongs to organization
				const skill = await apiClient.get(`/api/skills/${skillId}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!skill || (skill as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Skill not found or does not belong to your organization');
				}
				// Verify employee belongs to the same organization
				const employee = await apiClient.get(`/api/employees/${employeeId}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!employee || (employee as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Employee not found or does not belong to your organization');
				}

				await apiClient.delete(`/api/skills/${skillId}/employees/${employeeId}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Skill removed from employee successfully', skillId, employeeId }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error removing skill from employee:', sanitizeForLogging(error));
				throw new Error(`Failed to remove skill from employee: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get skills by employee tool
	server.tool(
		'get_skills_by_employee',
		'Get skills assigned to a specific employee',
		{
			employeeId: z.string().uuid().describe('The employee ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page')
		},
		async ({ employeeId, page = 1, limit = 10 }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify employee belongs to the organization
				const employee = await apiClient.get(`/api/employees/${employeeId}`, {
					params: { organizationId: defaultParams.organizationId }
				});

				if (!employee || (employee as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Employee not found or does not belong to your organization');
				}

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					employeeId,
					page,
					limit
				};

				const response = await apiClient.get('/api/skills', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching skills by employee:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch skills by employee: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search skills tool
	server.tool(
		'search_skills',
		'Search skills by name or description',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results')
		},
		async ({ query, limit = 20 }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit
				};

				const response = await apiClient.get('/api/skills/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching skills:', sanitizeForLogging(error));
				throw new Error(`Failed to search skills: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Bulk create skills tool
	server.tool(
		'bulk_create_skills',
		"Create multiple skills in bulk for the authenticated user's organization",
		{
			skills: z.array(
				SkillSchema.partial()
					.required({
						name: true
					})
					.describe('Skill data')
			).describe('Array of skill data to create')
		},
		async ({ skills }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each skill
				const skillsWithDefaults = skills.map((skill) => ({
					...skill,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/skills/bulk', { skills: skillsWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating skills:', sanitizeForLogging(error));
				throw new Error(`Failed to bulk create skills: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};

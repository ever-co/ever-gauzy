import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { SkillSchema } from '../schema';

const logger = new Logger('SkillTools');

/**
 * Helper function to validate organization context and return default parameters
 */
const validateOrganizationContext = () => {
	const defaultParams = authManager.getDefaultParams();

	if (!defaultParams.organizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return defaultParams;
};

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
				logger.error('Error fetching skills:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch skills: ${message}`);
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
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/skills/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching skill:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch skill: ${message}`);
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
				logger.error('Error creating skill:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create skill: ${message}`);
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
				logger.error('Error updating skill:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update skill: ${message}`);
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
				logger.error('Error deleting skill:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete skill: ${message}`);
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
				logger.error('Error assigning skill to employee:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to assign skill to employee: ${message}`);
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
				logger.error('Error removing skill from employee:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to remove skill from employee: ${message}`);
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
				logger.error('Error fetching skills by employee:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch skills by employee: ${message}`);
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
				logger.error('Error searching skills:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search skills: ${message}`);
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
				logger.error('Error bulk creating skills:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to bulk create skills: ${message}`);
			}
		}
	);
};
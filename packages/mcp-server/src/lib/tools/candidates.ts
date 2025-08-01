import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { CandidateSchema, CandidateStatusEnum, CurrenciesEnum } from '../schema';

const logger = new Logger('CandidateTools');

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

/**
 * Helper function to convert date fields in candidate data to Date objects
 */
const convertCandidateDateFields = (candidateData: any) => {
	return {
		...candidateData,
		appliedDate: candidateData.appliedDate ? new Date(candidateData.appliedDate) : undefined,
		hiredDate: candidateData.hiredDate ? new Date(candidateData.hiredDate) : undefined,
		rejectDate: candidateData.rejectDate ? new Date(candidateData.rejectDate) : undefined,
		valueDate: candidateData.valueDate ? new Date(candidateData.valueDate) : undefined
	};
};

export const registerCandidateTools = (server: McpServer) => {
	// Get candidates tool
	server.tool(
		'get_candidates',
		"Get list of candidates for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for candidate name or email'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["user", "contact", "organizationPosition", "skills", "experience"])'),
			status: CandidateStatusEnum.optional().describe('Filter by candidate status'),
			organizationPositionId: z.string().uuid().optional().describe('Filter by organization position ID'),
			sourceId: z.string().uuid().optional().describe('Filter by candidate source ID'),
			rating: z.number().min(0).max(5).optional().describe('Filter by minimum rating')
		},
		async ({ page = 1, limit = 10, search, relations, status, organizationPositionId, sourceId, rating }) => {
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
					...(organizationPositionId && { organizationPositionId }),
					...(sourceId && { sourceId }),
					...(rating !== undefined && { rating })
				};

				const response = await apiClient.get('/api/candidates', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidates:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidates: ${message}`);
			}
		}
	);

	// Get candidate count tool
	server.tool(
		'get_candidate_count',
		"Get candidate count in the authenticated user's organization",
		{
			status: CandidateStatusEnum.optional().describe('Filter by candidate status'),
			organizationPositionId: z.string().uuid().optional().describe('Filter by organization position ID'),
			sourceId: z.string().uuid().optional().describe('Filter by candidate source ID')
		},
		async ({ status, organizationPositionId, sourceId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(status && { status }),
					...(organizationPositionId && { organizationPositionId }),
					...(sourceId && { sourceId })
				};

				const response = await apiClient.get('/api/candidates/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidate count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidate count: ${message}`);
			}
		}
	);

	// Get candidate by ID tool
	server.tool(
		'get_candidate',
		'Get a specific candidate by ID',
		{
			id: z.string().uuid().describe('The candidate ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["user", "contact", "skills", "experience", "education", "documents"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/candidates/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidate:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidate: ${message}`);
			}
		}
	);

	// Create candidate tool
	server.tool(
		'create_candidate',
		"Create a new candidate in the authenticated user's organization",
		{
			candidate_data: CandidateSchema.partial()
				.required({
					userId: true
				})
				.describe('The data for creating the candidate')
		},
		async ({ candidate_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertCandidateDateFields({
					...candidate_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/candidates', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating candidate:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create candidate: ${message}`);
			}
		}
	);

	// Update candidate tool
	server.tool(
		'update_candidate',
		'Update an existing candidate',
		{
			id: z.string().uuid().describe('The candidate ID'),
			candidate_data: CandidateSchema.partial().describe('The data for updating the candidate')
		},
		async ({ id, candidate_data }) => {
			try {
				const updateData = convertCandidateDateFields(candidate_data);

				const response = await apiClient.put(`/api/candidates/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating candidate:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update candidate: ${message}`);
			}
		}
	);

	// Update candidate status tool
	server.tool(
		'update_candidate_status',
		'Update the status of a candidate',
		{
			id: z.string().uuid().describe('The candidate ID'),
			status: CandidateStatusEnum.describe('The new status for the candidate')
		},
		async ({ id, status }) => {
			try {
				const response = await apiClient.put(`/api/candidates/${id}/status`, { status });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating candidate status:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update candidate status: ${message}`);
			}
		}
	);

	// Rate candidate tool
	server.tool(
		'rate_candidate',
		'Rate a candidate',
		{
			id: z.string().uuid().describe('The candidate ID'),
			rating: z.number().min(0).max(5).describe('The rating (0-5)')
		},
		async ({ id, rating }) => {
			try {
				const response = await apiClient.put(`/api/candidates/${id}/rating`, { rating });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error rating candidate:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to rate candidate: ${message}`);
			}
		}
	);

	// Delete candidate tool
	server.tool(
		'delete_candidate',
		'Delete a candidate',
		{
			id: z.string().uuid().describe('The candidate ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/candidates/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Candidate deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting candidate:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete candidate: ${message}`);
			}
		}
	);

	// Get candidates by position tool
	server.tool(
		'get_candidates_by_position',
		'Get candidates for a specific organization position',
		{
			positionId: z.string().uuid().describe('The organization position ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: CandidateStatusEnum.optional().describe('Filter by candidate status'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ positionId, page = 1, limit = 10, status, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					organizationPositionId: positionId,
					page,
					limit,
					...(status && { status }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/candidates', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidates by position:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidates by position: ${message}`);
			}
		}
	);

	// Get candidate skills tool
	server.tool(
		'get_candidate_skills',
		'Get skills for a specific candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID')
		},
		async ({ candidateId }) => {
			try {
				const response = await apiClient.get(`/api/candidate-skills`, { 
					params: { candidateId } 
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
				logger.error('Error fetching candidate skills:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidate skills: ${message}`);
			}
		}
	);

	// Add candidate skill tool
	server.tool(
		'add_candidate_skill',
		'Add a skill to a candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID'),
			skill: z.object({
				name: z.string().describe('Skill name'),
				proficiency: z.string().optional().describe('Proficiency level (e.g., "Beginner", "Intermediate", "Advanced", "Expert")')
			}).describe('The skill to add')
		},
		async ({ candidateId, skill }) => {
			try {
				const response = await apiClient.post('/api/candidate-skills', {
					candidateId,
					...skill
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
				logger.error('Error adding candidate skill:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to add candidate skill: ${message}`);
			}
		}
	);

	// Get candidate experience tool
	server.tool(
		'get_candidate_experience',
		'Get experience for a specific candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID')
		},
		async ({ candidateId }) => {
			try {
				const response = await apiClient.get(`/api/candidate-experience`, { 
					params: { candidateId } 
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
				logger.error('Error fetching candidate experience:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidate experience: ${message}`);
			}
		}
	);

	// Add candidate experience tool
	server.tool(
		'add_candidate_experience',
		'Add work experience to a candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID'),
			experience: z.object({
				occupation: z.string().describe('Job title/occupation'),
				organization: z.string().describe('Company/organization name'),
				duration: z.string().describe('Duration of employment (e.g., "2 years", "Jan 2020 - Dec 2022")'),
				description: z.string().optional().describe('Description of responsibilities and achievements')
			}).describe('The experience to add')
		},
		async ({ candidateId, experience }) => {
			try {
				const response = await apiClient.post('/api/candidate-experience', {
					candidateId,
					...experience
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
				logger.error('Error adding candidate experience:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to add candidate experience: ${message}`);
			}
		}
	);

	// Get candidate education tool
	server.tool(
		'get_candidate_education',
		'Get education for a specific candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID')
		},
		async ({ candidateId }) => {
			try {
				const response = await apiClient.get(`/api/candidate-education`, { 
					params: { candidateId } 
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
				logger.error('Error fetching candidate education:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidate education: ${message}`);
			}
		}
	);

	// Add candidate education tool
	server.tool(
		'add_candidate_education',
		'Add education to a candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID'),
			education: z.object({
				schoolName: z.string().describe('School/university name'),
				degree: z.string().describe('Degree obtained'),
				field: z.string().describe('Field of study'),
				completionDate: z.string().optional().describe('Completion date (ISO format)'),
				notes: z.string().optional().describe('Additional notes about the education')
			}).describe('The education to add')
		},
		async ({ candidateId, education }) => {
			try {
				const educationData = {
					...education,
					candidateId,
					...(education.completionDate && { completionDate: new Date(education.completionDate) })
				};

				const response = await apiClient.post('/api/candidate-education', educationData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding candidate education:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to add candidate education: ${message}`);
			}
		}
	);

	// Get candidate statistics tool
	server.tool(
		'get_candidate_statistics',
		"Get candidate statistics for the authenticated user's organization",
		{
			organizationPositionId: z.string().uuid().optional().describe('Filter by organization position ID'),
			sourceId: z.string().uuid().optional().describe('Filter by candidate source ID'),
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)')
		},
		async ({ organizationPositionId, sourceId, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(organizationPositionId && { organizationPositionId }),
					...(sourceId && { sourceId }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/candidates/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidate statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch candidate statistics: ${message}`);
			}
		}
	);

	// Search candidates tool
	server.tool(
		'search_candidates',
		'Search candidates by name, email, or skills',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			status: CandidateStatusEnum.optional().describe('Filter by candidate status'),
			organizationPositionId: z.string().uuid().optional().describe('Filter by organization position ID')
		},
		async ({ query, limit = 20, status, organizationPositionId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(status && { status }),
					...(organizationPositionId && { organizationPositionId })
				};

				const response = await apiClient.get('/api/candidates/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching candidates:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search candidates: ${message}`);
			}
		}
	);
};
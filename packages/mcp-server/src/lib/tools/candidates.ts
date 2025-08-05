import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { CandidateSchema, CandidateStatusEnum } from '../schema';
import { validateOrganizationContext } from './utils';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('CandidateTools');


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

				const response = await apiClient.get('/api/candidate', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidates:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidates: ' + sanitizeErrorMessage(error));
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

				const response = await apiClient.get('/api/candidate/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidate count:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidate count: ' + sanitizeErrorMessage(error));
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
				// Validate organization context and get authenticated user's organization ID
				const defaultParams = validateOrganizationContext();

				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/candidate/${id}`, { params });

				// Verify that the candidate belongs to the authenticated user's organization
				if ((response as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Access denied: Candidate does not belong to your organization');
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
				logger.error('Error fetching candidate:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidate by ID: ' + sanitizeErrorMessage(error));
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

				const response = await apiClient.post('/api/candidate', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating candidate:', sanitizeForLogging(error));
				throw new Error('Failed to create candidate: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const existing = await apiClient.get(`/api/candidate/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot update candidates from other organizations');
				}

				const updateData = convertCandidateDateFields(candidate_data);

				const response = await apiClient.put(`/api/candidate/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating candidate:', sanitizeForLogging(error));
				throw new Error('Failed to update candidate: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const existing = await apiClient.get(`/api/candidate/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot update status of candidates from other organizations');
				}

				const response = await apiClient.put(`/api/candidate/${id}/status`, { status });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating candidate status:', sanitizeForLogging(error));
				throw new Error('Failed to update candidate status: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const existing = await apiClient.get(`/api/candidate/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot rate candidates from other organizations');
				}

				const response = await apiClient.put(`/api/candidate/${id}/rating`, { rating });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error rating candidate:', sanitizeForLogging(error));
				throw new Error('Failed to rate candidate: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const existing = await apiClient.get(`/api/candidate/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot delete candidates from other organizations');
				}

				await apiClient.delete(`/api/candidate/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Candidate deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting candidate:', sanitizeForLogging(error));
				throw new Error('Failed to delete candidate: ' + sanitizeErrorMessage(error));
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

				const response = await apiClient.get('/api/candidate', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching candidates by position:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidates by position: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot access skills for candidates from other organizations');
				}

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
				logger.error('Error fetching candidate skills:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidate skills: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot add skills to candidates from other organizations');
				}

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
				logger.error('Error adding candidate skill:', sanitizeForLogging(error));
				throw new Error('Failed to add candidate skill: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot access experience for candidates from other organizations');
				}

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
				logger.error('Error fetching candidate experience:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidate experience: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot add experience to candidates from other organizations');
				}

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
				logger.error('Error adding candidate experience:', sanitizeForLogging(error));
				throw new Error('Failed to add candidate experience: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot access education for candidates from other organizations');
				}

				const response = await apiClient.get(`/api/candidate-educations`, {
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
				logger.error('Error fetching candidate education:', sanitizeForLogging(error));
				throw new Error('Failed to fetch candidate education: ' + sanitizeErrorMessage(error));
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
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot add education to candidates from other organizations');
				}

				const educationData = {
					...education,
					candidateId,
					...(education.completionDate && { completionDate: new Date(education.completionDate) })
				};

				const response = await apiClient.post('/api/candidate-educations', educationData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding candidate education:', sanitizeForLogging(error));
				throw new Error('Failed to add candidate education: ' + sanitizeErrorMessage(error));
			}
		}
	);
};

// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { CandidateStatusEnum } from '../input-schemas';
import {
	buildListQuery,
	containsAnyText,
	ListQueryOptions,
	notOfferedByApi,
	pageOfKept,
	personTexts,
	PersonUser,
	resolveOrganizationScope,
	validateOrganizationContext,
	withRelation
} from './utils';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
import { TOOL_HINTS } from './tool-hints';
const logger = new Logger('CandidateTools');

/**
 * Query of a candidate's skills, experience or education: their list routes require `where`. The tools have no paging,
 * so no `take` is sent and every record is answered.
 */
const candidateRecordsQuery = (defaultParams: { tenantId?: string; organizationId?: string }, candidateId: string) => ({
	where: buildListQuery(defaultParams, { candidateId }).where
});

/** The filters of a candidate list the route does not apply. */
interface CandidateSearch {
	search?: string;
	rating?: number;
}

/**
 * A page of candidates. The route has no search and matches a rating only exactly: a search of the name or email, and a
 * minimum rating, are kept here, on the whole list.
 */
const readCandidates = (
	defaultParams: { tenantId?: string; organizationId?: string },
	where: Record<string, unknown>,
	{ search, rating }: CandidateSearch,
	{ page, limit, relations }: Pick<ListQueryOptions, 'page' | 'limit' | 'relations'>
) => {
	const keepsHere = Boolean(search) || rating !== undefined;
	if (!keepsHere) {
		return apiClient.get('/api/candidate', {
			params: buildListQuery(defaultParams, where, { page, limit, relations })
		});
	}

	const isKept = (candidate: { rating?: number; user?: PersonUser }) => {
		const ratedEnough = rating === undefined || (candidate.rating ?? 0) >= rating;
		return ratedEnough && containsAnyText(search, ...personTexts(candidate));
	};
	const readRelations = withRelation(relations, 'user');
	const pageQuery = (pageNumber: number, take: number) =>
		buildListQuery(defaultParams, where, { page: pageNumber, limit: take, relations: readRelations });
	return pageOfKept('/api/candidate', pageQuery, isKept, page, limit);
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

/**
 * The last segment of `PUT /candidate/:id/:status` for each status the API sets: it hires or rejects a candidate,
 * and answers any other segment with an empty body, changing nothing.
 */
const CANDIDATE_STATUS_SEGMENTS: Record<string, string> = { HIRED: 'hired', REJECTED: 'rejected' };

export const registerCandidateTools = (server: McpServer) => {
	// Get candidates tool
	registerTool(
		server,
		'get_candidates',
		"Get list of candidates for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for candidate name or email'),
			relations: z
				.array(z.string())
				.optional()
				.describe(
					'Relations to include (e.g., ["user", "contact", "organizationPosition", "skills", "experience"])'
				),
			status: CandidateStatusEnum.optional().describe('Filter by candidate status'),
			organizationPositionId: z.string().uuid().optional().describe('Filter by organization position ID'),
			sourceId: z.string().uuid().optional().describe('Filter by candidate source ID'),
			rating: z.number().min(0).max(5).optional().describe('Filter by minimum rating')
		},
		async ({ page = 1, limit = 10, search, relations, status, organizationPositionId, sourceId, rating }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const where = { status, organizationPositionId, sourceId };
				const kept = { search, rating };

				const response = await readCandidates(defaultParams, where, kept, { page, limit, relations });

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
		},
		TOOL_HINTS.readOnly
	);

	// Get candidate count tool
	registerTool(
		server,
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
		},
		TOOL_HINTS.readOnly
	);

	// Get candidate by ID tool
	registerTool(
		server,
		'get_candidate',
		'Get a specific candidate by ID',
		{
			id: z.string().uuid().describe('The candidate ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe(
					'Relations to include (e.g., ["user", "contact", "skills", "experience", "education", "documents"])'
				)
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
		},
		TOOL_HINTS.readOnly
	);

	// Create candidate tool
	registerTool(
		server,
		'create_candidate',
		"Create a new candidate in the authenticated user's organization",
		{
			candidate_data: z.object({ userId: z.string().describe('The userId (required)') }).passthrough()
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
		},
		TOOL_HINTS.write
	);

	// Update candidate tool
	registerTool(
		server,
		'update_candidate',
		'Update an existing candidate',
		{
			id: z.string().uuid().describe('The candidate ID'),
			candidate_data: z.record(z.string(), z.any()).describe('The data for updating the candidate')
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
		},
		TOOL_HINTS.destructive
	);

	// Update candidate status tool
	registerTool(
		server,
		'update_candidate_status',
		'Hire or reject a candidate: HIRED makes the candidate an employee, REJECTED emails them a rejection. ' +
			'The API sets no other status.',
		{
			id: z.string().uuid().describe('The candidate ID'),
			status: CandidateStatusEnum.describe('The new status for the candidate: HIRED or REJECTED')
		},
		async ({ id, status }) => {
			try {
				const statusSegment = CANDIDATE_STATUS_SEGMENTS[status];
				if (!statusSegment) {
					throw notOfferedByApi(`setting a candidate's status to ${status}`);
				}
				const scope = resolveOrganizationScope();

				// Verify candidate ownership. The guard reads the tenant from the query, and the read route requires a
				// `where`, which also keeps the read in the organization.
				const existing = await apiClient.get(`/api/candidate/${id}`, { params: { ...scope, where: scope } });
				if ((existing as { organizationId: string }).organizationId !== scope.organizationId) {
					throw new Error('Unauthorized: Cannot update status of candidates from other organizations');
				}

				// The route takes no body: the scope is there for its guard, which reads the tenant from the body
				const response = await apiClient.put<{ status?: string }>(
					`/api/candidate/${id}/${statusSegment}`,
					scope
				);
				if (response?.status !== status) {
					throw new Error(`The API left the candidate's status unchanged instead of setting ${status}.`);
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
				logger.error('Error updating candidate status:', sanitizeForLogging(error));
				throw new Error('Failed to update candidate status: ' + sanitizeErrorMessage(error));
			}
		},
		TOOL_HINTS.openWorldDestructive
	);

	// Rate candidate tool
	registerTool(
		server,
		'rate_candidate',
		'Rate a candidate',
		{
			id: z.string().uuid().describe('The candidate ID'),
			rating: z.number().min(0).max(5).describe('The rating (0-5)')
		},
		async () => {
			try {
				throw notOfferedByApi('rating a candidate');
			} catch (error) {
				logger.error('Error rating candidate:', sanitizeForLogging(error));
				throw new Error('Failed to rate candidate: ' + sanitizeErrorMessage(error));
			}
		},
		TOOL_HINTS.destructive
	);

	// Delete candidate tool
	registerTool(
		server,
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
							text: JSON.stringify(
								{ success: true, message: 'Candidate deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting candidate:', sanitizeForLogging(error));
				throw new Error('Failed to delete candidate: ' + sanitizeErrorMessage(error));
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Get candidates by position tool
	registerTool(
		server,
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

				const where = { organizationPositionId: positionId, status };
				const params = buildListQuery(defaultParams, where, { page, limit, relations });

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
		},
		TOOL_HINTS.readOnly
	);

	// Get candidate skills tool
	registerTool(
		server,
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
					params: candidateRecordsQuery(defaultParams, candidateId)
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
		},
		TOOL_HINTS.readOnly
	);

	// Add candidate skill tool
	registerTool(
		server,
		'add_candidate_skill',
		'Add a skill to a candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID'),
			skill: z
				.object({
					name: z.string().describe('Skill name'),
					proficiency: z
						.string()
						.optional()
						.describe('Proficiency level (e.g., "Beginner", "Intermediate", "Advanced", "Expert")')
				})
				.describe('The skill to add')
		},
		async ({ candidateId, skill }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot add skills to candidates from other organizations');
				}

				// The skill list reads the organization: a skill created without one would not be listed
				const response = await apiClient.post('/api/candidate-skills', {
					candidateId,
					...skill,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
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
		},
		TOOL_HINTS.write
	);

	// Get candidate experience tool
	registerTool(
		server,
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
					params: candidateRecordsQuery(defaultParams, candidateId)
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
		},
		TOOL_HINTS.readOnly
	);

	// Add candidate experience tool
	registerTool(
		server,
		'add_candidate_experience',
		'Add work experience to a candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID'),
			experience: z
				.object({
					occupation: z.string().describe('Job title/occupation'),
					organization: z.string().describe('Company/organization name'),
					duration: z.string().describe('Duration of employment (e.g., "2 years", "Jan 2020 - Dec 2022")'),
					description: z.string().optional().describe('Description of responsibilities and achievements')
				})
				.describe('The experience to add')
		},
		async ({ candidateId, experience }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot add experience to candidates from other organizations');
				}

				// The experience list reads the organization: a row created without one would not be listed
				const response = await apiClient.post('/api/candidate-experience', {
					candidateId,
					...experience,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
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
		},
		TOOL_HINTS.write
	);

	// Get candidate education tool
	registerTool(
		server,
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
					params: candidateRecordsQuery(defaultParams, candidateId)
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
		},
		TOOL_HINTS.readOnly
	);

	// Add candidate education tool
	registerTool(
		server,
		'add_candidate_education',
		'Add education to a candidate',
		{
			candidateId: z.string().uuid().describe('The candidate ID'),
			education: z
				.object({
					schoolName: z.string().describe('School/university name'),
					degree: z.string().describe('Degree obtained'),
					field: z.string().describe('Field of study'),
					completionDate: z.string().optional().describe('Completion date (ISO format)'),
					notes: z.string().optional().describe('Additional notes about the education')
				})
				.describe('The education to add')
		},
		async ({ candidateId, education }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify candidate ownership
				const candidate = await apiClient.get(`/api/candidate/${candidateId}`);
				if ((candidate as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot add education to candidates from other organizations');
				}

				// The education list reads the organization: a row created without one would not be listed
				const educationData = {
					...education,
					candidateId,
					...(education.completionDate && { completionDate: new Date(education.completionDate) }),
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
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
		},
		TOOL_HINTS.write
	);
};

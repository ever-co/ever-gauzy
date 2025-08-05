import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { PipelineSchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('PipelineTools');


export const registerPipelineTools = (server: McpServer) => {
	// Get pipelines tool
	server.tool(
		'get_pipelines',
		"Get list of pipelines for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for pipeline name or description'),
			relations: z.array(z.string()).optional().describe('Relations to include')
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

				const response = await apiClient.get('/api/pipelines', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching pipelines:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch pipelines: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get pipeline by ID tool
	server.tool(
		'get_pipeline',
		'Get a specific pipeline by ID',
		{
			id: z.string().uuid().describe('The pipeline ID'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/pipelines/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch pipeline: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create pipeline tool
	server.tool(
		'create_pipeline',
		"Create a new pipeline in the authenticated user's organization",
		{
			pipeline_data: PipelineSchema.partial()
				.required({
					name: true
				})
				.describe('The data for creating the pipeline')
		},
		async ({ pipeline_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...pipeline_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/pipelines', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to create pipeline: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update pipeline tool
	server.tool(
		'update_pipeline',
		'Update an existing pipeline',
		{
			id: z.string().uuid().describe('The pipeline ID'),
			pipeline_data: PipelineSchema.partial().describe('The data for updating the pipeline')
		},
		async ({ id, pipeline_data }) => {
			try {
				const response = await apiClient.put(`/api/pipelines/${id}`, pipeline_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to update pipeline: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete pipeline tool
	server.tool(
		'delete_pipeline',
		'Delete a pipeline',
		{
			id: z.string().uuid().describe('The pipeline ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/pipelines/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Pipeline deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to delete pipeline: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Add stage to pipeline tool
	server.tool(
		'add_pipeline_stage',
		'Add a stage to a pipeline',
		{
			pipelineId: z.string().uuid().describe('The pipeline ID'),
			stage_data: z.object({
				name: z.string().describe('Stage name'),
				probability: z.number().min(0).max(100).optional().describe('Win probability percentage'),
				description: z.string().optional().describe('Stage description')
			}).describe('The stage data')
		},
		async ({ pipelineId, stage_data }) => {
			try {
				const response = await apiClient.post(`/api/pipelines/${pipelineId}/stages`, stage_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding pipeline stage:', sanitizeForLogging(error));
				throw new Error(`Failed to add pipeline stage: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update pipeline stage tool
	server.tool(
		'update_pipeline_stage',
		'Update a pipeline stage',
		{
			pipelineId: z.string().uuid().describe('The pipeline ID'),
			stageId: z.string().uuid().describe('The stage ID'),
			stage_data: z.object({
				name: z.string().optional().describe('Stage name'),
				probability: z.number().min(0).max(100).optional().describe('Win probability percentage'),
				description: z.string().optional().describe('Stage description')
			}).describe('The stage data to update')
		},
		async ({ pipelineId, stageId, stage_data }) => {
			try {
				const response = await apiClient.put(`/api/pipelines/${pipelineId}/stages/${stageId}`, stage_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating pipeline stage:', sanitizeForLogging(error));
				throw new Error(`Failed to update pipeline stage: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Remove stage from pipeline tool
	server.tool(
		'remove_pipeline_stage',
		'Remove a stage from a pipeline',
		{
			pipelineId: z.string().uuid().describe('The pipeline ID'),
			stageId: z.string().uuid().describe('The stage ID')
		},
		async ({ pipelineId, stageId }) => {
			try {
				await apiClient.delete(`/api/pipelines/${pipelineId}/stages/${stageId}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Pipeline stage removed successfully', pipelineId, stageId }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error removing pipeline stage:', sanitizeForLogging(error));
				throw new Error(`Failed to remove pipeline stage: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};
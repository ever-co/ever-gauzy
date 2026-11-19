// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { PipelineInputSchema } from '../input-schemas';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/error-utils';

import { registerTool, registerNoArgsTool } from './tool-helper';
import { TOOL_HINTS } from './tool-hints';
import { notOfferedByApi, resolveOrganizationScope } from './utils';
const logger = new Logger('PipelineTools');

/** A pipeline stage as the pipeline update writes it back. */
interface PipelineStageInput {
	id?: string;
	name: string;
	description?: string;
}

interface PipelineWithStages {
	name: string;
	organizationId?: string;
	stages?: Array<PipelineStageInput & { index?: number }>;
}

/**
 * Writes the stages of a pipeline through `PUT /pipelines/:id`, the only route that changes them. It replaces the
 * whole list: a stage the body leaves out is removed, and the deals in it with it. So the stages are read first, in
 * their order, `change` returns the list to write back, and a pipeline read without its stages is never written. The
 * update DTO requires the organization: the pipeline's own is sent back, so the update never moves it to another.
 */
const replacePipelineStages = async (
	pipelineId: string,
	change: (stages: PipelineStageInput[]) => PipelineStageInput[]
) => {
	const scope = resolveOrganizationScope();
	const pipeline = await apiClient.get<PipelineWithStages>(`/api/pipelines/${pipelineId}`, {
		params: { ...scope, relations: ['stages'] }
	});
	if (!Array.isArray(pipeline?.stages)) {
		throw new Error(`Pipeline ${pipelineId} was read without its stages, so none was written.`);
	}

	const ordered = [...pipeline.stages].sort((first, second) => (first.index ?? 0) - (second.index ?? 0));
	const current = ordered.map(({ id, name, description }) => ({ id, name, description }));
	return apiClient.put(`/api/pipelines/${pipelineId}`, {
		name: pipeline.name,
		organizationId: pipeline.organizationId ?? scope.organizationId,
		tenantId: scope.tenantId,
		stages: change(current)
	});
};

/** The position of the stage in the pipeline's stages; refuses a stage the pipeline does not have. */
const indexOfStage = (stages: PipelineStageInput[], stageId: string, pipelineId: string): number => {
	const index = stages.findIndex((stage) => stage.id === stageId);
	if (index < 0) {
		throw new Error(`Stage ${stageId} is not a stage of pipeline ${pipelineId}.`);
	}
	return index;
};

/** Refuses a win probability on a stage: the API keeps one on each deal, none on its stage. */
const refuseStageProbability = (probability?: number) => {
	if (probability !== undefined) {
		throw notOfferedByApi('a win probability on pipeline stages', 'A deal carries its own: update_deal sets it.');
	}
};

export const registerPipelineTools = (server: McpServer) => {
	// Get pipelines tool
	registerTool(
		server,
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
		},
		TOOL_HINTS.readOnly
	);

	// Get pipeline by ID tool
	registerTool(
		server,
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
		},
		TOOL_HINTS.readOnly
	);

	// Create pipeline tool
	registerTool(
		server,
		'create_pipeline',
		"Create a new pipeline in the authenticated user's organization",
		{
			pipeline_data: z.object({ name: z.string().describe('The name (required)') }).passthrough()
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
		},
		TOOL_HINTS.write
	);

	// Update pipeline tool
	registerTool(
		server,
		'update_pipeline',
		'Update an existing pipeline',
		{
			id: z.string().uuid().describe('The pipeline ID'),
			pipeline_data: z.record(z.string(), z.any()).describe('The data for updating the pipeline')
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
		},
		TOOL_HINTS.destructive
	);

	// Delete pipeline tool
	registerTool(
		server,
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
							text: JSON.stringify(
								{ success: true, message: 'Pipeline deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting pipeline:', sanitizeForLogging(error));
				throw new Error(`Failed to delete pipeline: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);

	// Add stage to pipeline tool
	registerTool(
		server,
		'add_pipeline_stage',
		'Add a stage at the end of a pipeline',
		{
			pipelineId: z.string().uuid().describe('The pipeline ID'),
			stage_data: z
				.object({
					name: z.string().describe('Stage name'),
					probability: z
						.number()
						.min(0)
						.max(100)
						.optional()
						.describe('Not offered: a win probability belongs to each deal'),
					description: z.string().optional().describe('Stage description')
				})
				.describe('The stage data')
		},
		async ({ pipelineId, stage_data }) => {
			try {
				const { probability, ...stage } = stage_data;
				refuseStageProbability(probability);

				const response = await replacePipelineStages(pipelineId, (stages) => [...stages, stage]);

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
		},
		TOOL_HINTS.destructive
	);

	// Update pipeline stage tool
	registerTool(
		server,
		'update_pipeline_stage',
		'Update a pipeline stage',
		{
			pipelineId: z.string().uuid().describe('The pipeline ID'),
			stageId: z.string().uuid().describe('The stage ID'),
			stage_data: z
				.object({
					name: z.string().optional().describe('Stage name'),
					probability: z
						.number()
						.min(0)
						.max(100)
						.optional()
						.describe('Not offered: a win probability belongs to each deal'),
					description: z.string().optional().describe('Stage description')
				})
				.describe('The stage data to update')
		},
		async ({ pipelineId, stageId, stage_data }) => {
			try {
				const { probability, ...changes } = stage_data;
				refuseStageProbability(probability);

				const response = await replacePipelineStages(pipelineId, (stages) => {
					const index = indexOfStage(stages, stageId, pipelineId);
					const updated = [...stages];
					updated[index] = { ...stages[index], ...changes };
					return updated;
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
				logger.error('Error updating pipeline stage:', sanitizeForLogging(error));
				throw new Error(`Failed to update pipeline stage: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.destructive
	);

	// Remove stage from pipeline tool
	registerTool(
		server,
		'remove_pipeline_stage',
		'Remove a stage from a pipeline: the deals in that stage are deleted with it',
		{
			pipelineId: z.string().uuid().describe('The pipeline ID'),
			stageId: z.string().uuid().describe('The stage ID')
		},
		async ({ pipelineId, stageId }) => {
			try {
				await replacePipelineStages(pipelineId, (stages) => {
					const index = indexOfStage(stages, stageId, pipelineId);
					return stages.filter((_stage, position) => position !== index);
				});

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Pipeline stage removed successfully', pipelineId, stageId },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error removing pipeline stage:', sanitizeForLogging(error));
				throw new Error(`Failed to remove pipeline stage: ${sanitizeErrorMessage(error)}`);
			}
		},
		TOOL_HINTS.idempotentDestructive
	);
};

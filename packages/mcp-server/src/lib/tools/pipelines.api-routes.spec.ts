/**
 * The pipeline stage tools called `/pipelines/:id/stages` routes that no controller declares. The API changes the
 * stages of a pipeline through its update, which replaces the whole list and removes a stage left out with the deals
 * in it: the tools now read the stages, in their order, and write back the list with the one change asked, and write
 * nothing when the read carries no stages or names no such stage.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerPipelineTools } from './pipelines';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const PIPELINE = '00000000-0000-4000-8000-000000000111';
const LEAD_STAGE = '00000000-0000-4000-8000-000000000112';
const WON_STAGE = '00000000-0000-4000-8000-000000000113';
const MISSING_STAGE = '00000000-0000-4000-8000-000000000114';
/** The pipeline's own organization, which the update sends back whatever the signed-in one. */
const PIPELINE_ORGANIZATION = '00000000-0000-4000-8000-000000000012';
const WRITTEN_SCOPE = { name: 'Sales', organizationId: PIPELINE_ORGANIZATION, tenantId: TENANT };

/** The pipeline as the API reads it, stages out of order and with columns the update does not take. */
const STORED_PIPELINE = {
	id: PIPELINE,
	name: 'Sales',
	organizationId: PIPELINE_ORGANIZATION,
	stages: [
		{ id: WON_STAGE, name: 'Won', description: null, index: 2, pipelineId: PIPELINE, tenantId: TENANT },
		{ id: LEAD_STAGE, name: 'Lead', description: 'New', index: 1, pipelineId: PIPELINE, tenantId: TENANT }
	]
};
const LEAD = { id: LEAD_STAGE, name: 'Lead', description: 'New' };
const WON = { id: WON_STAGE, name: 'Won', description: null };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls a pipeline tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerPipelineTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('pipeline stage tools: the routes they call', () => {
	let get: jest.SpyInstance;
	let put: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ organizationId: ORGANIZATION, tenantId: TENANT });
		get = jest.spyOn(apiClient, 'get').mockResolvedValue(STORED_PIPELINE as never);
		put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: PIPELINE } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads the stages of the pipeline before writing them, in the scope the guard reads', async () => {
		await call('add_pipeline_stage', { pipelineId: PIPELINE, stage_data: { name: 'Proposal' } });

		expect(get).toHaveBeenCalledWith(`/api/pipelines/${PIPELINE}`, {
			params: { organizationId: ORGANIZATION, tenantId: TENANT, relations: ['stages'] }
		});
	});

	it("adds a stage at the end, keeping the others in their order and the pipeline's own organization", async () => {
		await call('add_pipeline_stage', {
			pipelineId: PIPELINE,
			stage_data: { name: 'Proposal', description: 'Quote sent' }
		});

		expect(put).toHaveBeenCalledWith(`/api/pipelines/${PIPELINE}`, {
			...WRITTEN_SCOPE,
			stages: [LEAD, WON, { name: 'Proposal', description: 'Quote sent' }]
		});
	});

	it('updates the one stage named, keeping the others', async () => {
		await call('update_pipeline_stage', {
			pipelineId: PIPELINE,
			stageId: WON_STAGE,
			stage_data: { name: 'Closed won' }
		});

		expect(put).toHaveBeenCalledWith(`/api/pipelines/${PIPELINE}`, {
			...WRITTEN_SCOPE,
			stages: [LEAD, { ...WON, name: 'Closed won' }]
		});
	});

	it('removes the one stage named, keeping the others', async () => {
		await call('remove_pipeline_stage', { pipelineId: PIPELINE, stageId: LEAD_STAGE });

		expect(put).toHaveBeenCalledWith(`/api/pipelines/${PIPELINE}`, { ...WRITTEN_SCOPE, stages: [WON] });
	});

	it.each([
		['update_pipeline_stage', { pipelineId: PIPELINE, stageId: MISSING_STAGE, stage_data: { name: 'Gone' } }],
		['remove_pipeline_stage', { pipelineId: PIPELINE, stageId: MISSING_STAGE }]
	])('%s writes nothing for a stage the pipeline does not have', async (name, args) => {
		await expect(call(name, args)).rejects.toThrow(
			`Stage ${MISSING_STAGE} is not a stage of pipeline ${PIPELINE}.`
		);
		expect(put).not.toHaveBeenCalled();
	});

	it('writes nothing when the pipeline is read without its stages, which would remove them all', async () => {
		get.mockResolvedValue({ id: PIPELINE, name: 'Sales' } as never);

		await expect(
			call('add_pipeline_stage', { pipelineId: PIPELINE, stage_data: { name: 'Proposal' } })
		).rejects.toThrow('was read without its stages, so none was written');
		expect(put).not.toHaveBeenCalled();
	});

	it.each(['add_pipeline_stage', 'update_pipeline_stage'])(
		'%s refuses a win probability, without any request',
		async (name) => {
			const args = { pipelineId: PIPELINE, stageId: WON_STAGE, stage_data: { name: 'Won', probability: 90 } };

			await expect(call(name, args)).rejects.toThrow(
				'This server does not offer a win probability on pipeline stages'
			);
			expect(get).not.toHaveBeenCalled();
			expect(put).not.toHaveBeenCalled();
		}
	);
});

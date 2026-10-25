/**
 * Job status of an async SIM run. simstudio-ts-sdk 0.2 queues async runs on the v2 API, whose status
 * is read per workflow (`getWorkflowRun(workflowId, runId)`); the legacy `getJobStatus(taskId)` reads
 * `/api/jobs/:id`. The service finds the run's workflow in this tenant's execution log, asks the v2 API,
 * and keeps the legacy endpoint for ids it did not log and for jobs the v2 API does not know.
 */
jest.mock('@gauzy/core', () => ({
	IntegrationService: class {},
	IntegrationTenantService: class {},
	RequestContext: { currentTenantId: () => 'tenant-1' }
}));
jest.mock('@gauzy/config', () => ({ ConfigService: class {} }));
// The ORM layer (entity + repositories) is not under test and needs the real @gauzy/core.
jest.mock('./sim-repository.service', () => ({ SimRepositoryService: class {} }));
jest.mock('./sim-workflow-execution.entity', () => ({ SimWorkflowExecution: class {} }));
jest.mock('./sim-client.factory', () => ({ SimClientFactory: class {} }));

import { NotFoundException } from '@nestjs/common';
import { SimService } from './sim.service';

describe('SimService.getJobStatus', () => {
	function setUp(executionLookup: () => Promise<any>) {
		const client = {
			getWorkflowRun: jest.fn(async (workflowId: string, runId: string) => ({
				runId,
				workflowId,
				status: 'running'
			})),
			getJobStatus: jest.fn(async (taskId: string) => ({ taskId, status: 'queued' }))
		};
		const integrationTenantService = { findOneByOptions: jest.fn(async () => ({ id: 'integration-tenant-1' })) };
		const simClientFactory = { getClient: jest.fn(async () => client) };
		const simRepositoryService = { findOneByOptions: jest.fn(executionLookup) };
		const service = new SimService(
			{} as any,
			{} as any,
			integrationTenantService as any,
			simClientFactory as any,
			simRepositoryService as any
		);
		return { service, client, simRepositoryService };
	}

	it('reads a run this tenant logged from the v2 API, with its workflow', async () => {
		const { service, client, simRepositoryService } = setUp(async () => ({
			workflowId: 'wf-1',
			executionId: 'run-123'
		}));

		const status = await service.getJobStatus('run-123');

		expect(simRepositoryService.findOneByOptions).toHaveBeenCalledWith({ where: { executionId: 'run-123' } });
		expect(client.getWorkflowRun).toHaveBeenCalledWith('wf-1', 'run-123', { includeOutput: true });
		expect(client.getJobStatus).not.toHaveBeenCalled();
		expect(status).toEqual({ runId: 'run-123', workflowId: 'wf-1', status: 'running' });
	});

	it('uses the legacy job status for an id the tenant never logged', async () => {
		const { service, client } = setUp(async () => {
			throw new NotFoundException();
		});

		await expect(service.getJobStatus('task-9')).resolves.toEqual({ taskId: 'task-9', status: 'queued' });
		expect(client.getWorkflowRun).not.toHaveBeenCalled();
	});

	it('falls back to the legacy job status when the v2 API does not know the id (a pre-upgrade job)', async () => {
		const { service, client } = setUp(async () => ({ workflowId: 'wf-1', executionId: 'task-9' }));
		client.getWorkflowRun.mockRejectedValueOnce(simError('Workflow run not found', 'NOT_FOUND', 404));

		await expect(service.getJobStatus('task-9')).resolves.toEqual({ taskId: 'task-9', status: 'queued' });
		expect(client.getJobStatus).toHaveBeenCalledWith('task-9');
	});

	// Review (Greptile): a v2 run does not exist on the legacy API, so falling back on any v2 failure replaced a
	// timeout or a server error with the legacy "job not found". Only a not-found answer moves on.
	it.each([
		['a server error', simError('HTTP 500: Internal Server Error', undefined, 500)],
		['a timeout / network failure (no HTTP status)', simError('fetch failed: ETIMEDOUT', 'STATUS_ERROR')],
		['an auth failure', simError('Invalid API key', 'UNAUTHORIZED', 401)],
		['a rate limit', simError('Too many requests', 'RATE_LIMIT_EXCEEDED', 429)]
	])('surfaces %s from the v2 lookup instead of asking the legacy API', async (_case, error) => {
		const { service, client } = setUp(async () => ({ workflowId: 'wf-1', executionId: 'run-123' }));
		client.getWorkflowRun.mockRejectedValueOnce(error);

		await expect(service.getJobStatus('run-123')).rejects.toBe(error);
		expect(client.getJobStatus).not.toHaveBeenCalled();
	});
});

/** The shape the SDK rejects with: `SimStudioError(message, code, status)`. */
function simError(message: string, code?: string, status?: number): Error {
	return Object.assign(new Error(message), { name: 'SimStudioError', code, status });
}

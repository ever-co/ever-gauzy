import { isSimAsyncRun, mapSimExecutionResult, simAsyncRunId } from './sim-execution-result';

/**
 * simstudio-ts-sdk 0.1 -> 0.2 (2026-10 dependency upgrade): async runs now go to the v2 API and answer
 * `{ success, async: true, runId, statusUrl, message }` instead of `{ success, taskId, status: 'queued' }`.
 * The mapping only knew `taskId`, so on 0.2 every async run (every event-triggered workflow, and "run
 * asynchronously" from the UI) was logged `completed`, with no executionId to look its status up by.
 */
describe('mapSimExecutionResult', () => {
	const blank = () => ({ status: 'processing', output: undefined, executionId: undefined, duration: undefined, error: undefined });

	it('logs a v2 async run (simstudio-ts-sdk 0.2) as queued, with its runId as the executionId', () => {
		const result = {
			success: true,
			async: true as const,
			runId: 'run-123',
			statusUrl: 'https://sim.example/api/v2/workflows/wf-1/runs/run-123',
			message: 'Execution queued'
		};
		const execution = blank();

		mapSimExecutionResult(execution, result);

		expect(execution.status).toBe('queued');
		expect(execution.executionId).toBe('run-123');
		expect(execution.output).toBe(result);
		expect(execution.error).toBeUndefined();
	});

	it('still logs a legacy async job (simstudio-ts-sdk 0.1) as queued, with its taskId', () => {
		const execution = blank();

		mapSimExecutionResult(execution, {
			success: true,
			taskId: 'task-9',
			status: 'queued',
			createdAt: '2026-10-01T00:00:00Z',
			links: { status: '/api/jobs/task-9' }
		});

		expect(execution.status).toBe('queued');
		expect(execution.executionId).toBe('task-9');
	});

	it('logs a finished run as completed or failed, with its metadata', () => {
		const done = blank();
		mapSimExecutionResult(done, { success: true, output: { ok: 1 }, metadata: { executionId: 'exec-1', duration: 42 } });
		expect(done).toEqual(expect.objectContaining({ status: 'completed', output: { ok: 1 }, executionId: 'exec-1', duration: 42 }));

		const failed = blank();
		mapSimExecutionResult(failed, { success: false, error: 'boom', executionId: 'exec-2' });
		expect(failed).toEqual(expect.objectContaining({ status: 'failed', executionId: 'exec-2', error: { message: 'boom' } }));
	});

	it('tells async runs from finished ones and reads either id', () => {
		expect(isSimAsyncRun({ success: true, async: true })).toBe(true);
		expect(isSimAsyncRun({ success: true, output: {} })).toBe(false);
		expect(simAsyncRunId({ success: true, runId: 'r', taskId: 't' })).toBe('r');
		expect(simAsyncRunId(null)).toBeUndefined();
	});
});

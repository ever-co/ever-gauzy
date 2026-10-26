import type { AsyncExecutionResult, WorkflowExecutionResult } from 'simstudio-ts-sdk';
import type { SimWorkflowExecution } from './sim-workflow-execution.entity';

/** What a SIM execute call answers: a finished run, or an accepted async run. */
export type SimExecutionResult = WorkflowExecutionResult | AsyncExecutionResult;

/**
 * The id an accepted async run answers with.
 *
 * simstudio-ts-sdk 0.2 (the v2 API, `/api/v2/workflows/:id/execute`) answers
 * `{ success, async: true, runId, statusUrl, message }`; 0.1 (the legacy API) answered
 * `{ success, taskId, status: 'queued', createdAt, links }`. Both are read, so executions logged
 * before the upgrade and after it map the same way.
 */
export function simAsyncRunId(result: SimExecutionResult | null | undefined): string | undefined {
	const asyncResult = (result ?? {}) as AsyncExecutionResult;
	return asyncResult.runId || asyncResult.taskId || undefined;
}

/** Whether `result` is an accepted async run (queued on SIM) rather than a finished one. */
export function isSimAsyncRun(result: SimExecutionResult | null | undefined): boolean {
	return (result as AsyncExecutionResult | undefined)?.async === true || !!simAsyncRunId(result);
}

/**
 * Maps a SIM execute result onto an execution log entry: status, output, executionId, duration, error.
 *
 * An async run is checked FIRST: its answer also carries `success: true`, which on 0.2 — where the
 * old `taskId` check found nothing — logged every async run (every event-triggered workflow, and
 * "Run asynchronously" from the UI) as `completed` with no executionId to look its status up by.
 */
export function mapSimExecutionResult(
	execution: Pick<SimWorkflowExecution, 'status' | 'output' | 'executionId' | 'duration' | 'error'>,
	result: SimExecutionResult
): void {
	const syncResult = result as WorkflowExecutionResult;
	const resultAny = result as unknown as Record<string, any>;
	const runId = simAsyncRunId(result);

	if (isSimAsyncRun(result)) {
		execution.status = 'queued';
	} else if (syncResult.success === true) {
		execution.status = 'completed';
	} else if (syncResult.success === false) {
		execution.status = 'failed';
	} else {
		execution.status = 'completed';
	}

	execution.output = syncResult.output ?? result;

	// executionId: the SDK's metadata, the root level (0.2 types it there; the API has returned it there),
	// or the async run's id (which the job status lookup takes).
	execution.executionId = syncResult.metadata?.executionId ?? resultAny['executionId'] ?? runId;

	// Duration: the SDK's metadata, totalDuration, or the root level.
	execution.duration = syncResult.metadata?.duration ?? syncResult.totalDuration ?? resultAny['duration'];

	execution.error = syncResult.error ? { message: syncResult.error } : undefined;
}

/**
 * Whether an error from the SIM SDK says the run does not exist: HTTP 404 (`SimStudioError.status`),
 * or a not-found error code without a status. Only then may a status lookup move on to another API;
 * timeouts and network failures (code `STATUS_ERROR`, no status), server errors, auth failures and
 * rate limits are real answers about a run that may well exist.
 */
export function isSimRunNotFound(error: unknown): boolean {
	const { status, code } = (error ?? {}) as { status?: unknown; code?: unknown };
	if (status === 404) {
		return true;
	}
	return status == null && typeof code === 'string' && /not[_-]?found/i.test(code);
}

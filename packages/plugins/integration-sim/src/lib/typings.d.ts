/**
 * Type declarations for simstudio-ts-sdk.
 *
 * The SDK ships ESM-only exports which are not resolved by TypeScript's
 * `moduleResolution: "node"` (Node10). This ambient module declaration
 * re-exports the types from the SDK's dist folder.
 *
 * MAINTAINER NOTE: These declarations must be kept in sync with the installed
 * version of simstudio-ts-sdk. When upgrading the SDK, verify these types
 * against `node_modules/simstudio-ts-sdk/dist/index.d.ts`. This file can be
 * removed once the project migrates to `moduleResolution: "node16"` or higher.
 *
 * Current SDK version: ^0.2.1 (the async result and run status shapes keep the
 * 0.1 fields optional: executions logged before the 0.2 upgrade carry them).
 */
declare module 'simstudio-ts-sdk' {
	export interface SimStudioConfig {
		apiKey: string;
		baseUrl?: string;
	}

	export interface WorkflowExecutionResult {
		success: boolean;
		executionId?: string;
		output?: any;
		error?: string;
		logs?: any[];
		metadata?: {
			duration?: number;
			executionId?: string;
			runId?: string;
			startTime?: string;
			endTime?: string;
			[key: string]: any;
		};
		traceSpans?: any[];
		totalDuration?: number;
	}

	export interface WorkflowStatus {
		isDeployed: boolean;
		deployedAt?: string;
		needsRedeployment: boolean;
	}

	export interface ExecutionOptions {
		timeout?: number;
		stream?: boolean;
		selectedOutputs?: string[];
		async?: boolean;
	}

	/** 0.2 (v2 API): `async`, `runId`, `statusUrl`, `message`. 0.1 (legacy API): `taskId`, `status`, `createdAt`, `links`. */
	export interface AsyncExecutionResult {
		success: boolean;
		async?: true;
		runId?: string;
		statusUrl?: string;
		message?: string;
		taskId?: string;
		status?: 'queued';
		createdAt?: string;
		links?: { status: string };
	}

	export interface WorkflowExecutionError {
		code: string;
		message: string;
		details?: unknown;
	}

	export interface WorkflowRunStatus {
		runId: string;
		workflowId: string;
		status: 'queued' | 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
		trigger: string | null;
		startedAt: string | null;
		endedAt: string | null;
		durationMs: number | null;
		paused: Record<string, unknown> | null;
		cost: { total: number } | null;
		error: WorkflowExecutionError | null;
		output: unknown | null;
		blockOutputs: Record<string, unknown> | null;
	}

	export interface GetWorkflowRunOptions {
		includeOutput?: boolean;
		selectedOutputs?: string[];
	}

	export interface RateLimitInfo {
		limit: number;
		remaining: number;
		reset: number;
		retryAfter?: number;
	}

	export interface RetryOptions {
		maxRetries?: number;
		initialDelay?: number;
		maxDelay?: number;
		backoffMultiplier?: number;
	}

	export interface UsageLimits {
		success: boolean;
		rateLimit: {
			sync: { isLimited: boolean; limit: number; remaining: number; resetAt: string };
			async: { isLimited: boolean; limit: number; remaining: number; resetAt: string };
			authType: string;
		};
		usage: {
			currentPeriodCost: number;
			limit: number;
			plan: string;
		};
	}

	export class SimStudioError extends Error {
		code?: string;
		status?: number;
		constructor(message: string, code?: string, status?: number);
	}

	export class SimStudioClient {
		constructor(config: SimStudioConfig);
		executeWorkflow(
			workflowId: string,
			input?: any,
			options?: ExecutionOptions
		): Promise<WorkflowExecutionResult | AsyncExecutionResult>;
		getWorkflowStatus(workflowId: string): Promise<WorkflowStatus>;
		executeWorkflowSync(
			workflowId: string,
			input?: any,
			options?: ExecutionOptions
		): Promise<WorkflowExecutionResult>;
		validateWorkflow(workflowId: string): Promise<boolean>;
		setApiKey(apiKey: string): void;
		setBaseUrl(baseUrl: string): void;
		/** Status of a job queued through the legacy async API. */
		getJobStatus(taskId: string): Promise<any>;
		/** Status (and optionally outputs) of a run queued through the v2 API. */
		getWorkflowRun(workflowId: string, runId: string, options?: GetWorkflowRunOptions): Promise<WorkflowRunStatus>;
		executeWithRetry(
			workflowId: string,
			input?: any,
			options?: ExecutionOptions,
			retryOptions?: RetryOptions
		): Promise<WorkflowExecutionResult | AsyncExecutionResult>;
		getRateLimitInfo(): RateLimitInfo | null;
		getUsageLimits(): Promise<UsageLimits>;
	}

	export { SimStudioClient as default };
}

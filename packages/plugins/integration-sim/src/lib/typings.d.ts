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
 * Current SDK version: ^0.1.2
 */
declare module 'simstudio-ts-sdk' {
	export interface SimStudioConfig {
		apiKey: string;
		baseUrl?: string;
	}

	export interface WorkflowExecutionResult {
		success: boolean;
		output?: any;
		error?: string;
		logs?: any[];
		metadata?: {
			duration?: number;
			executionId?: string;
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

	export interface AsyncExecutionResult {
		success: boolean;
		taskId: string;
		status: 'queued';
		createdAt: string;
		links: { status: string };
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
		getJobStatus(taskId: string): Promise<any>;
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

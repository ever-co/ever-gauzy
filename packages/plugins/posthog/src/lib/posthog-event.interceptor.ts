import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor, Optional } from '@nestjs/common';
import { ContextType, HttpArgumentsHost, RpcArgumentsHost, WsArgumentsHost } from '@nestjs/common/interfaces';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'crypto';
import { PosthogEventInterceptorOptions } from './posthog.interfaces';
import { PosthogService } from './posthog.service';
import { SanitizerUtil } from './utils';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';

/**
 * Interceptor for capturing and tracking events through PostHog analytics.
 * Automatically tracks route access and performance metrics.
 * Sanitizes sensitive data before sending to PostHog.
 */
@Injectable()
export class PosthogEventInterceptor implements NestInterceptor {
	/**
	 * PostHog service instance for tracking events
	 */
	protected readonly client: PosthogService = PosthogService.PosthogServiceInstance();
	private readonly options?: PosthogEventInterceptorOptions;

	/**
	 * @param options - Configuration options for the interceptor
	 */
	constructor(@Optional() @Inject(POSTHOG_MODULE_OPTIONS) options?: PosthogEventInterceptorOptions) {
		this.options = options;
	}

	/**
	 * Intercepts requests and tracks events when they occur
	 *
	 * @param context - Execution context of the current request
	 * @param next - Call handler for the request pipeline
	 * @returns Observable of the response stream
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const startTime = Date.now();

		// Track the request start event
		this.captureRequestStart(context);

		return next.handle().pipe(
			tap(
				// Success handler
				(response) => {
					const duration = Date.now() - startTime;
					this.captureRequestComplete(context, response, duration);
				},
				// Error handler - note that errors are already handled by the PosthogErrorInterceptor
				// This is just to track that a request completed with an error
				(error) => {
					const duration = Date.now() - startTime;
					this.captureRequestError(context, error, duration);
				}
			)
		);
	}

	/**
	 * Routes event capture based on context type (HTTP, RPC, WebSocket)
	 *
	 * @param context - Execution context of the current request
	 * @param eventName - Name of the event to capture
	 * @param properties - Additional properties to include with the event
	 */
	protected captureEvent(context: ExecutionContext, eventName: string, properties: Record<string, any> = {}) {
		switch (context.getType<ContextType>()) {
			case 'http':
				return this.captureHttpEvent(context.switchToHttp(), eventName, properties);
			case 'rpc':
				return this.captureRpcEvent(context.switchToRpc(), eventName, properties);
			case 'ws':
				return this.captureWsEvent(context.switchToWs(), eventName, properties);
			default:
				console.warn(`Unknown context type encountered while capturing event ${eventName}`);
		}
	}
	/**
	 * Captures HTTP request events with comprehensive request context
	 *
	 * @param http - HTTP arguments host containing request data
	 * @param eventName - Name of the event to track
	 * @param additionalProperties - Additional event properties
	 */
	private captureHttpEvent(
		http: HttpArgumentsHost,
		eventName: string,
		additionalProperties: Record<string, any> = {}
	): void {
		const request = http.getRequest();
		const userId = this.extractUserId(request);

		// Skip tracking if this endpoint should be ignored
		if (this.shouldIgnoreEndpoint(request.method, request.originalUrl || request.url)) {
			return;
		}

		const eventProperties = {
			request_method: request.method,
			request_url: request.originalUrl || request.url,
			request_path: request.path,
			request_query: SanitizerUtil.sanitizeObject(request.query),
			user_agent: request.headers['user-agent'],
			referer: request.headers.referer || request.headers.referrer,
			ip_address: request.ip,
			user_id: request.user?.id || request.user?.userId,
			route: this.extractRouteFromRequest(request),
			...additionalProperties,
			$timestamp: new Date().toISOString()
		};

		// Track the event
		this.client.track(eventName, userId, eventProperties);
	}

	/**
	 * Captures RPC events with message context
	 *
	 * @param rpc - RPC arguments host
	 * @param eventName - Name of the event to track
	 * @param additionalProperties - Additional event properties
	 */
	private captureRpcEvent(
		rpc: RpcArgumentsHost,
		eventName: string,
		additionalProperties: Record<string, any> = {}
	): void {
		const ctx = rpc.getContext();
		const pattern = typeof ctx.getPattern === 'function' ? ctx.getPattern() : 'unknown-pattern';

		const clientId = this.extractRpcClientId(ctx) || 'system';

		const eventProperties = {
			rpc_pattern: pattern,
			rpc_context: SanitizerUtil.sanitizeObject(ctx),
			...additionalProperties,
			$timestamp: new Date().toISOString()
		};

		this.client.track(eventName, clientId, eventProperties);
	}

	/**
	 * Captures WebSocket events with client context
	 *
	 * @param ws - WebSocket arguments host
	 * @param eventName - Name of the event to track
	 * @param additionalProperties - Additional event properties
	 */
	private captureWsEvent(
		ws: WsArgumentsHost,
		eventName: string,
		additionalProperties: Record<string, any> = {}
	): void {
		const client = ws.getClient();
		const data = ws.getData();
		const eventType = typeof data === 'object' && data.event ? data.event : 'unknown-event';

		const clientId = client.id || this.extractWsClientId(client) || 'websocket-client';

		const eventProperties = {
			ws_event_type: eventType,
			ws_client_id: client.id,
			...additionalProperties,
			$timestamp: new Date().toISOString()
		};

		this.client.track(eventName, clientId, eventProperties);
	}

	/**
	 * Captures the start of a request processing pipeline
	 *
	 * @param context - Execution context of the current request
	 */
	protected captureRequestStart(context: ExecutionContext): void {
		this.captureEvent(context, 'request_started', {
			handler: this.getHandlerName(context),
			timestamp_start: Date.now()
		});
	}

	/**
	 * Captures the successful completion of a request
	 *
	 * @param context - Execution context of the current request
	 * @param response - The response being sent back
	 * @param duration - Duration of the request processing in milliseconds
	 */
	protected captureRequestComplete(context: ExecutionContext, response: any, duration: number): void {
		let statusCode = 200;
		let responseSize = 0;

		// Try to extract status code and response size based on context type
		if (context.getType() === 'http') {
			const httpResponse = context.switchToHttp().getResponse();
			statusCode = httpResponse.statusCode;

			// Estimate response size if possible
			if (response && typeof response === 'object') {
				try {
					responseSize = JSON.stringify(response).length;
				} catch (e) {
					// Ignore serialization errors
				}
			}
		}

		this.captureEvent(context, 'request_completed', {
			handler: this.getHandlerName(context),
			duration_ms: duration,
			status_code: statusCode,
			response_size_bytes: responseSize,
			timestamp_end: Date.now()
		});
	}

	/**
	 * Captures error events during request processing
	 * Note: This complements the PosthogErrorInterceptor by tracking timing metrics
	 *
	 * @param context - Execution context of the current request
	 * @param error - The error that occurred
	 * @param duration - Duration until the error occurred in milliseconds
	 */
	protected captureRequestError(context: ExecutionContext, error: any, duration: number): void {
		const statusCode = error?.getStatus?.() || 500;

		this.captureEvent(context, error?.name || 'request_error', {
			handler: this.getHandlerName(context),
			duration_ms: duration,
			error_type: error?.name || 'Unknown',
			status_code: statusCode,
			timestamp_error: Date.now()
		});
	}

	/**
	 * Extracts the handler name from the execution context
	 *
	 * @param context - Execution context
	 * @returns The name of the handler being executed
	 */
	private getHandlerName(context: ExecutionContext): string {
		const handler = context.getHandler();
		const controller = context.getClass();
		return `${controller.name}.${handler.name}`;
	}

	/**
	 * Extracts a route from an HTTP request
	 *
	 * @param request - HTTP request object
	 * @returns Route path with parameter placeholders
	 */
	private extractRouteFromRequest(request: any): string {
		// Try to access NestJS route information if available
		if (request.route?.path) {
			return request.route.path;
		}

		// Fallback to the raw URL
		return request.originalUrl || request.url;
	}

	/**
	 * Determines if an endpoint should be ignored for tracking
	 *
	 * @param method - HTTP method
	 * @param url - URL of the request
	 * @returns Boolean indicating if the endpoint should be ignored
	 */
	private shouldIgnoreEndpoint(method: string, url: string): boolean {
		// Skip tracking for health checks and other monitoring endpoints by default
		const defaultIgnoredPaths = ['/health', '/metrics', '/favicon.ico', '/ping'];

		// Use user-configured ignored paths if available
		const ignoredPaths = this.options?.ignoredPaths || defaultIgnoredPaths;

		return ignoredPaths.some((path: string) => url.startsWith(path));
	}

	/**
	 * Extracts a user ID from various possible locations in the request
	 *
	 * @param request - HTTP request object
	 * @returns User ID string or 'anonymous' if not found
	 */
	private extractUserId(request: any): string {
		// Generate a random ID if no user identifier is found
		const anonymousId = `anon-${crypto.randomUUID()}`;

		// Check common user ID locations
		return (
			request.user?.id ||
			request.user?.userId ||
			request.headers['x-user-id'] ||
			request.cookies?.userId ||
			request.ip ||
			anonymousId
		);
	}

	/**
	 * Extracts a client ID from RPC context
	 *
	 * @param ctx - RPC context
	 * @returns Client ID string or null if not found
	 */
	private extractRpcClientId(ctx: any): string | null {
		return ctx.clientId || (ctx.args && ctx.args[0] && ctx.args[0].user && ctx.args[0].user.id) || null;
	}

	/**
	 * Extracts a client ID from WebSocket client
	 *
	 * @param client - WebSocket client
	 * @returns Client ID string or null if not found
	 */
	private extractWsClientId(client: any): string | null {
		if (!client) return null;

		// Try to extract user ID from handshake data
		if (client.handshake?.query?.userId) {
			return client.handshake.query.userId;
		}

		// Try to extract from auth data
		if (client.handshake?.auth?.userId) {
			return client.handshake.auth.userId;
		}

		return null;
	}
}

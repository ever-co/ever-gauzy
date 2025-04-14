// Nestjs imports
import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { ContextType, HttpArgumentsHost, RpcArgumentsHost, WsArgumentsHost } from '@nestjs/common/interfaces';
// Rxjs imports
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { PosthogInterceptorOptions, PosthogInterceptorOptionsFilter } from './posthog.interfaces';
import { PosthogService } from './posthog.service';

/**
 * Interceptor for capturing and tracking exceptions through PostHog analytics.
 * Sanitizes sensitive data before sending to PostHog.
 */
@Injectable()
export class PosthogErrorInterceptor implements NestInterceptor {
	/**
	 * PostHog service instance for tracking events
	 */
	protected readonly client: PosthogService = PosthogService.PosthogServiceInstance();

	/**
	 * List of sensitive fields that should be redacted in request bodies
	 */
	private readonly sensitiveBodyFields = [
		'password',
		'passwordConfirm',
		'currentPassword',
		'newPassword',
		'token',
		'accessToken',
		'refreshToken',
		'secret',
		'credentials',
		'credit_card',
		'cardNumber',
		'cvv',
		'ssn',
		'socialSecurityNumber'
	];

	/**
	 * Creates a new PosthogErrorInterceptor
	 *
	 * @param options - Configuration options for the interceptor
	 */
	constructor(private readonly options?: PosthogInterceptorOptions) {}

	/**
	 * Intercepts requests and captures exceptions when they occur
	 *
	 * @param context - Execution context of the current request
	 * @param next - Call handler for the request pipeline
	 * @returns Observable of the response stream
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		return next.handle().pipe(
			tap(null, (exception: HttpException) => {
				if (this.shouldReport(exception)) {
					this.captureException(context, exception);
				}
			})
		);
	}

	/**
	 * Routes exception capture based on context type (HTTP, RPC, WebSocket)
	 *
	 * @param context - Execution context of the current request
	 * @param exception - The thrown exception to be captured
	 */
	protected captureException(context: ExecutionContext, exception: HttpException) {
		switch (context.getType<ContextType>()) {
			case 'http':
				return this.captureHttpException(context.switchToHttp(), exception);
			case 'rpc':
				return this.captureRpcException(context.switchToRpc(), exception);
			case 'ws':
				return this.captureWsException(context.switchToWs(), exception);
		}
	}

	/**
	 * Captures HTTP exceptions with comprehensive request context
	 *
	 * @param http - HTTP arguments host containing request data
	 * @param exception - The thrown HTTP exception
	 */
	private captureHttpException(http: HttpArgumentsHost, exception: HttpException): void {
		const request = http.getRequest();
		const response = http.getResponse();
		const userId = request.user?.id || request.user?.userId || request.ip || 'anonymous';

		// Create a data object with request details
		const data = {
			request: {
				method: request.method,
				url: request.originalUrl || request.url,
				headers: this.sanitizeHeaders(request.headers),
				query: this.sanitizeObject(request.query),
				body: this.sanitizeRequestBody(request.body),
				params: this.sanitizeObject(request.params)
			},
			user: {
				ip: request.ip,
				id: request.user?.id || request.user?.userId,
				email: request.user?.email ? '[REDACTED]' : undefined,
				roles: request.user?.roles
			},
			response: {
				status_code: exception instanceof HttpException ? exception.getStatus() : 500,
				headers: response?.getHeaders ? this.sanitizeHeaders(response.getHeaders()) : undefined
			},
			environment: {
				nodeEnv: process.env['NODE_ENV'],
				appVersion: process.env['APP_VERSION'],
				timestamp: new Date().toISOString()
			}
		};

		// Track the error with improved data structure
		this.client.captureException('http_error', userId, {
			error_message: exception.message,
			error_name: exception.name,
			stack: exception.stack,
			status_code: data.response.status_code,
			request_data: data.request,
			user_data: data.user,
			response_data: data.response,
			environment_data: data.environment,
			$timestamp: data.environment.timestamp
		});
	}

	/**
	 * Captures RPC exceptions with message context and improved data
	 *
	 * @param rpc - RPC arguments host
	 * @param exception - The thrown exception
	 */
	private captureRpcException(rpc: RpcArgumentsHost, exception: any): void {
		const data = rpc.getData();
		const ctx = rpc.getContext();

		this.client.captureException('rpc_error', 'system', {
			error_message: exception.message,
			error_name: exception.name,
			stack: exception.stack,
			rpc_data: this.sanitizeObject(data),
			rpc_context: this.sanitizeObject(ctx),
			environment: {
				nodeEnv: process.env['NODE_ENV'],
				appVersion: process.env['APP_VERSION']
			},
			$timestamp: new Date().toISOString()
		});
	}

	/**
	 * Captures WebSocket exceptions with client context and improved data
	 *
	 * @param ws - WebSocket arguments host
	 * @param exception - The thrown exception
	 */
	private captureWsException(ws: WsArgumentsHost, exception: any): void {
		const client = ws.getClient();
		const data = ws.getData();

		const clientId = client.id || 'websocket-client';

		this.client.captureException('ws_error', clientId, {
			error_message: exception.message,
			error_name: exception.name,
			stack: exception.stack,
			ws_client: {
				id: client.id,
				handshake: this.sanitizeObject(client.handshake)
			},
			ws_data: this.sanitizeObject(data),
			environment: {
				nodeEnv: process.env['NODE_ENV'],
				appVersion: process.env['APP_VERSION']
			},
			$timestamp: new Date().toISOString()
		});
	}

	/**
	 * Sanitizes request headers to remove sensitive data
	 *
	 * @param headers - Headers object from the request
	 * @returns Sanitized headers with sensitive values redacted
	 */
	private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
		const sanitized = { ...headers };
		const sensitiveHeaders = [
			'authorization',
			'cookie',
			'set-cookie',
			'x-auth-token',
			'x-api-key',
			'api-key',
			'password',
			'x-forwarded-for',
			'proxy-authorization'
		];

		for (const header of sensitiveHeaders) {
			if (sanitized[header]) {
				sanitized[header] = '[REDACTED]';
			}
		}

		return sanitized;
	}

	/**
	 * Sanitizes request body to remove sensitive data
	 *
	 * @param body - Request body object
	 * @returns Sanitized body with sensitive values redacted
	 */
	private sanitizeRequestBody(body: any): any {
		if (!body) return body;

		// Handle different body types
		if (typeof body !== 'object') return body;

		// Deep clone to avoid modifying the original
		const sanitized = JSON.parse(JSON.stringify(body));

		return this.sanitizeObject(sanitized);
	}

	/**
	 * Recursively sanitizes an object to remove sensitive data
	 *
	 * @param obj - Object to sanitize
	 * @returns Sanitized object with sensitive values redacted
	 */
	private sanitizeObject(obj: any): any {
		if (!obj || typeof obj !== 'object') return obj;

		// Handle arrays
		if (Array.isArray(obj)) {
			return obj.map((item) => this.sanitizeObject(item));
		}

		// Handle plain objects
		const result = { ...obj };

		for (const key in result) {
			// Check if the key is sensitive
			if (this.sensitiveBodyFields.includes(key.toLowerCase())) {
				result[key] = '[REDACTED]';
			}
			// Recursively sanitize nested objects
			else if (typeof result[key] === 'object' && result[key] !== null) {
				result[key] = this.sanitizeObject(result[key]);
			}
			// Sanitize anything that looks like a credential
			else if (typeof result[key] === 'string' && this.looksLikeCredential(key)) {
				result[key] = '[REDACTED]';
			}
		}

		return result;
	}

	/**
	 * Checks if a key name appears to contain credential-related terms
	 *
	 * @param key - Object property key to check
	 * @returns Whether the key appears to be credential-related
	 */
	private looksLikeCredential(key: string): boolean {
		const keyLower = key.toLowerCase();
		const sensitivePatterns = [
			'password',
			'secret',
			'token',
			'key',
			'auth',
			'credential',
			'cred',
			'pwd',
			'ssn',
			'account',
			'card',
			'cvv',
			'pin',
			'private'
		];

		return sensitivePatterns.some((pattern) => keyLower.includes(pattern));
	}

	/**
	 * Determines if an exception should be reported based on configured filters
	 *
	 * @param exception - The thrown exception
	 * @returns Boolean indicating if the exception should be reported
	 */
	shouldReport(exception: any): boolean {
		// If no options or filters are defined, always report
		if (!this.options || !this.options.filters) return true;

		// If any filter passes, then we do not report
		const filters: PosthogInterceptorOptionsFilter[] = this.options.filters;
		return !filters.some(({ type, filter }) => {
			return exception instanceof type && (!filter || filter(exception));
		});
	}
}

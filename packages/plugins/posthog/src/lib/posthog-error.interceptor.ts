// Nestjs imports
import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { ContextType, HttpArgumentsHost, RpcArgumentsHost, WsArgumentsHost } from '@nestjs/common/interfaces';
// Rxjs imports
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { PosthogInterceptorOptions, PosthogInterceptorOptionsFilter } from './posthog.interfaces';
import { PosthogService } from './posthog.service';

@Injectable()
export class PosthogErrorInterceptor implements NestInterceptor {
	protected readonly client: PosthogService = PosthogService.PosthogServiceInstance();

	constructor(private readonly options?: PosthogInterceptorOptions) {}

	/**
	 * Intercepts requests and captures exceptions
	 * @param {ExecutionContext} context - Execution context
	 * @param {CallHandler} next - Call handler
	 * @returns {Observable<any>} Observable
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// first param would be for events, second is for errors
		return next.handle().pipe(
			tap(null, (exception: HttpException) => {
				if (this.shouldReport(exception)) {
					this.captureException(context, exception);
				}
			})
		);
	}

	/**
	 * Routes exception capture based on context type
	 * @param {ExecutionContext} context - Execution context
	 * @param {HttpException} exception - The thrown exception
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
	 * Captures HTTP exceptions with request context
	 * @param {HttpArgumentsHost} http - HTTP arguments host
	 * @param {HttpException} exception - The thrown exception
	 */
	private captureHttpException(http: HttpArgumentsHost, exception: HttpException): void {
		const request = http.getRequest();
		const userId = request.ip || 'anonymous';

		// Create a data object with request details
		const data = {
			request: {
				method: request.method,
				url: request.originalUrl || request.url,
				headers: this.sanitizeHeaders(request.headers),
				query: request.query,
				body: request.body
			},
			user: {
				ip: request.ip,
				id: request.user?.id || request.user?.userId
			},
			status_code: exception instanceof HttpException ? exception.getStatus() : 500
		};

		// Track the error
		this.client.track('error', userId, {
			error: exception.message,
			stack: exception.stack,
			status_code: data.status_code,
			request_data: data.request,
			user_data: data.user,
			$timestamp: new Date().toISOString()
		});
	}

	/**
	 * Captures RPC exceptions with message context
	 * @param {RpcArgumentsHost} rpc - RPC arguments host
	 * @param {any} exception - The thrown exception
	 */
	private captureRpcException(rpc: RpcArgumentsHost, exception: any): void {
		const data = rpc.getData();

		this.client.track('rpc_error', 'system', {
			error: exception.message,
			stack: exception.stack,
			rpc_data: data,
			$timestamp: new Date().toISOString()
		});
	}

	/**
	 * Captures WebSocket exceptions with client context
	 * @param {WsArgumentsHost} ws - WebSocket arguments host
	 * @param {any} exception - The thrown exception
	 */
	private captureWsException(ws: WsArgumentsHost, exception: any): void {
		const client = ws.getClient();
		const data = ws.getData();

		const clientId = client.id || 'websocket-client';

		this.client.track('ws_error', clientId, {
			error: exception.message,
			stack: exception.stack,
			ws_client: {
				id: client.id,
				handshake: client.handshake
			},
			ws_data: data,
			$timestamp: new Date().toISOString()
		});
	}

	/**
	 * Sanitizes request headers to remove sensitive data
	 * @param {Record<string, any>} headers - Headers object
	 * @returns {Record<string, any>} Sanitized headers
	 */
	private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
		const sanitized = { ...headers };
		const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'x-auth-token'];

		for (const header of sensitiveHeaders) {
			if (sanitized[header]) {
				sanitized[header] = '[REDACTED]';
			}
		}

		return sanitized;
	}

	/**
	 * Determines if an exception should be reported based on filters
	 * @param {any} exception - The thrown exception
	 * @returns {boolean} Boolean indicating if the exception should be reported
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

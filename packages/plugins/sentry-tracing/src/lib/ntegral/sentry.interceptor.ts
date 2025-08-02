// Nestjs imports
import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { ContextType, HttpArgumentsHost, RpcArgumentsHost, WsArgumentsHost } from '@nestjs/common/interfaces';
// Rxjs imports
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Scope } from '@sentry/node';
import { httpRequestToRequestData } from '@sentry/core';

import { SentryInterceptorOptions, SentryInterceptorOptionsFilter } from './sentry.interfaces';
import { SentryService } from './sentry.service';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
	protected readonly client: SentryService = SentryService.SentryServiceInstance();

	constructor(private readonly options?: SentryInterceptorOptions) {}

	/**
	 *
	 * @param context
	 * @param next
	 * @returns
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		// first param would be for events, second is for errors
		return next.handle().pipe(
			tap(null, (exception: HttpException) => {
				if (this.shouldReport(exception)) {
					this.client.instance().withScope((scope) => {
						return this.captureException(context, scope, exception);
					});
				}
			})
		);
	}

	/**
	 *
	 * @param context
	 * @param scope
	 * @param exception
	 * @returns
	 */
	protected captureException(context: ExecutionContext, scope: Scope, exception: HttpException) {
		switch (context.getType<ContextType>()) {
			case 'http':
				return this.captureHttpException(scope, context.switchToHttp(), exception);
			case 'rpc':
				return this.captureRpcException(scope, context.switchToRpc(), exception);
			case 'ws':
				return this.captureWsException(scope, context.switchToWs(), exception);
		}
	}

	/**
	 * Captures HTTP exception with request context
	 * V9 Migration: Handlers.parseRequest was removed, manually extract request data
	 * Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/#removals-in-sentrycore
	 *
	 * @param scope
	 * @param http
	 * @param exception
	 */
	private captureHttpException(scope: Scope, http: HttpArgumentsHost, exception: HttpException): void {
		const request = http.getRequest();

		// V9 Migration: Use httpRequestToRequestData instead of manual extraction
		// Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/#removals-in-sentrycore
		// The addRequestDataToEvent method has been removed. Use httpRequestToRequestData instead and put the resulting object directly on event.request.
		const requestData = httpRequestToRequestData(request);

		scope.setExtra('req', requestData);
		scope.setTag('url', request.url);
		scope.setTag('method', request.method);

		// V9 Migration: Manual user context setting since requestDataIntegration no longer automatically sets user from request.user
		// Reference: https://docs.sentry.io/platforms/javascript/guides/node/migration/v8-to-v9/#behavior-changes
		if (request.user) {
			scope.setUser(request.user);
		}

		this.client.instance().captureException(exception);
	}

	/**
	 *
	 * @param scope
	 * @param rpc
	 * @param exception
	 */
	private captureRpcException(scope: Scope, rpc: RpcArgumentsHost, exception: any): void {
		scope.setExtra('rpc_data', rpc.getData());

		this.client.instance().captureException(exception);
	}

	/**
	 *
	 * @param scope
	 * @param ws
	 * @param exception
	 */
	private captureWsException(scope: Scope, ws: WsArgumentsHost, exception: any): void {
		scope.setExtra('ws_client', ws.getClient());
		scope.setExtra('ws_data', ws.getData());

		this.client.instance().captureException(exception);
	}

	/**
	 *
	 * @param exception
	 * @returns
	 */
	private shouldReport(exception: any) {
		if (this.options && !this.options.filters) return true;

		// If any filter passes, then we do not report
		if (this.options) {
			const opts: SentryInterceptorOptions = this.options as {};
			if (opts.filters) {
				let filters: SentryInterceptorOptionsFilter[] = opts.filters;
				return filters.some(({ type, filter }) => {
					return !(exception instanceof type && (!filter || filter(exception)));
				});
			}
		} else {
			return true;
		}
	}
}

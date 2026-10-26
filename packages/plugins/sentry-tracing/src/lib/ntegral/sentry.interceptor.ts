// Nestjs imports
import {
	CallHandler,
	ExecutionContext,
	HttpException,
	Injectable,
	NestInterceptor,
	ContextType
} from '@nestjs/common';
// Nest 12 exports the per-transport hosts from neither the package root nor an `interfaces` entry; they are
// types only, so this import is erased and nothing is required at run time.
import type {
	HttpArgumentsHost,
	RpcArgumentsHost,
	WsArgumentsHost
} from '@nestjs/common/interfaces/features/arguments-host.interface.js';
// Rxjs imports
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Scope } from '@sentry/node';

import { SentryInterceptorOptions, SentryInterceptorOptionsFilter } from './sentry.interfaces';
import { SentryService } from './sentry.service';
import { redactUrl, redactedRequestOf, sentryUserOf } from '../sentry-request-redaction';

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
				const sentry = this.client.instance();
				if (sentry && this.shouldReport(exception)) {
					sentry.withScope((scope) => {
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
		const sentry = this.client.instance();
		if (!sentry) return;

		const request = http.getRequest();

		// The request with its credentials redacted and without its body, and the user by id alone
		// (`sentry-request-redaction.ts`)
		scope.setExtra('req', redactedRequestOf(request));
		scope.setTag('url', redactUrl(request.url));
		scope.setTag('method', request.method);

		// V9 Migration: Manual user context setting since requestDataIntegration no longer automatically sets user from request.user
		// Reference: https://docs.sentry.io/platforms/javascript/guides/node/migration/v8-to-v9/#behavior-changes
		if (request.user) {
			scope.setUser(sentryUserOf(request.user));
		}

		sentry.captureException(exception);
	}

	/**
	 *
	 * @param scope
	 * @param rpc
	 * @param exception
	 */
	private captureRpcException(scope: Scope, rpc: RpcArgumentsHost, exception: any): void {
		const sentry = this.client.instance();
		if (!sentry) return;

		scope.setExtra('rpc_data', rpc.getData());
		sentry.captureException(exception);
	}

	/**
	 *
	 * @param scope
	 * @param ws
	 * @param exception
	 */
	private captureWsException(scope: Scope, ws: WsArgumentsHost, exception: any): void {
		const sentry = this.client.instance();
		if (!sentry) return;

		scope.setExtra('ws_client', ws.getClient());
		scope.setExtra('ws_data', ws.getData());
		sentry.captureException(exception);
	}

	/**
	 *
	 * @param exception
	 * @returns
	 */
	private shouldReport(exception: any): boolean {
		// No options or no filters configured: report everything.
		const filters: SentryInterceptorOptionsFilter[] = this.options?.filters || [];

		// Skip the exception only when one of the filters matches it. `some(!match)` used to drop every
		// exception for an empty list and report matched ones as soon as any other filter did not match.
		return !filters.some(({ type, filter }) => {
			return exception instanceof type && (!filter || filter(exception));
		});
	}
}

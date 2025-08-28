import { ExecutionContext, Injectable } from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';

// Sentry imports
import { Scope } from '@sentry/node';
import { SentryInterceptor } from '.';

let GqlExecutionContext: any;
try {
	({ GqlExecutionContext } = require('@nestjs/graphql'));
} catch (e) {}

@Injectable()
export class GraphqlInterceptor extends SentryInterceptor {
	/**
	 *
	 * @param context
	 * @param scope
	 * @param exception
	 */
	protected captureException(context: ExecutionContext, scope: Scope, exception: any) {
		if (context.getType<GqlContextType>() === 'graphql') {
			this.captureGraphqlException(scope, GqlExecutionContext.create(context), exception);
		} else {
			super.captureException(context, scope, exception);
		}
	}

	/**
	 * Captures GraphQL exception with context
	 * V9 Migration: Handlers.parseRequest was removed, manually extract request data
	 * Reference: https://docs.sentry.io/platforms/javascript/migration/v8-to-v9/#removals-in-sentrycore
	 *
	 * @param scope
	 * @param gqlContext
	 * @param exception
	 */
	private captureGraphqlException(scope: Scope, gqlContext: typeof GqlExecutionContext, exception: any): void {
		const info = gqlContext.getInfo();
		const context = gqlContext.getContext();

		scope.setExtra('type', info.parentType.name);

		if (context.req) {
			// V9 Migration: Manual request data extraction since Handlers.parseRequest was removed
			// The addRequestDataToEvent method has been removed. Manually extract relevant data of request objects instead.
			const req = context.req;
			const requestData = {
				url: req.url,
				method: req.method,
				headers: req.headers,
				query: req.query,
				data: req.body
			};

			scope.setExtra('req', requestData);

			// V9 Migration: Manual user context setting since requestDataIntegration no longer automatically sets user from request.user
			// Reference: https://docs.sentry.io/platforms/javascript/guides/node/migration/v8-to-v9/#behavior-changes
			if (req.user) {
				scope.setUser(req.user);
			}
		}

		this.client.instance().captureException(exception);
	}
}

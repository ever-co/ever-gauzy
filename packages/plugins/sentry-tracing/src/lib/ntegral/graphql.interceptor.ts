import { ExecutionContext, Injectable } from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';

// Sentry imports
import { Scope } from '@sentry/core';
import { Handlers } from '@sentry/node';
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
			// req within graphql context needs modification in
			const data = Handlers.parseRequest(<any>{}, context.req, {});

			scope.setExtra('req', data.request);

			if (data.extra) scope.setExtras(data.extra);
			if (data.user) scope.setUser(data.user);
		}

		this.client.instance().captureException(exception);
	}
}

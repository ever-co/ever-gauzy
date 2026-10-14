import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { environment } from '@gauzy/config';
import { resolveThrottlerTracker } from './tracker';

/**
 * Rate-limit guard for deployments that sit behind a reverse proxy.
 *
 * The bucket key comes from {@link resolveThrottlerTracker}, which only believes
 * `CF-Connecting-IP` when `THROTTLE_TRUST_CF_CONNECTING_IP` (alias `CLOUDFLARE_PROXY_ENABLED`)
 * says the deployment is actually fronted by Cloudflare, and otherwise uses Express's `req.ip` —
 * which honours the configured `TRUST_PROXY` hop count or proxy CIDRs instead of the client-supplied
 * head of the `X-Forwarded-For` chain (GHSA-86mw-2crg-vmhc). That resistance is only as good as the
 * `TRUST_PROXY` setting: `TRUST_PROXY=true` trusts the whole chain and hands the choice of bucket
 * back to the client.
 *
 * GraphQL: registered as a global `APP_GUARD`, the guard also runs for every resolver, where the
 * base class's `switchToHttp()` answers the operation's ROOT VALUE and field arguments instead of the
 * request and response. The bucket was then keyed on a root value with no address — every GraphQL
 * client of the deployment shared one bucket — and no rate-limit header reached the response. The
 * request and response are read from the GraphQL context instead (it carries the Express request, see
 * `graphql-helper.ts`). An operation with no HTTP request behind it (a subscription event over the
 * socket) is not throttled here: its connection was an HTTP upgrade that the edge rate-limits.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
	protected async getTracker(req: Record<string, any>): Promise<string> {
		return resolveThrottlerTracker(req, {
			trustCloudflareConnectingIp: environment.THROTTLE_TRUST_CF_CONNECTING_IP === true
		});
	}

	protected getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
		if (context.getType<GqlContextType>() !== 'graphql') {
			return super.getRequestResponse(context);
		}
		const req = graphqlHttpRequest(context);
		return { req, res: req?.res };
	}

	protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
		if (context.getType<GqlContextType>() === 'graphql' && !graphqlHttpRequest(context)) {
			return true;
		}
		return super.shouldSkip(context);
	}
}

/** The Express request behind a GraphQL operation, or `undefined` for a socket-delivered operation. */
function graphqlHttpRequest(context: ExecutionContext): (Record<string, any> & { res?: Record<string, any> }) | undefined {
	const operation = GqlExecutionContext.create(context).getContext<{ req?: Record<string, any> }>();
	const req = operation?.req;
	// An HTTP operation's request is Express's, which links its response; a socket's upgrade request
	// (graphql-ws) is a bare IncomingMessage with none.
	return req && req.res ? req : undefined;
}

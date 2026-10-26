import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { resolveThrottlerTracker, throttlerTrackerOptions } from './tracker';
import { resolveUserThrottlerTracker } from './user-tracker';

/**
 * The metadata key `@Throttle` writes a limit under, followed by the throttler's name.
 *
 * `@nestjs/throttler` does not export its constants from the package root, and this package does not
 * reach into `dist/`; the spec pins the value against the package's own constant.
 */
export const THROTTLER_LIMIT_METADATA = 'THROTTLER:LIMIT';

/**
 * The bucket every socket-delivered operation of a rate-limited field is counted in.
 *
 * A graphql-ws operation's request is assembled from the connection's headers and carries no client
 * address, so there is nothing to tell two socket clients apart by: they share one bucket per field,
 * separate from every HTTP client's.
 */
export const SOCKET_THROTTLER_TRACKER = 'graphql-socket';

/** Marks the request a socket-delivered operation is counted with. */
const SOCKET_OPERATION = '__graphqlSocketOperation';

/**
 * Rate-limit guard for deployments that sit behind a reverse proxy.
 *
 * **Signed-in requests are counted per user.** On a route that requires authentication (no `@Public()`),
 * a request whose access token verifies is counted in its user's bucket (`user:<id>`, see
 * {@link resolveUserThrottlerTracker}) instead of its address's. Everyone behind one address — an office
 * NAT, or the Ever Teams server that makes every call for its users — no longer shares one budget, and
 * one user does not get a fresh budget per address. A token that does not verify is counted by address.
 * **Anonymous routes (`@Public()`: sign-in, invite accept, password reset, ...) are always counted per
 * client address**, even when a token is sent, so registering more accounts never buys more guesses.
 *
 * The address comes from {@link resolveThrottlerTracker}: the browser address the Ever Teams server
 * forwards when its HMAC proof verifies (`EVER_TEAMS_CLIENT_IP_SECRET`), otherwise it only believes
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
 * `graphql-helper.ts`).
 *
 * **An operation delivered over the socket** has no HTTP exchange of its own. It is not throttled by
 * the installation-wide default — its connection was an HTTP upgrade the edge rate-limits — **except on
 * a field that states its own limit**. Those are the public credential checks (`inviteByToken`,
 * `inviteByCode`, the join-request code, …): a socket accepts any credential-shaped string at connect
 * time and `@Public()` skips its verification, so skipping them would leave an unlimited guessing channel
 * beside the limited HTTP one (review R7-09). They are counted in one bucket per field for every socket
 * client ({@link SOCKET_THROTTLER_TRACKER}), since the operation carries no address; the HTTP endpoint
 * keeps its per-client buckets.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
	/**
	 * The bucket a request is counted in (see the class documentation).
	 *
	 * @param req - The request, as {@link getRequestResponse} resolved it.
	 * @param context - The execution context; `ThrottlerGuard` passes it as the second argument.
	 * @returns The bucket key.
	 */
	protected async getTracker(req: Record<string, any>, context?: ExecutionContext): Promise<string> {
		if (req?.[SOCKET_OPERATION]) {
			return SOCKET_THROTTLER_TRACKER;
		}
		if (context && !this.isPublicRoute(context)) {
			const user = resolveUserThrottlerTracker(req);

			if (user) {
				return user;
			}
		}
		return resolveThrottlerTracker(req, throttlerTrackerOptions());
	}

	/**
	 * Whether the handler or its class is `@Public()`, i.e. answers anonymous callers.
	 *
	 * @param context - The execution context.
	 * @returns True for an anonymous route.
	 */
	private isPublicRoute(context: ExecutionContext): boolean {
		const targets = [context.getHandler(), context.getClass()];

		return this.reflector.getAllAndOverride<boolean>(PUBLIC_METHOD_METADATA, targets) === true;
	}

	protected getRequestResponse(context: ExecutionContext): { req: Record<string, any>; res: Record<string, any> } {
		if (context.getType<GqlContextType>() !== 'graphql') {
			return super.getRequestResponse(context);
		}
		const req = graphqlHttpRequest(context);
		if (req) {
			return { req, res: req.res };
		}
		// A socket-delivered operation of a field that states its own limit (see `shouldSkip`): counted as
		// one socket client, with no response to write rate-limit headers to.
		const operation = GqlExecutionContext.create(context).getContext<{ req?: Record<string, any> }>();
		return { req: { headers: operation?.req?.headers ?? {}, [SOCKET_OPERATION]: true }, res: {} };
	}

	protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
		if (context.getType<GqlContextType>() === 'graphql' && !graphqlHttpRequest(context)) {
			return !this.statesOwnLimit(context);
		}
		return super.shouldSkip(context);
	}

	/**
	 * Whether the handler or its class states a limit of its own with `@Throttle`, for any throttler.
	 *
	 * @param context The execution context.
	 * @returns True when a route- or class-level limit is declared.
	 */
	private statesOwnLimit(context: ExecutionContext): boolean {
		const targets = [context.getHandler(), context.getClass()];

		return (this.throttlers ?? []).some(
			(throttler) =>
				this.reflector.getAllAndOverride(`${THROTTLER_LIMIT_METADATA}${throttler.name}`, targets) !== undefined
		);
	}
}

/** The Express request behind a GraphQL operation, or `undefined` for a socket-delivered operation. */
function graphqlHttpRequest(
	context: ExecutionContext
): (Record<string, any> & { res?: Record<string, any> }) | undefined {
	const operation = GqlExecutionContext.create(context).getContext<{ req?: Record<string, any> }>();
	const req = operation?.req;
	// An HTTP operation's request is Express's, which links its response; a socket's upgrade request
	// (graphql-ws) is a bare IncomingMessage with none.
	return req && req.res ? req : undefined;
}

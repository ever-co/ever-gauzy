import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { resolveThrottlerTracker } from './tracker';

/**
 * Rate-limit guard for deployments that sit behind a reverse proxy.
 *
 * The bucket key comes from {@link resolveThrottlerTracker}, which only believes
 * `CF-Connecting-IP` when `THROTTLE_TRUST_CF_CONNECTING_IP` (alias `CLOUDFLARE_PROXY_ENABLED`)
 * says the deployment is actually fronted by Cloudflare, and otherwise uses Express's `req.ip` —
 * which honours the configured `TRUST_PROXY` hop count instead of the client-supplied head of the
 * `X-Forwarded-For` chain (GHSA-86mw-2crg-vmhc).
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
	protected async getTracker(req: Record<string, any>): Promise<string> {
		return resolveThrottlerTracker(req, {
			trustCloudflareConnectingIp: environment.THROTTLE_TRUST_CF_CONNECTING_IP === true
		});
	}
}

import { BadRequestException } from '@nestjs/common';
import { getUnsafeOutboundUrlReason } from '@gauzy/utils';

export { createSsrfSafeHttpsAgent } from '@gauzy/core';

/**
 * Validates a tenant-supplied Zapier webhook target URL against the SSRF egress guard.
 *
 * Throws a {@link BadRequestException} if the URL targets a loopback / private / link-local host
 * (incl. the cloud-metadata IP `169.254.169.254`), uses a non-HTTPS scheme, contains embedded
 * credentials, or is otherwise malformed. Applied both when the subscription is stored and again
 * before each outbound delivery, so subscriptions stored before this guard existed are also
 * rejected (GHSA-6gg6-vv4f-2x74).
 *
 * The connection-time half of the guard is `createSsrfSafeHttpsAgent` (re-exported above from
 * `@gauzy/core`), which re-checks the resolved IP and so catches DNS rebinding that a URL-literal
 * check cannot.
 *
 * @param url - The webhook target URL to validate.
 */
export function assertSafeZapierWebhookUrl(url: string): void {
	const reason = getUnsafeOutboundUrlReason(url);
	if (reason) {
		throw new BadRequestException(`Invalid webhook URL: ${reason}`);
	}
}

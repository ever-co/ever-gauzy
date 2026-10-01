import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionRequiredGuard } from '@gauzy/core';

/** The outcome of the subscription check of a sign-up. */
export type ZitadelSubscriptionCheck = { allowed: true } | { allowed: false; checkoutUrl: string; message?: string };

/**
 * Runs Gauzy's own subscription gate of the register route for an Ever ID sign-up.
 *
 * It calls the unchanged `SubscriptionRequiredGuard` with the same request shape `POST /auth/register`
 * presents, so the rule is identical: a self-hosted install without billing lets everyone through,
 * and a deployment with a sign-up paywall sends a new person to checkout first. The checkout URL is
 * returned without the e-mail address: personal data never travels in a URL from this plugin.
 */
@Injectable()
export class ZitadelSubscriptionGateService {
	constructor(private readonly guard: SubscriptionRequiredGuard) {}

	async check(email: string): Promise<ZitadelSubscriptionCheck> {
		const request = { body: { user: { email } } };
		const context = {
			switchToHttp: () => ({ getRequest: () => request })
		} as unknown as ExecutionContext;
		try {
			await this.guard.canActivate(context);
			return { allowed: true };
		} catch (error) {
			if (error instanceof ForbiddenException) {
				const body = error.getResponse() as { checkoutUrl?: string; message?: string };
				return { allowed: false, checkoutUrl: withoutEmail(body?.checkoutUrl), message: body?.message };
			}
			throw error;
		}
	}
}

/**
 * Removes the `email` query parameter from a checkout URL.
 *
 * @param url - The checkout URL.
 * @returns The URL without the parameter (or an empty string for an unusable value).
 */
export function withoutEmail(url: string | undefined): string {
	if (!url) {
		return '';
	}
	try {
		const parsed = new URL(url);
		parsed.searchParams.delete('email');
		return parsed.toString();
	} catch {
		return '';
	}
}

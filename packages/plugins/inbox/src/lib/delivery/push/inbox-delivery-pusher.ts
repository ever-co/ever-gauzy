import { Agent } from 'node:https';
import { Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';
import { pinnedWebhookLookup, refusalForResolvedEndpoint, WebhookEndpointRefusedError } from '@gauzy/core';
import type { InboxPushSubscription } from './inbox-push-subscription.entity';
import { IInboxWebPushConfig, INBOX_PUSH_TTL_SECONDS, readInboxWebPushConfig } from './inbox-push.constants';

/** What a push carries: the entry's title, text and kind, where it opens, and a tag so a device shows one per entry. */
export interface IInboxPushPayload {
	title: string;
	body: string;
	kindLabel: string;
	url: string;
	itemId: string;
	tag: string;
}

/** The push service no longer knows the subscription (404 / 410): the device is gone. */
export class InboxPushGoneError extends Error {
	constructor(readonly statusCode: number) {
		super(`The push subscription is gone (${statusCode}).`);
		this.name = 'InboxPushGoneError';
	}
}

/**
 * The device's endpoint is one the platform must not connect to (a private, loopback or link-local address, or a
 * host that resolves into one): the device is removed, never pushed to. A browser's push service is a public host;
 * an endpoint that is not one was supplied, not issued.
 */
export class InboxPushRefusedError extends Error {
	readonly code = 'INBOX_PUSH_ENDPOINT_REFUSED';

	constructor(reason: string) {
		super(reason);
		this.name = 'InboxPushRefusedError';
	}
}

/**
 * Sends the delivery lane's pushes through the standard web push protocol (`web-push`: payload encryption and the
 * VAPID signature), with the keys the environment holds. A push carries only what the entry shows its recipient.
 *
 * **Where a push may go is the platform's outbound-endpoint policy** (`webhook-endpoint-policy`): an endpoint a person
 * registered is a URL the worker then connects to, so it is held to the same rule as a webhook — nothing that is not
 * globally routable — resolved again immediately before each push (`refusalForResolvedEndpoint`), and once more by
 * the connection's own lookup (`pinnedWebhookLookup`), so the address checked is the address the socket connects to.
 * `GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK=true` lifts the rule for an installation whose push service is on its own
 * network, as it lifts it for webhooks.
 */
@Injectable()
export class InboxDeliveryPusher {
	private readonly logger = new Logger(InboxDeliveryPusher.name);
	private readonly config: IInboxWebPushConfig | null = readInboxWebPushConfig();
	/** The connection resolves the host under the policy: one resolution, checked, then used. */
	private readonly agent = new Agent({ lookup: pinnedWebhookLookup as never });

	constructor() {
		if (!this.config) {
			this.logger.log('Web push: no VAPID key pair (GAUZY_INBOX_VAPID_PUBLIC_KEY / GAUZY_INBOX_VAPID_PRIVATE_KEY); nothing is pushed.');
		}
	}

	/** Whether the keys are there. */
	configured(): boolean {
		return !!this.config;
	}

	/**
	 * Pushes to one device. A device the service no longer knows raises `InboxPushGoneError`; one whose endpoint the
	 * policy refuses — as text, as resolved, or as the connection resolves it — raises `InboxPushRefusedError`.
	 */
	async send(device: Pick<InboxPushSubscription, 'endpoint' | 'p256dh' | 'auth'>, payload: IInboxPushPayload): Promise<void> {
		if (!this.config) {
			throw new Error('Web push is not configured.');
		}
		let url: URL;
		try {
			url = new URL(device.endpoint);
		} catch {
			throw new InboxPushRefusedError('The push endpoint is not a URL.');
		}
		if (url.protocol !== 'https:') {
			throw new InboxPushRefusedError('The push endpoint must be an https URL.');
		}
		const refusal = await refusalForResolvedEndpoint(url);
		if (refusal) {
			throw new InboxPushRefusedError(refusal);
		}
		try {
			await webPush.sendNotification(
				{ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
				JSON.stringify(payload),
				{
					TTL: INBOX_PUSH_TTL_SECONDS,
					vapidDetails: { subject: this.config.subject, publicKey: this.config.publicKey, privateKey: this.config.privateKey },
					agent: this.agent
				} as never
			);
		} catch (error) {
			if (error instanceof WebhookEndpointRefusedError) {
				throw new InboxPushRefusedError(error.message);
			}
			const statusCode = Number((error as { statusCode?: number })?.statusCode);
			if (statusCode === 404 || statusCode === 410) {
				throw new InboxPushGoneError(statusCode);
			}
			throw error;
		}
	}
}

import { Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';
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
 * Sends the delivery lane's pushes through the standard web push protocol (`web-push`: payload encryption and the
 * VAPID signature), with the keys the environment holds. A push carries only what the entry shows its recipient.
 */
@Injectable()
export class InboxDeliveryPusher {
	private readonly logger = new Logger(InboxDeliveryPusher.name);
	private readonly config: IInboxWebPushConfig | null = readInboxWebPushConfig();

	constructor() {
		if (!this.config) {
			this.logger.log('Web push: no VAPID key pair (GAUZY_INBOX_VAPID_PUBLIC_KEY / GAUZY_INBOX_VAPID_PRIVATE_KEY); nothing is pushed.');
		}
	}

	/** Whether the keys are there. */
	configured(): boolean {
		return !!this.config;
	}

	/** Pushes to one device; a device the service no longer knows raises `InboxPushGoneError`. */
	async send(device: Pick<InboxPushSubscription, 'endpoint' | 'p256dh' | 'auth'>, payload: IInboxPushPayload): Promise<void> {
		if (!this.config) {
			throw new Error('Web push is not configured.');
		}
		try {
			await webPush.sendNotification(
				{ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
				JSON.stringify(payload),
				{ TTL: INBOX_PUSH_TTL_SECONDS, vapidDetails: { subject: this.config.subject, publicKey: this.config.publicKey, privateKey: this.config.privateKey } }
			);
		} catch (error) {
			const statusCode = Number((error as { statusCode?: number })?.statusCode);
			if (statusCode === 404 || statusCode === 410) {
				throw new InboxPushGoneError(statusCode);
			}
			throw error;
		}
	}
}

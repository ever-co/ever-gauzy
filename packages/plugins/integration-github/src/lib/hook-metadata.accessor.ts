import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmitterWebhookEventName } from '@octokit/webhooks/dist-types/types';

@Injectable()
export class HookMetadataAccessor {
	constructor(private readonly reflector: Reflector) {}

	/**
	 * Get the webhook events associated with a target.
	 * @param target A function or constructor representing the target class or controller.
	 * @returns An array of EmitterWebhookEventName that represent the webhook events.
	 */
	getWebhookEvents(target: () => any): EmitterWebhookEventName[] {
		// Retrieve the metadata for HOOK_EVENTS, if available, from the target.
		// HOOK_EVENTS metadata should contain eventOrEvents property.
		return this.reflector.get('HOOK_EVENTS', target)?.eventOrEvents;
	}
}

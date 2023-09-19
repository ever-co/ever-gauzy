import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmitterWebhookEventName } from '@octokit/webhooks/dist-types/types';

@Injectable()
export class HookMetadataAccessor {
	constructor(private readonly reflector: Reflector) {}

	getWebhookEvents(target: () => any): EmitterWebhookEventName[] {
		return this.reflector.get('HOOK_EVENTS', target)?.eventOrEvents;
	}
}

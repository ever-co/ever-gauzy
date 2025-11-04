import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { EmitterWebhookEventName } from '@octokit/webhooks';

/**
 * Sets up hook trigger on functions.
 * @param eventOrEvents The GitHub webhook event(s) to trigger this function.
 */
export function Hook(eventOrEvents: EmitterWebhookEventName | EmitterWebhookEventName[]): MethodDecorator {
	return applyDecorators(SetMetadata('HOOK_EVENTS', { eventOrEvents }));
}

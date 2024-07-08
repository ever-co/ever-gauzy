import { applyDecorators, SetMetadata } from '@nestjs/common';
import { EmitterWebhookEventName } from '@octokit/webhooks/dist-types/types';

/**
 * Sets up hook trigger on functions.
 * @param eventOrEvents The GitHub webhook event(s) to trigger this function.
 */
export function Hook(eventOrEvents: EmitterWebhookEventName | EmitterWebhookEventName[]): MethodDecorator {
	return applyDecorators(SetMetadata('HOOK_EVENTS', { eventOrEvents }));
}

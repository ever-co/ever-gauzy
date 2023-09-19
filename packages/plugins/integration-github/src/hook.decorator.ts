import { applyDecorators, SetMetadata } from '@nestjs/common';
import { EmitterWebhookEventName } from '@octokit/webhooks/dist-types/types';

/**
 * Sets up hook trigger on functions.
 */
export function Hook(
	eventOrEvents: EmitterWebhookEventName[]
): MethodDecorator {
	return applyDecorators(SetMetadata('HOOK_EVENTS', { eventOrEvents }));
}

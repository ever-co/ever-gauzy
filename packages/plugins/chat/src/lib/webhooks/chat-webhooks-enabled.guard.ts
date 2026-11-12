import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isChatWebhooksEnabled } from './chat-webhooks-enabled';

/**
 * The webhook management and interaction routes answer 404 unless `GAUZY_CHAT_WEBHOOKS_ENABLED=true`, decided per
 * request before any other guard reads the tenant (the services check it again). The public receive route does not
 * use it: it answers its own plain-text `404 no_webhook`.
 */
@Injectable()
export class ChatWebhooksEnabledGuard implements CanActivate {
	canActivate(): boolean {
		if (!isChatWebhooksEnabled()) throw new NotFoundException('The requested record was not found');
		return true;
	}
}

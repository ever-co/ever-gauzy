import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isInboxWebPushEnabled } from '../../inbox-enabled';
import { readInboxWebPushConfig } from './inbox-push.constants';

/** The push routes answer 404 where web push is off or the VAPID keys are not set, so a client probes one to learn it. */
@Injectable()
export class InboxWebPushEnabledGuard implements CanActivate {
	canActivate(): boolean {
		if (!isInboxWebPushEnabled() || !readInboxWebPushConfig()) {
			throw new NotFoundException('INBOX_WEB_PUSH_DISABLED: web push is not enabled on this server.');
		}
		return true;
	}
}

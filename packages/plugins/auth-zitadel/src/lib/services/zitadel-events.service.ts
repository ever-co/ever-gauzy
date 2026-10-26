import { Injectable } from '@nestjs/common';
import { EventBus, User } from '@gauzy/core';
import { ZitadelLinkMethod } from '../entities/zitadel-account.entity';
import { ZitadelAccountLinkedEvent, ZitadelAccountUnlinkedEvent } from '../events/zitadel-account.events';
import { ZitadelIdentity } from './zitadel-account.service';

/**
 * Publishes link and unlink events on the core event bus (in process only; nothing subscribes in this
 * plugin). The events carry ids and the tenant display name, never an e-mail address.
 */
@Injectable()
export class ZitadelEventsService {
	constructor(private readonly eventBus: EventBus) {}

	async linked(users: User[], identity: ZitadelIdentity, linkMethod: ZitadelLinkMethod): Promise<void> {
		for (const user of users) {
			await this.eventBus.publish(new ZitadelAccountLinkedEvent(this.payload(user, identity, linkMethod)));
		}
	}

	async unlinked(user: User, identity: ZitadelIdentity): Promise<void> {
		await this.eventBus.publish(new ZitadelAccountUnlinkedEvent(this.payload(user, identity)));
	}

	private payload(user: User, identity: ZitadelIdentity, linkMethod?: ZitadelLinkMethod) {
		return {
			userId: user.id,
			tenantId: user.tenantId ?? null,
			tenantName: user.tenant?.name ?? '',
			issuer: identity.issuer,
			subject: identity.subject,
			linkMethod,
			everPersonId: identity.everPersonId
		};
	}
}

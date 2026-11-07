import { Injectable } from '@nestjs/common';
import { ID, IInboxPushSubscription } from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** The MikroORM repository the entity names (the services run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmInboxPushSubscriptionRepository extends MikroOrmBaseEntityRepository<InboxPushSubscription> {}

/**
 * `inbox_push_subscription` (the Inbox spec FR-13): one browser or device a person subscribed to web push, as the
 * browser's `PushSubscription` gives it — the push service's endpoint and the device's keys — and how it fared. The
 * person's own: registered, listed and removed by them; pushed to by the delivery sweep; removed by the sweep when the
 * push service says the device is gone, or after `INBOX_PUSH_MAX_FAILURES` failures in a row.
 */
@MultiORMEntity('inbox_push_subscription', { mikroOrmRepository: () => MikroOrmInboxPushSubscriptionRepository })
export class InboxPushSubscription extends TenantOrganizationBaseEntity implements IInboxPushSubscription {
	@MultiORMColumn()
	userId!: ID;

	@MultiORMColumn({ nullable: true })
	employeeId?: ID;

	@MultiORMColumn({ type: 'text' })
	endpoint!: string;

	/** SHA-256 of the endpoint, hex: what the unique key is on (an endpoint is too long for a key on MySQL). */
	@MultiORMColumn({ type: 'varchar', length: 64 })
	endpointHash!: string;

	@MultiORMColumn({ type: 'text' })
	p256dh!: string;

	@MultiORMColumn({ type: 'text' })
	auth!: string;

	@MultiORMColumn({ nullable: true })
	expirationTime?: Date;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	userAgent?: string;

	@MultiORMColumn({ nullable: true })
	lastUsedAt?: Date;

	@MultiORMColumn({ type: 'int', default: 0 })
	failures!: number;
}

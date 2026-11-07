import { Injectable } from '@nestjs/common';
import { ID, IInboxDelivery, InboxDeliveryChannelEnum, InboxDeliveryModeEnum } from '@gauzy/contracts';
import { MikroOrmBaseEntityRepository, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';

/** The MikroORM repository the entity names (the service itself runs on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmInboxDeliveryRepository extends MikroOrmBaseEntityRepository<InboxDelivery> {}

/**
 * `inbox_delivery` (the Inbox spec, "Preferences and channels"): one row per entry, person and channel — the decision
 * the person's preferences gave (nothing, an email at once, a place in the daily digest), when it is due, and the
 * attempts. The table is the outbox of the delivery lane: the worker's sweep writes the row once (unique on entry,
 * person and channel), sends what is due, and records what happened; nothing is lost between a crash and the next
 * sweep, and a digest goes out once per person and day. Created by the delivery plugin's migration, registered only
 * with it (`GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED`).
 */
@MultiORMEntity('inbox_delivery', { mikroOrmRepository: () => MikroOrmInboxDeliveryRepository })
export class InboxDelivery extends TenantOrganizationBaseEntity implements IInboxDelivery {
	@MultiORMColumn()
	inboxItemId!: ID;

	@MultiORMColumn()
	userId!: ID;

	@MultiORMColumn({ nullable: true })
	employeeId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	channel!: InboxDeliveryChannelEnum;

	@MultiORMColumn({ type: 'varchar', length: 16 })
	mode!: InboxDeliveryModeEnum;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	notificationType?: string;

	@MultiORMColumn({ nullable: true })
	dueAt?: Date;

	@MultiORMColumn({ type: 'varchar', length: 16, nullable: true })
	digestKey?: string;

	@MultiORMColumn({ nullable: true })
	sentAt?: Date;

	@MultiORMColumn({ type: 'int', default: 0 })
	attempts!: number;

	@MultiORMColumn({ nullable: true })
	nextAttemptAt?: Date;

	@MultiORMColumn({ type: 'text', nullable: true })
	lastError?: string;

	@MultiORMColumn({ nullable: true })
	failedAt?: Date;
}

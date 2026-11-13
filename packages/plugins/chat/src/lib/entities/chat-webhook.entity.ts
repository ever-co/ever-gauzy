import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatWebhookRepository } from './chat.repositories';

/**
 * `chat_webhook`: an incoming webhook of a channel. The URL secret is kept as its SHA-256 only (`tokenHash`, the
 * lookup key); the signing secret of interaction callbacks is sealed (`ChatWebhookSecretBox`). A revoked webhook
 * keeps its row (`revokedAt`), so its messages keep their app name and the list keeps its history.
 */
@MultiORMEntity('chat_webhook', { mikroOrmRepository: () => MikroOrmChatWebhookRepository })
export class ChatWebhook extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	conversationId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 80 })
	name!: string;

	@MultiORMColumn({ type: 'varchar', length: 2048, nullable: true })
	iconUrl?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 2048, nullable: true })
	interactionUrl?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 64 })
	tokenHash!: string;

	@MultiORMColumn({ type: 'varchar', length: 8 })
	tokenHint!: string;

	/** Sealed (`cw1:…`); never answered by any route. */
	@MultiORMColumn({ type: 'text', nullable: true })
	signingSecret?: string | null;

	@MultiORMColumn({ default: false })
	canBroadcast!: boolean;

	@MultiORMColumn({ nullable: true })
	createdByEmployeeId?: ID;

	@MultiORMColumn({ nullable: true })
	revokedAt?: Date;

	@MultiORMColumn({ nullable: true })
	revokedByEmployeeId?: ID;

	@MultiORMColumn({ nullable: true })
	lastUsedAt?: Date;

	@MultiORMColumn({ type: 'int', default: 0 })
	acceptedCount!: number;

	@MultiORMColumn({ type: 'int', default: 0 })
	rejectedCount!: number;

	@MultiORMColumn({ type: 'int', default: 0 })
	rateLimitedCount!: number;

	@MultiORMColumn({ type: 'int', default: 0 })
	callbackFailureCount!: number;
}

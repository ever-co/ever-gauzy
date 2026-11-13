import { ChatInteractionStatusEnum, ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatWebhookInteractionRepository } from './chat.repositories';

/**
 * `chat_webhook_interaction`: one click on a button of an app message, and its callback. Its id is the
 * `interactionId` the callback carries on every attempt; `replyAppliedAt` makes the sender's reply apply once;
 * `idempotencyKey` (unique per tenant, message and clicker, migration `1791000008300`) makes a repeated click one.
 */
@MultiORMEntity('chat_webhook_interaction', { mikroOrmRepository: () => MikroOrmChatWebhookInteractionRepository })
export class ChatWebhookInteraction extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	webhookId!: ID;

	@MultiORMColumn()
	messageId!: ID;

	@MultiORMColumn()
	conversationId!: ID;

	@MultiORMColumn()
	actorEmployeeId!: ID;

	@MultiORMColumn()
	actorUserId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 255 })
	actionId!: string;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	blockId?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 2000, nullable: true })
	value?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatInteractionStatusEnum.PENDING })
	status!: ChatInteractionStatusEnum;

	@MultiORMColumn({ type: 'int', default: 0 })
	attempts!: number;

	@MultiORMColumn({ type: 'int', default: 0 })
	lastStatusCode!: number;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	lastError?: string | null;

	@MultiORMColumn({ nullable: true })
	deliveredAt?: Date;

	@MultiORMColumn({ nullable: true })
	replyAppliedAt?: Date;

	/**
	 * The clicker's `Idempotency-Key`, when the client sent one: a double click or a retry after a lost answer names
	 * this row again instead of making a second one. Null for a client that sends none (every request is a click).
	 */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	idempotencyKey?: string | null;
}

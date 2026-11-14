import { ChatMessageKindEnum, ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatMessageRepository } from './chat.repositories';

/**
 * `chat_message`: a message of a conversation, a thread reply (`threadRootId`), a system row or an app post (an incoming webhook's,
 * with `webhookId`, `appIconUrl` and its `blocks`).
 * The body is a markdown subset with mention tokens (`<@employeeId>`, `<#conversationId>`, `<!channel>`,
 * `<!here>`); `mentionEmployeeIds` and `attachmentIds` are JSON arrays stored as text (the same on the three
 * databases). A deleted message keeps its row (soft delete through the base `deletedAt`) with an empty body when
 * it roots a thread, so the replies keep their context. A message of files only has an empty body too (and its
 * attachments): `deletedAt` tells the two apart.
 */
@MultiORMEntity('chat_message', { mikroOrmRepository: () => MikroOrmChatMessageRepository })
export class ChatMessage extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	conversationId!: ID;

	@MultiORMColumn({ nullable: true })
	authorEmployeeId?: ID;

	@MultiORMColumn({ nullable: true })
	authorUserId?: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatMessageKindEnum.MESSAGE })
	kind!: ChatMessageKindEnum;

	@MultiORMColumn({ type: 'text' })
	body!: string;

	/** JSON `string[]`. */
	@MultiORMColumn({ type: 'text', nullable: true })
	mentionEmployeeIds?: string | null;

	@MultiORMColumn({ default: false })
	mentionsChannel!: boolean;

	@MultiORMColumn({ default: false })
	mentionsHere!: boolean;

	@MultiORMColumn({ nullable: true })
	replyToId?: ID;

	@MultiORMColumn({ nullable: true })
	threadRootId?: ID;

	@MultiORMColumn({ default: false })
	alsoInConversation!: boolean;

	@MultiORMColumn({ type: 'int', default: 0 })
	replyCount!: number;

	@MultiORMColumn({ nullable: true })
	lastReplyAt?: Date;

	@MultiORMColumn({ nullable: true })
	pinnedAt?: Date;

	@MultiORMColumn({ nullable: true })
	pinnedByEmployeeId?: ID;

	@MultiORMColumn({ nullable: true })
	editedAt?: Date;

	/** JSON `string[]` of document ids. */
	@MultiORMColumn({ type: 'text', nullable: true })
	attachmentIds?: string | null;

	/** The names the attached files had at the send (or the last edit), one per line: a message of files only reads as them. */
	@MultiORMColumn({ type: 'text', nullable: true })
	attachmentNames?: string | null;

	/**
	 * The idempotency key of a send (unique per author) or of an app post (the webhook's `nonce` / `Idempotency-Key`,
	 * unique per webhook). Compared case-sensitively on every dialect (on MySQL `utf8mb4_0900_bin`, MariaDB's NO PAD
	 * binary collation, or what an older server has, migration `1791000008700`).
	 */
	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	nonce?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 120, nullable: true })
	appName?: string | null;

	/** The incoming webhook that posted an app message (`kind: app`). */
	@MultiORMColumn({ nullable: true })
	webhookId?: ID;

	/** The icon of the webhook at the time of the post (https). */
	@MultiORMColumn({ type: 'varchar', length: 2048, nullable: true })
	appIconUrl?: string | null;

	/** JSON `IChatAppBlock[]`: the structured layout of an app message, plain text throughout. */
	@MultiORMColumn({ type: 'text', nullable: true })
	blocks?: string | null;

	/** The assistant the author wrote the message with (an AI client posting in their name). */
	@MultiORMColumn({ type: 'varchar', length: 120, nullable: true })
	assistedBy?: string | null;
}

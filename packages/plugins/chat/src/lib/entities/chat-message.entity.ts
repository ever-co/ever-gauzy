import { ChatMessageKindEnum, ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatMessageRepository } from './chat.repositories';

/**
 * `chat_message`: a message of a conversation, a thread reply (`threadRootId`), a system row or an app post.
 * The body is a markdown subset with mention tokens (`<@employeeId>`, `<#conversationId>`, `<!channel>`,
 * `<!here>`); `mentionEmployeeIds` and `attachmentIds` are JSON arrays stored as text (the same on the three
 * databases). A deleted message keeps its row (soft delete through the base `deletedAt`) with an empty body when
 * it roots a thread, so the replies keep their context.
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

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	nonce?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 120, nullable: true })
	appName?: string | null;
}

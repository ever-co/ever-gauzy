import { ChatMemberRoleEnum, ChatNotifyLevelEnum, ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatMemberRepository } from './chat.repositories';

/**
 * `chat_member`: one employee's membership in a conversation and their own unread state. `userId` is carried
 * beside `employeeId` so an addressed real-time event can name its recipients without a join. Counters, not
 * count queries: `readCount` and `mentionCount` are written in the same statement as the message.
 */
@MultiORMEntity('chat_member', { mikroOrmRepository: () => MikroOrmChatMemberRepository })
export class ChatMember extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	conversationId!: ID;

	@MultiORMColumn()
	employeeId!: ID;

	@MultiORMColumn()
	userId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatMemberRoleEnum.MEMBER })
	role!: ChatMemberRoleEnum;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatNotifyLevelEnum.ALL })
	notifyLevel!: ChatNotifyLevelEnum;

	@MultiORMColumn({ default: false })
	isFavorite!: boolean;

	@MultiORMColumn({ type: 'int', default: 0 })
	readCount!: number;

	@MultiORMColumn({ type: 'int', default: 0 })
	mentionCount!: number;

	@MultiORMColumn({ nullable: true })
	lastReadMessageId?: ID;

	@MultiORMColumn({ nullable: true })
	lastReadAt?: Date;

	@MultiORMColumn({ nullable: true })
	joinedAt?: Date;

	/** Set when the member left or was removed; the row stays so history and counters keep their meaning. */
	@MultiORMColumn({ nullable: true })
	leftAt?: Date;
}

import { ChatConversationKindEnum, ChatVisibilityEnum, ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatConversationRepository } from './chat.repositories';

/**
 * `chat_conversation`: a channel (named, public or private), a direct conversation (two people) or a group (three
 * or more). `messageCount` and `lastMessageAt` are maintained in the message write; a member's unread count is
 * `messageCount − member.readCount`. A direct or group conversation carries a `directKey` (the sorted user ids,
 * hashed) that is unique per organization (`tenantId`, `organizationId`, `directKey`), so the same people always land
 * in the same conversation of an organization.
 *
 * Nullable columns are typed `?: T` without `| null` (TypeORM refuses `Object` as a column type under
 * `strictNullChecks`), except where an explicit `type` is given.
 */
@MultiORMEntity('chat_conversation', { mikroOrmRepository: () => MikroOrmChatConversationRepository })
export class ChatConversation extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ type: 'varchar', length: 16 })
	kind!: ChatConversationKindEnum;

	@MultiORMColumn({ type: 'varchar', length: 120, nullable: true })
	name?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	topic?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatVisibilityEnum.PUBLIC })
	visibility!: ChatVisibilityEnum;

	@MultiORMColumn({ nullable: true })
	categoryId?: ID;

	@MultiORMColumn({ type: 'int', default: 0 })
	position!: number;

	@MultiORMColumn({ default: false })
	isDefault!: boolean;

	@MultiORMColumn({ nullable: true })
	createdByEmployeeId?: ID;

	@MultiORMColumn({ type: 'int', default: 0 })
	messageCount!: number;

	@MultiORMColumn({ nullable: true })
	lastMessageAt?: Date;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	directKey?: string | null;
}

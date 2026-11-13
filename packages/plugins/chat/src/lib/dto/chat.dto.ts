import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	MinLength,
	Min,
	ValidateNested
} from 'class-validator';
import {
	CHAT_GROUP_MAX_MEMBERS,
	CHAT_LINK_PREVIEW_URL_MAX_LENGTH,
	CHAT_MESSAGE_MAX_ATTACHMENTS,
	CHAT_MESSAGE_MAX_LENGTH,
	CHAT_REORDER_MAX_CATEGORIES,
	CHAT_REORDER_MAX_CHANNELS,
	ChatNotifyLevelEnum,
	ChatVisibilityEnum,
	IChatCategoryChannelOrder,
	IChatCategoryInput,
	IChatCategoryReorderInput,
	IChatConversationCreateInput,
	IChatConversationUpdateInput,
	IChatCreateTaskInput,
	IChatFilesQuery,
	IChatLinkPreviewQuery,
	IChatSearchQuery,
	IChatDirectInput,
	IChatMemberStateInput,
	IChatMembersInput,
	IChatMessageCreateInput,
	IChatMessagesQuery,
	IChatMessageUpdateInput,
	IChatReadInput,
	IChatTaskUpdateInput,
	IChatTypingInput,
	ID
} from '@gauzy/contracts';
import { CHAT_MAX_PAGE_SIZE } from '../chat.constants';

export class ChatCategoryDTO implements IChatCategoryInput {
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	name!: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	position?: number;
}

export class ChatCategoryUpdateDTO implements Partial<IChatCategoryInput> {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	name?: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	position?: number;
}

export class ChatConversationCreateDTO implements IChatConversationCreateInput {
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	name!: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	topic?: string | null;

	@ApiPropertyOptional({ enum: ChatVisibilityEnum })
	@IsOptional()
	@IsEnum(ChatVisibilityEnum)
	visibility?: ChatVisibilityEnum;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	categoryId?: ID | null;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	memberEmployeeIds?: ID[];
}

export class ChatConversationUpdateDTO implements IChatConversationUpdateInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(120)
	name?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	topic?: string | null;

	@ApiPropertyOptional({ enum: ChatVisibilityEnum })
	@IsOptional()
	@IsEnum(ChatVisibilityEnum)
	visibility?: ChatVisibilityEnum;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@IsOptional()
	@IsUUID()
	categoryId?: ID | null;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	position?: number;
}

export class ChatDirectDTO implements IChatDirectInput {
	@ApiProperty({ type: () => [String], description: 'The other employees; at most 49.' })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(CHAT_GROUP_MAX_MEMBERS - 1)
	@IsUUID('all', { each: true })
	employeeIds!: ID[];
}

export class ChatMembersDTO implements IChatMembersInput {
	@ApiProperty({ type: () => [String] })
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	employeeIds!: ID[];
}

export class ChatMemberStateDTO implements IChatMemberStateInput {
	@ApiPropertyOptional({ enum: ChatNotifyLevelEnum })
	@IsOptional()
	@IsEnum(ChatNotifyLevelEnum)
	notifyLevel?: ChatNotifyLevelEnum;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	isFavorite?: boolean;
}

export class ChatReadDTO implements IChatReadInput {
	@ApiPropertyOptional({ type: () => String, description: 'Read up to this message; omitted: everything.' })
	@IsOptional()
	@IsUUID()
	messageId?: ID;
}

export class ChatMessageCreateDTO implements IChatMessageCreateInput {
	@ApiPropertyOptional({
		type: () => String,
		maxLength: CHAT_MESSAGE_MAX_LENGTH,
		description: 'The text; may be empty or left out when the message carries at least one attachment.'
	})
	@IsOptional()
	@IsString()
	@MaxLength(CHAT_MESSAGE_MAX_LENGTH)
	body?: string;

	@ApiPropertyOptional({ type: () => String, description: 'Idempotency key chosen by the client.' })
	@IsOptional()
	@IsString()
	@MaxLength(64)
	nonce?: string;

	@ApiPropertyOptional({ type: () => String, maxLength: 120, description: 'The assistant the sender wrote the message with (an AI client posting in their name).' })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	assistedBy?: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	replyToId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	threadRootId?: ID;

	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	alsoInConversation?: boolean;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(CHAT_MESSAGE_MAX_ATTACHMENTS)
	@IsUUID('all', { each: true })
	attachmentIds?: ID[];

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(100)
	@IsUUID('all', { each: true })
	mentionEmployeeIds?: ID[];

	@ApiPropertyOptional({ type: () => String, description: '"Send to chat": the task to attach as a card.' })
	@IsOptional()
	@IsUUID()
	taskId?: ID;
}

export class ChatMessageUpdateDTO implements IChatMessageUpdateInput {
	@ApiProperty({
		type: () => String,
		maxLength: CHAT_MESSAGE_MAX_LENGTH,
		description: 'The new text; may be empty when the message, after the edit, carries at least one attachment.'
	})
	@IsString()
	@MaxLength(CHAT_MESSAGE_MAX_LENGTH)
	body!: string;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(CHAT_MESSAGE_MAX_ATTACHMENTS)
	@IsUUID('all', { each: true })
	attachmentIds?: ID[];

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(100)
	@IsUUID('all', { each: true })
	mentionEmployeeIds?: ID[];
}

export class ChatFilesQueryDTO implements IChatFilesQuery {
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: CHAT_MAX_PAGE_SIZE })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(CHAT_MAX_PAGE_SIZE)
	limit?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	skip?: number;
}

export class ChatSearchQueryDTO implements IChatSearchQuery {
	@ApiProperty({ type: () => String, description: 'The free-text query.' })
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	q!: string;

	@ApiPropertyOptional({ type: () => String, description: 'One of my conversations to search in.' })
	@IsOptional()
	@IsUUID()
	conversationId?: ID;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: CHAT_MAX_PAGE_SIZE })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(CHAT_MAX_PAGE_SIZE)
	limit?: number;

	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	skip?: number;
}

export class ChatLinkPreviewQueryDTO implements IChatLinkPreviewQuery {
	@ApiProperty({ type: () => String, maxLength: CHAT_LINK_PREVIEW_URL_MAX_LENGTH, description: 'The http(s) link to preview.' })
	@IsString()
	@MinLength(1)
	@MaxLength(CHAT_LINK_PREVIEW_URL_MAX_LENGTH)
	url!: string;
}

export class ChatMessagesQueryDTO implements IChatMessagesQuery {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	before?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	after?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	around?: ID;

	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: CHAT_MAX_PAGE_SIZE })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(CHAT_MAX_PAGE_SIZE)
	limit?: number;
}

export class ChatReactionDTO {
	@ApiProperty({ type: () => String })
	@IsString()
	@MinLength(1)
	@MaxLength(32)
	emoji!: string;
}

export class ChatCreateTaskDTO implements IChatCreateTaskInput {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	projectId?: ID;

	@ApiPropertyOptional({ type: () => String, description: "The team the task belongs to (the team's lists show it)." })
	@IsOptional()
	@IsUUID()
	organizationTeamId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@IsUUID('all', { each: true })
	assigneeEmployeeIds?: ID[];
}

export class ChatRestoreReadDTO {
	@ApiProperty({ type: () => String, description: 'The undo handle a mark-all-read answered (opaque).' })
	@IsString()
	@MaxLength(200_000)
	snapshotId!: string;
}

export class ChatTaskUpdateDTO implements IChatTaskUpdateInput {
	@ApiPropertyOptional({ type: () => String, description: "The status's name (a board column), as the task page writes it." })
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	status?: string;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: 'The status record, when the status is one.' })
	@IsOptional()
	@IsUUID()
	taskStatusId?: ID | null;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: "The priority's name; null clears it." })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	priority?: string | null;

	@ApiPropertyOptional({ type: () => String, nullable: true, description: 'The priority record, when the priority is one.' })
	@IsOptional()
	@IsUUID()
	taskPriorityId?: ID | null;

	@ApiPropertyOptional({ type: () => [String], description: 'All the assignees (an empty list unassigns everyone).' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(50)
	@IsUUID('all', { each: true })
	assigneeEmployeeIds?: ID[];
}

export class ChatTypingDTO implements IChatTypingInput {
	@ApiPropertyOptional({ type: () => String, description: 'The thread I am typing in; left out for the conversation itself.' })
	@IsOptional()
	@IsUUID()
	threadRootId?: ID;
}

export class ChatCategoryChannelOrderDTO implements IChatCategoryChannelOrder {
	@ApiProperty({ type: () => String, nullable: true, description: 'The category; null for the uncategorized channels.' })
	@IsOptional()
	@IsUUID()
	categoryId!: ID | null;

	@ApiProperty({ type: () => [String], description: 'Its channels, first to last.' })
	@IsArray()
	@ArrayMaxSize(CHAT_REORDER_MAX_CHANNELS)
	@IsUUID('all', { each: true })
	conversationIds!: ID[];
}

export class ChatCategoryReorderDTO implements IChatCategoryReorderInput {
	@ApiProperty({ type: () => [String], description: "The organization's categories, first to last." })
	@IsArray()
	@ArrayMaxSize(CHAT_REORDER_MAX_CATEGORIES)
	@IsUUID('all', { each: true })
	categoryIds!: ID[];

	@ApiPropertyOptional({ type: () => [ChatCategoryChannelOrderDTO], description: 'The channels of each category, first to last.' })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(CHAT_REORDER_MAX_CATEGORIES + 1)
	@ValidateNested({ each: true })
	@Type(() => ChatCategoryChannelOrderDTO)
	channels?: ChatCategoryChannelOrderDTO[];
}

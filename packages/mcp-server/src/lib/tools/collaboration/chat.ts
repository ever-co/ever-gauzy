// @ts-nocheck
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../../common/api-client';
import { answer, query, registerCollaborationTool, scope } from './collaboration-tool';

const CHAT = '/api/chat';

/** A conversation as the tools list it: the row's identity and the caller's state, no member list. */
export function conversationSummary(conversation: Record<string, any>) {
	const state = conversation.state ?? null;
	return {
		id: conversation.id,
		name: conversation.name ?? null,
		kind: conversation.kind ?? conversation.type ?? null,
		visibility: conversation.visibility ?? null,
		topic: conversation.topic ?? null,
		categoryId: conversation.categoryId ?? null,
		memberCount: conversation.memberCount ?? null,
		lastMessageAt: conversation.lastMessageAt ?? null,
		isArchived: !!conversation.isArchived,
		unreadCount: state?.unreadCount ?? 0,
		mentionCount: state?.mentionCount ?? 0,
		isFavorite: !!state?.isFavorite,
		notifyLevel: state?.notifyLevel ?? null
	};
}

/** A message as the tools answer it: who, when, the body, the thread it is in, the attachments' names. */
export function messageSummary(message: Record<string, any>) {
	return {
		id: message.id,
		conversationId: message.conversationId,
		body: message.body ?? '',
		senderEmployeeId: message.senderEmployeeId ?? message.employeeId ?? null,
		sender: message.sender ?? message.employee ?? null,
		createdAt: message.createdAt ?? null,
		editedAt: message.editedAt ?? null,
		replyToId: message.replyToId ?? null,
		threadRootId: message.threadRootId ?? null,
		replyCount: message.replyCount ?? 0,
		reactions: message.reactions ?? [],
		attachments: (message.attachments ?? []).map((attachment: Record<string, any>) => ({ id: attachment.id, name: attachment.name ?? attachment.fileName ?? null })),
		taskId: message.taskId ?? null,
		isDeleted: !!message.deletedAt
	};
}

/** The chat tools: the reads under `chat:read`, the writes under `chat:write`. */
export function registerChatTools(server: McpServer, access: { read: boolean; write: boolean }): void {
	if (!access.read) return;

	registerCollaborationTool(
		server,
		'list_chat_conversations',
		"The signed-in user's conversations — channels, groups and direct messages — with their unread and mention counts, and the channel categories. Reads GET /chat/conversations.",
		{
			includeArchived: z.boolean().optional().describe('Also list the archived conversations (default false)')
		},
		async (args) => {
			const list = await apiClient.get<Record<string, any>>(`${CHAT}/conversations`, { params: scope() });
			const conversations = (list?.conversations ?? [])
				.map(conversationSummary)
				.filter((conversation) => args.includeArchived || !conversation.isArchived);
			return answer({ conversations, categories: list?.categories ?? [] });
		}
	);

	registerCollaborationTool(
		server,
		'list_chat_messages',
		'A page of messages of one of my conversations, newest first by default; `before` an id pages back, `after` pages forward, `around` centres on a message. Reads GET /chat/conversations/:id/messages.',
		{
			conversationId: z.string().uuid().describe('The conversation'),
			before: z.string().uuid().optional().describe('Messages older than this message id'),
			after: z.string().uuid().optional().describe('Messages newer than this message id'),
			around: z.string().uuid().optional().describe('A window around this message id'),
			limit: z.number().int().min(1).max(100).optional().describe('How many (default 50)')
		},
		async (args) => {
			const page = await apiClient.get<Record<string, any>>(`${CHAT}/conversations/${args.conversationId}/messages`, {
				params: query({ ...scope(), before: args.before, after: args.after, around: args.around, limit: args.limit })
			});
			return answer({ messages: (page?.messages ?? []).map(messageSummary), hasBefore: !!page?.hasBefore, hasAfter: !!page?.hasAfter });
		}
	);

	registerCollaborationTool(
		server,
		'get_chat_thread',
		'A message and the replies under it (its thread), oldest reply first. Reads GET /chat/messages/:id/thread.',
		{ messageId: z.string().uuid().describe('The thread root, or any message of the thread') },
		async (args) => {
			const thread = await apiClient.get<Record<string, any>>(`${CHAT}/messages/${args.messageId}/thread`, { params: scope() });
			const root = thread?.root ?? thread?.message ?? null;
			return answer({
				root: root ? messageSummary(root) : null,
				replies: (thread?.replies ?? thread?.messages ?? []).map(messageSummary),
				followed: thread?.followed ?? thread?.isFollowing ?? null
			});
		}
	);

	registerCollaborationTool(
		server,
		'search_chat_messages',
		'Searches the messages of my conversations for a text, best match first; `conversationId` narrows to one conversation. Reads GET /chat/search (the chat search; not found where the server does not offer it).',
		{
			q: z.string().min(1).max(200).describe('The text to search for'),
			conversationId: z.string().uuid().optional().describe('Search this conversation only'),
			limit: z.number().int().min(1).max(100).optional().describe('How many (default 20)'),
			skip: z.number().int().min(0).optional().describe('Skip the first N matches')
		},
		async (args) => {
			const result = await apiClient.get<Record<string, any>>(`${CHAT}/search`, {
				params: query({ ...scope(), q: args.q, conversationId: args.conversationId, limit: args.limit, skip: args.skip })
			});
			return answer({ messages: (result?.messages ?? []).map(messageSummary), total: result?.total ?? null, hasMore: !!result?.hasMore });
		}
	);

	if (!access.write) return;

	registerCollaborationTool(
		server,
		'post_chat_message',
		"Posts a message in one of my conversations, in the signed-in user's name — a reply in a thread when `threadRootId` is given. The message is visible to the user at once in their chat. Writes POST /chat/conversations/:id/messages.",
		{
			conversationId: z.string().uuid().describe('The conversation'),
			body: z.string().min(1).max(10000).describe('The message text (Markdown)'),
			threadRootId: z.string().uuid().optional().describe('Reply under this message (a thread)'),
			replyToId: z.string().uuid().optional().describe('The message this one answers'),
			mentionEmployeeIds: z.array(z.string().uuid()).max(100).optional().describe('Employees mentioned in the body'),
			idempotencyKey: z.string().max(64).optional().describe('A key of the client: the same key posts once')
		},
		async (args) => {
			const sent = await apiClient.post<Record<string, any>>(
				`${CHAT}/conversations/${args.conversationId}/messages`,
				{
					...scope(),
					body: args.body,
					...(args.threadRootId ? { threadRootId: args.threadRootId } : {}),
					...(args.replyToId ? { replyToId: args.replyToId } : {}),
					...(args.mentionEmployeeIds ? { mentionEmployeeIds: args.mentionEmployeeIds } : {}),
					...(args.idempotencyKey ? { nonce: args.idempotencyKey } : {})
				}
			);
			return answer({ message: messageSummary(sent?.message ?? sent ?? {}) });
		}
	);

	registerCollaborationTool(
		server,
		'mark_chat_conversation_read',
		'Marks one of my conversations read — up to a message, or everything. Writes POST /chat/conversations/:id/read.',
		{
			conversationId: z.string().uuid().describe('The conversation'),
			messageId: z.string().uuid().optional().describe('Read up to this message; omitted: everything')
		},
		async (args) => {
			const state = await apiClient.post<Record<string, any>>(`${CHAT}/conversations/${args.conversationId}/read`, {
				...scope(),
				...(args.messageId ? { messageId: args.messageId } : {})
			});
			return answer({ state: state ?? null });
		}
	);
}

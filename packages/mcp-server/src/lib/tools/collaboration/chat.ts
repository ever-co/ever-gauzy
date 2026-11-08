import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../../common/api-client';
import { answer, query, registerCollaborationTool, scope } from './collaboration-tool';

const CHAT = '/api/chat';

/** The most characters of the client's name the platform keeps as the assistant of a message. */
export const ASSISTED_BY_MAX = 120;

/** The low-level server's view of the client: who it is and whether it can ask the person (elicitation). */
interface ClientChannel {
	getClientVersion?: () => { name?: string; title?: string } | undefined;
	getClientCapabilities?: () => { elicitation?: unknown } | undefined;
	elicitInput?: (params: Record<string, unknown>) => Promise<{ action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown> }>;
}

function channelOf(server: McpServer): ClientChannel | undefined {
	return (server as unknown as { server?: ClientChannel }).server;
}

/** The name a message posted through this server is marked with: the MCP client's own (an AI assistant). */
export function assistedByOf(server: McpServer): string {
	const client = channelOf(server)?.getClientVersion?.();
	const name = String(client?.title || client?.name || 'MCP client').trim() || 'MCP client';
	return name.slice(0, ASSISTED_BY_MAX);
}

/**
 * Asks the person to approve a message before it is posted in their name, where the client can ask (MCP
 * elicitation); answers whether to post. A client that cannot ask posts at once — the message is marked as
 * assisted either way.
 */
export async function approvedToPost(server: McpServer, preview: { conversationId: string; body: string; threadRootId?: string }): Promise<{ approved: boolean; asked: boolean; action?: string }> {
	const channel = channelOf(server);
	if (!channel?.getClientCapabilities?.()?.elicitation || !channel.elicitInput) return { approved: true, asked: false };
	const reply = await channel.elicitInput({
		message: `Post this message in your name${preview.threadRootId ? ' (a thread reply)' : ''}? It will be marked as written with an assistant.\n\n${preview.body}`,
		requestedSchema: {
			type: 'object',
			properties: { post: { type: 'boolean', title: 'Post it', description: 'Post the message as shown' } },
			required: ['post']
		}
	});
	return { approved: reply.action === 'accept' && reply.content?.['post'] === true, asked: true, action: reply.action };
}

type Row = Record<string, any>;

/** A conversation as the tools list it: the row's identity and the caller's state, no member list. */
export function conversationSummary(conversation: Row) {
	const state = conversation['state'] ?? null;
	return {
		id: conversation['id'],
		name: conversation['name'] ?? null,
		kind: conversation['kind'] ?? null,
		visibility: conversation['visibility'] ?? null,
		topic: conversation['topic'] ?? null,
		categoryId: conversation['categoryId'] ?? null,
		memberCount: conversation['memberCount'] ?? null,
		lastMessageAt: conversation['lastMessageAt'] ?? null,
		// The archive writes `archivedAt`; the list answers archived conversations too.
		isArchived: !!conversation['archivedAt'],
		unreadCount: state?.unreadCount ?? 0,
		mentionCount: state?.mentionCount ?? 0,
		isFavorite: !!state?.isFavorite,
		notifyLevel: state?.notifyLevel ?? null
	};
}

/** A message as the tools answer it, in the chat API's own fields: who, when, the body, the thread, files and tasks. */
export function messageSummary(message: Row) {
	return {
		id: message['id'],
		conversationId: message['conversationId'],
		kind: message['kind'] ?? null,
		body: message['body'] ?? '',
		authorEmployeeId: message['authorEmployeeId'] ?? null,
		authorUserId: message['authorUserId'] ?? null,
		appName: message['appName'] ?? null,
		assistedBy: message['assistedBy'] ?? null,
		createdAt: message['createdAt'] ?? null,
		editedAt: message['editedAt'] ?? null,
		replyToId: message['replyToId'] ?? null,
		threadRootId: message['threadRootId'] ?? null,
		replyCount: message['replyCount'] ?? 0,
		reactions: message['reactions'] ?? [],
		// Files are documents of the Docs plugin, named by id.
		attachmentIds: message['attachmentIds'] ?? [],
		taskReferences: (message['taskReferences'] ?? []).map((reference: Row) => ({ taskId: reference['taskId'], kind: reference['kind'] })),
		isDeleted: !!message['deletedAt']
	};
}

/** A page of messages as the API answers it: oldest first within the page. */
function page(answerOf: Row | undefined) {
	return {
		messages: (answerOf?.['messages'] ?? []).map(messageSummary),
		hasBefore: !!answerOf?.['hasBefore'],
		hasAfter: !!answerOf?.['hasAfter']
	};
}

/** The chat tools: the reads under `chat:read`, the writes under `chat:write`. */
export function registerChatTools(server: McpServer, access: { read: boolean; write: boolean }): void {
	if (!access.read) return;

	registerCollaborationTool<{ includeArchived?: boolean }>(
		server,
		'list_chat_conversations',
		"The signed-in user's conversations — channels, groups and direct messages — with their unread and mention counts, and the channel categories. Reads GET /chat/conversations.",
		{
			includeArchived: z.boolean().optional().describe('Also list the archived conversations (default false)')
		},
		async (args) => {
			const list = await apiClient.get<Row>(`${CHAT}/conversations`, { params: scope() });
			const conversations = (list?.['conversations'] ?? [])
				.map(conversationSummary)
				.filter((conversation: ReturnType<typeof conversationSummary>) => args.includeArchived || !conversation.isArchived);
			return answer({ conversations, categories: list?.['categories'] ?? [] });
		}
	);

	registerCollaborationTool<{ conversationId: string; before?: string; after?: string; around?: string; limit?: number }>(
		server,
		'list_chat_messages',
		'A page of messages of one of my conversations, oldest first within the page: the newest page by default; `before` a message id pages back (while `hasBefore`), `after` pages forward, `around` centres on a message. Reads GET /chat/conversations/:id/messages.',
		{
			conversationId: z.string().uuid().describe('The conversation'),
			before: z.string().uuid().optional().describe('Messages older than this message id'),
			after: z.string().uuid().optional().describe('Messages newer than this message id'),
			around: z.string().uuid().optional().describe('A window around this message id'),
			limit: z.number().int().min(1).max(100).optional().describe('How many (default 50)')
		},
		async (args) => {
			const answerOf = await apiClient.get<Row>(`${CHAT}/conversations/${args.conversationId}/messages`, {
				params: query({ ...scope(), before: args.before, after: args.after, around: args.around, limit: args.limit })
			});
			return answer(page(answerOf));
		}
	);

	registerCollaborationTool<{ messageId: string; before?: string; after?: string; limit?: number }>(
		server,
		'get_chat_thread',
		"A thread: its root message and a page of its replies, oldest first; `hasBefore` / `hasAfter` say whether more replies exist, `before` / `after` a reply id page through them. A reply's id is accepted too: its thread is answered. Reads GET /chat/messages/:id/thread.",
		{
			messageId: z.string().uuid().describe("The thread's root message, or one of its replies"),
			before: z.string().uuid().optional().describe('Replies older than this reply id'),
			after: z.string().uuid().optional().describe('Replies newer than this reply id'),
			limit: z.number().int().min(1).max(100).optional().describe('How many replies (default 50)')
		},
		async (args) => {
			const read = (id: string, cursors: boolean) =>
				apiClient.get<Row>(`${CHAT}/messages/${id}/thread`, {
					params: query({ ...scope(), ...(cursors ? { before: args.before, after: args.after } : {}), limit: cursors ? args.limit : 1 })
				});
			// The route answers the message it is given as the root, and a cursor must be a reply of that root: the root is
			// found first (a reply names it), then its thread is read with the cursors.
			const hasCursor = !!(args.before || args.after);
			let thread = await read(args.messageId, !hasCursor);
			const rootOf = thread?.['root']?.['threadRootId'];
			const rootId = rootOf && rootOf !== args.messageId ? String(rootOf) : args.messageId;
			if (hasCursor || rootId !== args.messageId) thread = await read(rootId, true);
			const root = thread?.['root'] ?? null;
			return answer({ root: root ? messageSummary(root) : null, ...page(thread), following: root?.['following'] ?? null });
		}
	);

	registerCollaborationTool<{ q: string; conversationId?: string; limit?: number; skip?: number }>(
		server,
		'search_chat_messages',
		'Searches the messages of my conversations for a text, best match first; `conversationId` narrows to one conversation. Reads GET /chat/search.',
		{
			q: z.string().min(1).max(200).describe('The text to search for'),
			conversationId: z.string().uuid().optional().describe('Search this conversation only'),
			limit: z.number().int().min(1).max(100).optional().describe('How many (default 20)'),
			skip: z.number().int().min(0).optional().describe('Skip the first N matches')
		},
		async (args) => {
			const result = await apiClient.get<Row>(`${CHAT}/search`, {
				params: query({ ...scope(), q: args.q, conversationId: args.conversationId, limit: args.limit, skip: args.skip })
			});
			return answer({ messages: (result?.['messages'] ?? []).map(messageSummary), total: result?.['total'] ?? null, hasMore: !!result?.['hasMore'] });
		}
	);

	if (!access.write) return;

	registerCollaborationTool<{ conversationId: string; body: string; threadRootId?: string; replyToId?: string; mentionEmployeeIds?: string[]; idempotencyKey?: string }>(
		server,
		'post_chat_message',
		"Posts a message in one of my conversations, in the signed-in user's name — a reply in a thread when `threadRootId` is given — marked as written with an assistant (the client's name). Where the client supports it, the person approves the message first; declined, nothing is posted (`posted: false`). Writes POST /chat/conversations/:id/messages.",
		{
			conversationId: z.string().uuid().describe('The conversation'),
			body: z.string().min(1).max(10000).describe('The message text (Markdown)'),
			threadRootId: z.string().uuid().optional().describe('Reply under this message (a thread)'),
			replyToId: z.string().uuid().optional().describe('The message this one answers'),
			mentionEmployeeIds: z.array(z.string().uuid()).max(100).optional().describe('Employees mentioned in the body'),
			idempotencyKey: z.string().max(64).optional().describe('A key of the client: the same key posts once')
		},
		async (args) => {
			const approval = await approvedToPost(server, { conversationId: args.conversationId, body: args.body, threadRootId: args.threadRootId });
			if (!approval.approved) return answer({ posted: false, reason: approval.action === 'cancel' ? 'cancelled' : 'declined' });
			const sent = await apiClient.post<Row>(`${CHAT}/conversations/${args.conversationId}/messages`, {
				...scope(),
				body: args.body,
				// What people see next to the message: it was written with an assistant, and which one.
				assistedBy: assistedByOf(server),
				...(args.threadRootId ? { threadRootId: args.threadRootId } : {}),
				...(args.replyToId ? { replyToId: args.replyToId } : {}),
				...(args.mentionEmployeeIds ? { mentionEmployeeIds: args.mentionEmployeeIds } : {}),
				...(args.idempotencyKey ? { nonce: args.idempotencyKey } : {})
			});
			return answer({ posted: true, approvedByPerson: approval.asked, message: messageSummary(sent?.['message'] ?? sent ?? {}) });
		}
	);

	registerCollaborationTool<{ conversationId: string; messageId?: string }>(
		server,
		'mark_chat_conversation_read',
		'Marks one of my conversations read — up to a message, or everything. Writes POST /chat/conversations/:id/read.',
		{
			conversationId: z.string().uuid().describe('The conversation'),
			messageId: z.string().uuid().optional().describe('Read up to this message; omitted: everything')
		},
		async (args) => {
			const state = await apiClient.post<Row>(`${CHAT}/conversations/${args.conversationId}/read`, {
				...scope(),
				...(args.messageId ? { messageId: args.messageId } : {})
			});
			return answer({ state: state ?? null });
		}
	);
}

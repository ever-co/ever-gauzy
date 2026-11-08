import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../../common/api-client';
import { answer, query, registerCollaborationTool, scope } from './collaboration-tool';

const INBOX = '/api/inbox/items';

type Row = Record<string, any>;

/** An entry as the tools answer it, with the caller's own state. */
export function entrySummary(item: Row) {
	const recipient = item.recipient ?? null;
	return {
		id: item.id,
		kind: item.kind,
		source: item.source,
		status: item.status ?? null,
		priority: item.priority ?? null,
		title: item.title,
		body: item.body ?? null,
		dueAt: item.dueAt ?? null,
		taskId: item.taskId ?? null,
		projectId: item.projectId ?? null,
		entity: item.entity ?? null,
		entityId: item.entityId ?? null,
		createdAt: item.createdAt ?? null,
		// A question or an approval: its choices, whether an answer needs a reason, and the answer given.
		...(item['options'] || item['response'] || item['requireReason']
			? {
					decision: {
						options: (item['options'] ?? []).map((option: Row) => ({ id: option['id'], label: option['label'] ?? null, description: option['description'] ?? null, recommended: !!option['recommended'] })),
						requireReason: !!item['requireReason'],
						response: item['response'] ?? null
					}
				}
			: {}),
		state: recipient
			? { isRead: !!recipient.isRead, isArchived: !!recipient.isArchived, snoozedUntil: recipient.snoozedUntil ?? null, isDone: recipient.isDone ?? !!recipient.doneAt }
			: null
	};
}

/** The inbox tools: the reads under `inbox:read`, the writes under `inbox:write`. */
export function registerInboxTools(server: McpServer, access: { read: boolean; write: boolean }): void {
	if (!access.read) return;

	registerCollaborationTool<{ tab?: string; kind?: string; source?: string; unread?: boolean; q?: string; cursor?: string; limit?: number }>(
		server,
		'list_inbox_items',
		"The signed-in user's inbox: a tab (all, decisions, email, snoozed, done, archived), the filters, a page by cursor, newest first. Reads GET /inbox/items.",
		{
			tab: z.enum(['all', 'decisions', 'email', 'snoozed', 'done', 'archived']).optional().describe('Which tab (default all: the open entries)'),
			kind: z.enum(['QUESTION', 'APPROVAL', 'ESCALATION', 'NOTICE', 'NOTIFICATION', 'EMAIL']).optional().describe('One kind'),
			source: z.string().max(32).optional().describe('One source (GAUZY, EVER_WORKS, EMAIL, SYSTEM, …)'),
			unread: z.boolean().optional().describe('Unread only'),
			q: z.string().max(200).optional().describe('A text to search the titles and bodies for'),
			cursor: z.string().max(400).optional().describe("The previous answer's nextCursor"),
			limit: z.number().int().min(1).max(100).optional().describe('How many (default 20)')
		},
		async (args) => {
			const page = await apiClient.get<Row>(INBOX, {
				params: query({ ...scope(), tab: args.tab, kind: args.kind, source: args.source, unread: args.unread, q: args.q, cursor: args.cursor, limit: args.limit })
			});
			return answer({ items: (page?.['items'] ?? []).map(entrySummary), nextCursor: page?.['nextCursor'] ?? null });
		}
	);

	registerCollaborationTool<Record<string, never>>(
		server,
		'get_inbox_counts',
		"The signed-in user's unread count, open decisions and unread email. Reads GET /inbox/items/counts.",
		{},
		async () => answer({ counts: await apiClient.get<unknown>(`${INBOX}/counts`, { params: scope() }) })
	);

	if (!access.write) return;

	registerCollaborationTool<{ itemId: string; isRead?: boolean; isArchived?: boolean; snoozedUntil?: string | null; isDone?: boolean }>(
		server,
		'set_inbox_item_state',
		"Changes the signed-in user's own state of an entry: read or unread, archived, snoozed until a time (null wakes it), done or not. Writes PATCH /inbox/items/:id/state.",
		{
			itemId: z.string().uuid().describe('The entry'),
			isRead: z.boolean().optional(),
			isArchived: z.boolean().optional(),
			snoozedUntil: z.string().datetime({ offset: true }).nullable().optional().describe('Hide until this ISO time; null wakes it'),
			isDone: z.boolean().optional()
		},
		async (args) => {
			const change: Record<string, unknown> = query({ isRead: args.isRead, isArchived: args.isArchived, isDone: args.isDone });
			if (args.snoozedUntil !== undefined) change.snoozedUntil = args.snoozedUntil;
			if (!Object.keys(change).length) throw new Error('State a change: isRead, isArchived, snoozedUntil or isDone.');
			const item = await apiClient.patch<Row>(`${INBOX}/${args.itemId}/state`, { ...scope(), ...change });
			return answer({ item: entrySummary(item ?? {}) });
		}
	);
}

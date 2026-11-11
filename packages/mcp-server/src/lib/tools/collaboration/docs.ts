import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiClient } from '../../common/api-client';
import { answer, describeError, query, registerCollaborationTool, scope } from './collaboration-tool';

const DOCS = '/api/plugins/docs';

type Row = Record<string, any>;

/** The most Markdown characters one `get_page` answers; the rest follows from `offset`. */
export const PAGE_MARKDOWN_MAX = 60_000;

/** The knowledge search's own limits (`KnowledgeSearchDTO`): a query of 2–500 characters, 12 passages, 20 documents. */
export const KNOWLEDGE_QUERY_MIN = 2;
export const KNOWLEDGE_QUERY_MAX = 500;
export const KNOWLEDGE_TOP_K_MAX = 12;
export const KNOWLEDGE_DOCUMENTS_MAX = 20;

/** A page as the tools list it. */
export function pageSummary(document: Row) {
	return {
		id: document['id'],
		name: document['name'],
		kind: document['kind'],
		parentId: document['parentId'] ?? null,
		index: document['index'] ?? null,
		icon: document['icon'] ?? null,
		description: document['description'] ?? null,
		visibility: document['visibility'] ?? null,
		organizationTeamId: document['organizationTeamId'] ?? null,
		isLocked: !!document['isLocked'],
		revision: Number(document['contentRevision']) || null,
		createdAt: document['createdAt'] ?? null,
		updatedAt: document['updatedAt'] ?? null
	};
}

/** A slice of a Markdown text: `offset` characters in, at most `limit`, and where the next slice starts. */
export function slice(markdown: string, offset = 0, limit = PAGE_MARKDOWN_MAX): { markdown: string; offset: number; truncated: boolean; nextOffset: number | null; length: number } {
	const start = Math.max(0, Math.min(Number(offset) || 0, markdown.length));
	const end = Math.min(markdown.length, start + Math.max(1, Math.min(Number(limit) || PAGE_MARKDOWN_MAX, PAGE_MARKDOWN_MAX)));
	return { markdown: markdown.slice(start, end), offset: start, truncated: end < markdown.length, nextOffset: end < markdown.length ? end : null, length: markdown.length };
}

/** The docs tools: the reads under `docs:read`, the writes under `docs:write`. */
export function registerDocsTools(server: McpServer, access: { read: boolean; write: boolean }): void {
	if (!access.read) return;

	registerCollaborationTool<{ parentId?: string; root?: boolean; space?: string; organizationTeamId?: string; q?: string; kind?: string; includeArchived?: boolean; page?: number; limit?: number }>(
		server,
		'list_pages',
		"The pages (and folders) of the signed-in user's organization: a space (the organization's, the caller's private pages, a team's), a parent's children, or a name search. Reads GET /plugins/docs/documents.",
		{
			parentId: z.string().uuid().optional().describe('The children of this folder or page; omitted with `root`: the top level'),
			root: z.boolean().optional().describe('The top level only'),
			space: z.enum(['organization', 'private', 'team']).optional().describe('Which space'),
			organizationTeamId: z.string().uuid().optional().describe("With space `team`: this team's pages"),
			q: z.string().max(200).optional().describe('A text to search for in the names'),
			kind: z.enum(['PAGE', 'FOLDER', 'FILE']).optional().describe('Pages only, folders only, files only (default pages and folders)'),
			includeArchived: z.boolean().optional().describe('Also the archived ones'),
			page: z.number().int().min(1).optional().describe('The page of the list (default 1)'),
			limit: z.number().int().min(1).max(200).optional().describe('How many per page (default 50)')
		},
		async (args) => {
			const limit = args.limit ?? 50;
			const pageNumber = args.page ?? 1;
			const list = await apiClient.get<Row | Row[]>(`${DOCS}/documents`, {
				params: query({
					...scope(),
					parentId: args.root ? 'root' : args.parentId,
					space: args.space,
					organizationTeamId: args.organizationTeamId,
					q: args.q,
					searchIn: args.q ? 'name' : undefined,
					kind: args.kind ? [args.kind] : ['PAGE', 'FOLDER'],
					archived: args.includeArchived ? 'include' : 'exclude',
					sort: 'updatedAt',
					sortOrder: 'DESC',
					take: limit,
					skip: (pageNumber - 1) * limit
				})
			});
			const items: Row[] = Array.isArray(list) ? list : (list?.['items'] ?? []);
			return answer({ pages: items.map(pageSummary), total: Array.isArray(list) ? items.length : (list?.['total'] ?? items.length), page: pageNumber, limit });
		}
	);

	registerCollaborationTool<{ pageId: string; offset?: number; limit?: number }>(
		server,
		'get_page',
		"One page as Markdown with its metadata and revision (the number `update_page_markdown` checks). The revision is read before the text, so it is never newer than the text it is answered with. A long page is answered in slices: `truncated` with a `nextOffset` to continue from; every slice carries the revision it was read at — slices of different revisions are not one text, so read again from 0 when it changes; `revisionChanged` says a save landed during this read. Reads GET /plugins/docs/documents/:id and /:id/export/markdown.",
		{
			pageId: z.string().uuid().describe('The page'),
			offset: z.number().int().min(0).optional().describe('Continue the Markdown from this character (the previous answer\'s nextOffset)'),
			limit: z.number().int().min(1).max(PAGE_MARKDOWN_MAX).optional().describe(`How many characters at most (default ${PAGE_MARKDOWN_MAX})`)
		},
		async (args) => {
			// The revision first, then the text: a save in between makes the revision older than the text, which the update
			// refuses as a conflict, never newer — a newer revision would let a write over another editor's change through.
			const document = await apiClient.get<Row>(`${DOCS}/documents/${args.pageId}`, { params: scope() });
			const markdown = await apiClient.get<string>(`${DOCS}/documents/${args.pageId}/export/markdown`, {
				params: scope(),
				responseType: 'text',
				transformResponse: [(data: unknown) => data]
			});
			// Read again: a save between the two reads makes this text newer than the revision answered with it.
			const after = await apiClient.get<Row>(`${DOCS}/documents/${args.pageId}`, { params: scope() });
			const revisionChanged = Number(after?.['contentRevision']) !== Number(document?.['contentRevision']);
			return answer({
				page: pageSummary(document ?? {}),
				...slice(String(markdown ?? ''), args.offset, args.limit),
				...(revisionChanged
					? { revisionChanged: true, warning: 'The page was saved while it was read: read it again from offset 0 before joining slices or updating it.' }
					: {})
			});
		}
	);

	registerCollaborationTool<{ query: string; topK?: number; documentIds?: string[] }>(
		server,
		'search_pages',
		"Searches the organization's documents by meaning (the knowledge index) for a question or a phrase: the best-matching passages with their pages. Reads POST /plugins/docs/knowledge/search (the signed-in user's organization).",
		{
			query: z.string().min(KNOWLEDGE_QUERY_MIN).max(KNOWLEDGE_QUERY_MAX).describe(`The question or phrase (${KNOWLEDGE_QUERY_MIN}–${KNOWLEDGE_QUERY_MAX} characters)`),
			topK: z.number().int().min(1).max(KNOWLEDGE_TOP_K_MAX).optional().describe(`How many passages (at most ${KNOWLEDGE_TOP_K_MAX})`),
			documentIds: z.array(z.string().uuid()).max(KNOWLEDGE_DOCUMENTS_MAX).optional().describe(`Search these documents only (at most ${KNOWLEDGE_DOCUMENTS_MAX})`)
		},
		async (args) => {
			// The route's body is the search alone (it refuses any other member); the organization is the request's own.
			const result = await apiClient.post<unknown>(`${DOCS}/knowledge/search`, {
				query: args.query,
				...(args.topK ? { topK: args.topK } : {}),
				...(args.documentIds ? { documentIds: args.documentIds } : {}),
				kinds: ['PAGE']
			});
			return answer({ results: result ?? [] });
		}
	);

	if (!access.write) return;

	registerCollaborationTool<{ name: string; parentId?: string; visibility?: string; organizationTeamId?: string; markdown?: string; description?: string }>(
		server,
		'create_page',
		"Creates a page (under a parent, in a space) in the signed-in user's name, with its text as Markdown when given. Writes POST /plugins/docs/documents, then PUT /:id/content/markdown against the revision the page was created at (an edit made in between is never overwritten); when the text could not be written the page is answered anyway, with `markdownWritten: false`, so the text can be written with update_page_markdown rather than the page created twice.",
		{
			name: z.string().min(1).max(255).describe('The page title'),
			parentId: z.string().uuid().optional().describe('The folder or page to create it under'),
			visibility: z.enum(['ORGANIZATION', 'PRIVATE', 'TEAM']).optional().describe('Who sees it (default the organization)'),
			organizationTeamId: z.string().uuid().optional().describe("With visibility TEAM: the team's space"),
			markdown: z.string().max(2_000_000).optional().describe('The page text as Markdown'),
			description: z.string().max(1000).optional().describe('A short description')
		},
		async (args) => {
			const created = await apiClient.post<Row>(`${DOCS}/documents`, {
				...scope(),
				kind: 'PAGE',
				name: args.name,
				...(args.parentId ? { parentId: args.parentId } : {}),
				...(args.visibility ? { visibility: args.visibility } : {}),
				...(args.organizationTeamId ? { organizationTeamId: args.organizationTeamId } : {}),
				...(args.description ? { description: args.description } : {})
			});
			let revision = Number(created?.['contentRevision']) || null;
			if (args.markdown && created?.['id']) {
				// The text is written against the revision the page was created at: an edit someone made in between is
				// answered as a conflict, never overwritten. Without that revision nothing is written.
				if (!revision) {
					return answer({
						page: { ...pageSummary(created ?? {}), revision },
						markdownWritten: false,
						warning: 'The page was created, but its revision was not answered, so its text was not written: read it with get_page, then write the text with update_page_markdown on this page rather than creating it again.'
					});
				}
				try {
					const updated = await apiClient.put<Row>(`${DOCS}/documents/${created['id']}/content/markdown`, { ...scope(), markdown: args.markdown, expectedRevision: revision });
					revision = Number(updated?.['revision']) || revision;
				} catch (error) {
					const { status } = describeError(error);
					return answer({
						page: { ...pageSummary(created ?? {}), revision },
						markdownWritten: false,
						warning:
							status === 409
								? 'The page was created, but someone changed it before its text was written, so the text was not written: read it with get_page, then apply the text with update_page_markdown rather than creating the page again.'
								: `The page was created, but its text was not written${status ? ` (${status})` : ''}: write it with update_page_markdown on this page rather than creating it again.`
					});
				}
			}
			return answer({ page: { ...pageSummary(created ?? {}), revision }, markdownWritten: !!args.markdown });
		}
	);

	registerCollaborationTool<{ pageId: string; markdown: string; expectedRevision: number }>(
		server,
		'update_page_markdown',
		"Applies a Markdown text to a page: only the blocks whose Markdown changed are replaced (formatting the Markdown cannot carry stays on the others, also on a block the text moved), editors with the page open see it live. `expectedRevision` (from get_page) is required: a page that moved on answers a conflict with its current revision instead of writing. A text that adds, removes or moves one of identical blocks a comment is anchored to answers a conflict with the `blockIds` concerned, nothing written. Writes PUT /plugins/docs/documents/:id/content/markdown.",
		{
			pageId: z.string().uuid().describe('The page'),
			markdown: z.string().max(2_000_000).describe('The whole page as Markdown, as get_page answered it with your changes'),
			expectedRevision: z.number().int().min(1).describe('The revision get_page answered; the write is refused when the page moved on')
		},
		async (args) => {
			try {
				const result = await apiClient.put<Row>(`${DOCS}/documents/${args.pageId}/content/markdown`, {
					...scope(),
					markdown: args.markdown,
					expectedRevision: args.expectedRevision
				});
				return answer({ revision: result?.['revision'] ?? null, changed: !!result?.['changed'], changedBlocks: result?.['changedBlocks'] ?? 0, keptBlocks: result?.['keptBlocks'] ?? 0 });
			} catch (error) {
				const { status, body } = describeError(error);
				if (status === 409) {
					const conflict = body as { currentRevision?: unknown; code?: unknown; blockIds?: unknown } | null;
					const current = typeof conflict?.currentRevision === 'number' ? conflict.currentRevision : null;
					if (conflict?.code === 'DOCS_MARKDOWN_AMBIGUOUS') {
						// Not a stale read: reading the page again gives the same answer for the same text.
						return answer({
							conflict: true,
							currentRevision: current,
							blockIds: Array.isArray(conflict.blockIds) ? conflict.blockIds : [],
							message:
								'Nothing was written: the text adds, removes or moves a block that has an identical twin, so which of the twins a comment belongs to cannot be told. Keep the commented blocks where they are (or make their texts differ) and apply the change again.'
						});
					}
					return answer({ conflict: true, currentRevision: current, message: 'The page changed since the revision stated; read it again (get_page) and apply your change to the current text.' });
				}
				throw error;
			}
		}
	);
}

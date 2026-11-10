/**
 * The docs tools over the wire: an MCP client calls them, they reach the Docs API through the real API client (axios),
 * and a stand-in of the Docs Markdown routes answers on a local port. What is checked is what the unit spec's mocked
 * client cannot see: the requests themselves (method, path, query, body, token), that a page's text travels as
 * Markdown both ways — never as the editor's JSON or HTML — and that a page written as Markdown reads back the same.
 *
 * The stand-in keeps a page as a list of blocks (one per blank-line-separated Markdown block) and keeps the stored
 * block of every unchanged text on an update, as the Docs merge does; the merge itself (TipTap JSON ↔ Markdown, moved
 * and identical blocks) is the docs plugin's `document-markdown.spec`.
 */
jest.mock('../../common/auth-manager', () => ({
	authManager: {
		setApiClient: () => undefined,
		getAuthStatus: () => ({ isLoginInProgress: false, isRefreshInProgress: false }),
		ensureValidToken: async () => true,
		getAccessToken: () => 'spec-token',
		refreshToken: async () => false,
		getDefaultParams: () => ({
			tenantId: '00000000-0000-4000-8000-0000000000a1',
			organizationId: '00000000-0000-4000-8000-0000000000a2'
		}),
		getUserId: () => 'u1'
	}
}));

import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { apiClient } from '../../common/api-client';
import { registerCollaborationTools } from './index';

const TENANT = '00000000-0000-4000-8000-0000000000a1';
const ORGANIZATION = '00000000-0000-4000-8000-0000000000a2';
const FOLDER = '00000000-0000-4000-8000-0000000000f1';
const DOCUMENTS = '/api/plugins/docs/documents';

/** The members `PUT /:id/content/markdown` accepts (`UpdateDocumentMarkdownDTO`, validated with `forbidNonWhitelisted`). */
const MARKDOWN_UPDATE_MEMBERS = ['tenantId', 'organizationId', 'markdown', 'expectedRevision'];

interface Recorded {
	method: string;
	path: string;
	query: Record<string, string>;
	body: Record<string, unknown> | null;
	authorization: string | undefined;
}

interface Block {
	id: string;
	markdown: string;
}

interface Page {
	id: string;
	name: string;
	kind: string;
	parentId: string | null;
	contentRevision: number;
	blocks: Block[];
}

/** A page's Markdown: its blocks, a blank line apart, with a closing newline (as the export writes it). */
function markdownOf(page: Page): string {
	return page.blocks.length ? `${page.blocks.map((block) => block.markdown).join('\n\n')}\n` : '';
}

/** The blocks of a Markdown text (the stand-in's texts keep no blank line inside a block). */
function blocksOf(markdown: string): string[] {
	return markdown
		.replace(/\r\n/g, '\n')
		.split(/\n{2,}/)
		.map((block) => block.replace(/^\n+|\n+$/g, ''))
		.filter(Boolean);
}

/** A stand-in of the Docs routes the tools call, recording every request. */
class DocsStandIn {
	readonly pages = new Map<string, Page>();
	readonly requests: Recorded[] = [];
	private server: Server | null = null;

	async start(): Promise<string> {
		this.server = createServer((req, res) => void this.handle(req, res));
		await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
		return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
	}

	async stop(): Promise<void> {
		this.server?.closeAllConnections();
		await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
	}

	/** Another editor saves the page: its text and a new revision. */
	saveElsewhere(id: string, markdown: string): void {
		const page = this.pages.get(id) as Page;
		page.blocks = blocksOf(markdown).map((text) => ({ id: randomUUID(), markdown: text }));
		page.contentRevision += 1;
	}

	private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const url = new URL(req.url ?? '/', 'http://stand-in');
		const raw = await new Promise<string>((resolve) => {
			let data = '';
			req.setEncoding('utf8');
			req.on('data', (chunk) => (data += chunk));
			req.on('end', () => resolve(data));
		});
		const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
		this.requests.push({
			method: req.method ?? '',
			path: url.pathname,
			query: Object.fromEntries(url.searchParams),
			body,
			authorization: req.headers.authorization
		});

		const json = (status: number, data: unknown) => {
			res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
			res.end(JSON.stringify(data));
		};
		const [, id, ...rest] = url.pathname.startsWith(DOCUMENTS)
			? url.pathname.slice(DOCUMENTS.length).split('/')
			: [];
		const route = `${req.method} ${id === undefined ? '' : id ? ':id' : ''}${rest.length ? `/${rest.join('/')}` : ''}`;
		const page = id ? this.pages.get(id) : undefined;

		if (route === 'POST ' && url.pathname === DOCUMENTS) {
			const created: Page = {
				id: randomUUID(),
				name: String(body?.['name']),
				kind: String(body?.['kind']),
				parentId: (body?.['parentId'] as string) ?? null,
				contentRevision: 1,
				blocks: []
			};
			this.pages.set(created.id, created);
			return json(201, this.row(created));
		}
		if (!page) return json(404, { statusCode: 404, message: 'Not Found' });
		if (route === 'GET :id') return json(200, this.row(page));
		if (route === 'GET :id/export/markdown') {
			res.writeHead(200, {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Content-Disposition': 'attachment; filename="page.md"'
			});
			return void res.end(markdownOf(page));
		}
		if (route === 'PUT :id/content/markdown') {
			const unknownMembers = Object.keys(body ?? {}).filter(
				(member) => !MARKDOWN_UPDATE_MEMBERS.includes(member)
			);
			if (unknownMembers.length || typeof body?.['markdown'] !== 'string') {
				return json(400, {
					statusCode: 400,
					message: unknownMembers.map((member) => `property ${member} should not exist`)
				});
			}
			if (body['expectedRevision'] !== undefined && body['expectedRevision'] !== page.contentRevision) {
				return json(409, {
					message: 'Document content changed since it was loaded',
					code: 'DOCS_CONTENT_CONFLICT',
					currentRevision: page.contentRevision
				});
			}
			// The stored block of every unchanged text is kept (in order, each once); the others are built from the text.
			const unused = [...page.blocks];
			let keptBlocks = 0;
			const blocks = blocksOf(body['markdown']).map((text) => {
				const index = unused.findIndex((block) => block.markdown === text);
				if (index < 0) return { id: randomUUID(), markdown: text };
				keptBlocks += 1;
				return unused.splice(index, 1)[0];
			});
			const changed =
				blocks.length !== page.blocks.length || blocks.some((block, index) => block !== page.blocks[index]);
			if (!changed)
				return json(200, {
					document: this.row(page),
					revision: page.contentRevision,
					changed: false,
					changedBlocks: 0,
					keptBlocks
				});
			page.blocks = blocks;
			page.contentRevision += 1;
			return json(200, {
				document: this.row(page),
				revision: page.contentRevision,
				changed: true,
				changedBlocks: blocks.length - keptBlocks,
				keptBlocks
			});
		}
		return json(404, { statusCode: 404, message: `No route ${route}` });
	}

	/** A page as the document routes answer it (the stand-in has no editor JSON or HTML to answer). */
	private row(page: Page): Record<string, unknown> {
		return {
			id: page.id,
			name: page.name,
			kind: page.kind,
			parentId: page.parentId,
			contentRevision: page.contentRevision,
			tenantId: TENANT,
			organizationId: ORGANIZATION
		};
	}
}

const PAGE_TEXT = `${[
	'# Onboarding',
	'Welcome to the **team**: read [the handbook](https://example.com/handbook) first.',
	'- A laptop\n- The accounts\n- Café ☕ with the team',
	'```json\n{"step": 1}\n```',
	'> Ask in the help channel when stuck.',
	'The last paragraph.'
].join('\n\n')}\n`;

const standIn = new DocsStandIn();
let client: Client;
let server: McpServer;
const savedEnv: Record<string, string | undefined> = {};

/** The data a tool answered, or its error text. */
async function call(name: string, args: Record<string, unknown>): Promise<Record<string, any>> {
	const result = (await client.callTool({ name, arguments: args })) as {
		isError?: boolean;
		content: Array<{ type: string; text: string }>;
	};
	if (result.isError) throw new Error(result.content[0]?.text);
	return JSON.parse(result.content[0].text).data;
}

beforeAll(async () => {
	// The per-call scope check of a caller without a token reads the deployment's switches and fallback scopes.
	for (const key of ['GAUZY_MCP_TOOLS_DOCS', 'GAUZY_MCP_TOOLS_SCOPES']) savedEnv[key] = process.env[key];
	process.env['GAUZY_MCP_TOOLS_DOCS'] = 'true';
	process.env['GAUZY_MCP_TOOLS_SCOPES'] = 'docs:write';
	apiClient.configure({ baseUrl: await standIn.start() });

	server = new McpServer({ name: 'docs-markdown-route-spec', version: '0.0.0' });
	registerCollaborationTools(server, undefined, { GAUZY_MCP_TOOLS_DOCS: 'true' });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	client = new Client({ name: 'docs-markdown-route-spec-client', version: '0.0.0' });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
	await client?.close();
	await server?.close();
	await standIn.stop();
	for (const [key, value] of Object.entries(savedEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

beforeEach(() => {
	standIn.requests.length = 0;
});

describe('docs tools over the Markdown routes', () => {
	it('writes a page as Markdown, reads the same Markdown back, and changes only the edited block of an update', async () => {
		const created = await call('create_page', { name: 'Onboarding', parentId: FOLDER, markdown: PAGE_TEXT });
		const pageId = created.page.id as string;
		expect(created).toEqual(
			expect.objectContaining({
				markdownWritten: true,
				page: expect.objectContaining({ id: pageId, revision: 2 })
			})
		);
		expect(standIn.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
			`POST ${DOCUMENTS}`,
			`PUT ${DOCUMENTS}/${pageId}/content/markdown`
		]);
		expect(standIn.requests[0].body).toEqual({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			kind: 'PAGE',
			name: 'Onboarding',
			parentId: FOLDER
		});
		// The text is written against the revision the page was created at.
		expect(standIn.requests[1].body).toEqual({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			markdown: PAGE_TEXT,
			expectedRevision: 1
		});

		standIn.requests.length = 0;
		const read = await call('get_page', { pageId });
		expect(read.markdown).toBe(PAGE_TEXT);
		expect(read).toEqual(
			expect.objectContaining({
				truncated: false,
				nextOffset: null,
				page: expect.objectContaining({ id: pageId, name: 'Onboarding', revision: 2 })
			})
		);
		expect(standIn.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
			`GET ${DOCUMENTS}/${pageId}`,
			`GET ${DOCUMENTS}/${pageId}/export/markdown`,
			`GET ${DOCUMENTS}/${pageId}`
		]);
		for (const request of standIn.requests)
			expect(request.query).toEqual({ tenantId: TENANT, organizationId: ORGANIZATION });

		// One paragraph changed in the whole page, against the revision get_page answered.
		const before = standIn.pages.get(pageId)?.blocks.map((block) => block.id) ?? [];
		const edited = read.markdown.replace('The last paragraph.', 'The last paragraph, edited.');
		standIn.requests.length = 0;
		const updated = await call('update_page_markdown', {
			pageId,
			markdown: edited,
			expectedRevision: read.page.revision
		});
		expect(updated).toEqual({ revision: 3, changed: true, changedBlocks: 1, keptBlocks: 5 });
		expect(standIn.requests).toEqual([
			expect.objectContaining({
				method: 'PUT',
				path: `${DOCUMENTS}/${pageId}/content/markdown`,
				body: { tenantId: TENANT, organizationId: ORGANIZATION, markdown: edited, expectedRevision: 2 }
			})
		]);
		const after = standIn.pages.get(pageId)?.blocks.map((block) => block.id) ?? [];
		expect(after.slice(0, 5)).toEqual(before.slice(0, 5));
		expect(after[5]).not.toBe(before[5]);

		const reread = await call('get_page', { pageId });
		expect(reread.markdown).toBe(edited);
		expect(reread.page.revision).toBe(3);

		// The text as read, sent back: nothing to write, the revision stays.
		expect(await call('update_page_markdown', { pageId, markdown: reread.markdown, expectedRevision: 3 })).toEqual({
			revision: 3,
			changed: false,
			changedBlocks: 0,
			keptBlocks: 6
		});
	});

	it('never sends or reads the editor JSON or HTML, and carries the signed-in token on every request', async () => {
		const { page } = await call('create_page', { name: 'Notes', markdown: 'One line.\n' });
		const read = await call('get_page', { pageId: page.id });
		await call('update_page_markdown', {
			pageId: page.id,
			markdown: 'One line, changed.\n',
			expectedRevision: read.page.revision
		});

		const routes = new Set([
			`POST ${DOCUMENTS}`,
			`GET ${DOCUMENTS}/${page.id}`,
			`GET ${DOCUMENTS}/${page.id}/export/markdown`,
			`PUT ${DOCUMENTS}/${page.id}/content/markdown`
		]);
		for (const request of standIn.requests) {
			expect(routes).toContain(`${request.method} ${request.path}`);
			expect(request.body ?? {}).not.toHaveProperty('contentJson');
			expect(request.body ?? {}).not.toHaveProperty('contentHtml');
			expect(request.authorization).toBe('Bearer spec-token');
		}
		expect(standIn.requests.filter((request) => request.method === 'PUT')).toHaveLength(2);
	});

	it('answers a Markdown text that reads as JSON or a number as the text it is', async () => {
		for (const text of ['{"title": "Not an object"}\n', '42\n', 'true\n']) {
			const { page } = await call('create_page', { name: 'Literal', markdown: text });
			const read = await call('get_page', { pageId: page.id });
			expect(read.markdown).toBe(text);
			expect(read.length).toBe(text.length);
		}
	});

	it('reads a long page in slices that join back to its Markdown, every slice at the same revision', async () => {
		const long = `${Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}: ${'words '.repeat(20).trim()}.`).join('\n\n')}\n`;
		const { page } = await call('create_page', { name: 'Long', markdown: long });
		const slices: string[] = [];
		let offset: number | null = 0;
		while (offset !== null) {
			const part = await call('get_page', { pageId: page.id, offset, limit: 1000 });
			expect(part.page.revision).toBe(2);
			slices.push(part.markdown);
			offset = part.nextOffset;
		}
		expect(slices.length).toBeGreaterThan(1);
		expect(slices.join('')).toBe(long);
	});

	it('answers the conflict and writes nothing when the page was saved after it was read', async () => {
		const { page } = await call('create_page', { name: 'Shared', markdown: 'First.\n' });
		const read = await call('get_page', { pageId: page.id });
		standIn.saveElsewhere(page.id, 'Someone else wrote this.\n');

		const answer = await call('update_page_markdown', {
			pageId: page.id,
			markdown: 'Mine.\n',
			expectedRevision: read.page.revision
		});
		expect(answer).toEqual(expect.objectContaining({ conflict: true, currentRevision: 3 }));
		expect(answer.message).toContain('get_page');
		expect((await call('get_page', { pageId: page.id })).markdown).toBe('Someone else wrote this.\n');
	});
});

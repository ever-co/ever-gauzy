// cspell:ignore wikilink wikilinks unfiled
import { createHash, randomUUID } from 'node:crypto';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { KB_DOCUMENT_CLASSES, KB_LIMITS } from '../docs/ever-works-kb.types';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

type Row = Record<string, unknown>;

const CREATE_FIELDS = new Set(['scope', 'folderId', 'path', 'title', 'class', 'body', 'description', 'tags', 'categories', 'language', 'status', 'externalRef']);
const UPDATE_FIELDS = new Set(['title', 'body', 'description', 'class', 'tags', 'categories', 'language', 'status']);
/** What moves a document's `revision` (a real content change). */
const CONTENT_FIELDS = ['title', 'description', 'tags', 'class', 'body'];

/**
 * The Knowledge Base for the mock Ever Works API (contract v1 B.6 "KB" + CR-7, EW-P3-2; TEST CODE).
 *
 * - `GET /kb/documents` (`scope`, `workId`, `folderId=<id>|unfiled`, `class`, `status`, `includeArchived`,
 *   `updatedSince`; archived ones only with `includeArchived=true` or a `status` filter), `GET /kb/documents/:id`.
 * - `POST /kb/documents` (`Idempotency-Key` handled by the mock; `externalRef` repeat → `200` with the
 *   existing document; an organization scope must be the pinned organization; a Work path starts with a
 *   class folder, an organization path is relative without `..`; the same path twice in a scope → `409`;
 *   a person writing through the key authors it as `source: 'user'`, the key alone as `imported`; both
 *   land `accepted`).
 * - `PATCH /kb/documents/:id` (`If-Match` → `412`; a fully locked document or a status on an archived
 *   one → `422 domain_rule`; `revision` moves only on a content change, `version` on every change).
 * - `DELETE /kb/documents/:id` (a Work document; an organization document → `422`: archived, never deleted).
 * - `POST /kb/documents/:id/accept | archive | unarchive | move {folderId}` (idempotent).
 * - `GET | POST /kb/folders`, `GET | PATCH | DELETE /kb/folders/:id` (sibling names unique → `409`; a
 *   rename or move records `kb.folder.updated` for the whole subtree; a delete removes the subtree and
 *   moves its documents to Unfiled, `kb.document.moved` each).
 *
 * Every write records its `kb.*` event in the feed. `new MockEverWorksKb(mock)` adds the routes.
 */
export class MockEverWorksKb {
	readonly documents = new Map<string, Row>();
	readonly folders = new Map<string, Row>();
	/** Works of each organization that documents may be scoped to. */
	readonly works = new Map<string, string>();

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.push(this.route);
	}

	/** Registers a Work of an organization (documents may be scoped to it). */
	addWork(organizationId: string, workId: string = randomUUID()): string {
		this.works.set(workId, organizationId);
		return workId;
	}

	/** Adds (or replaces) a document (contract kb-document DTO) of an organization and returns it. */
	addDocument(organizationId: string, document: Partial<Row> = {}): Row {
		const id = (document['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const workId = (document['workId'] as string | null | undefined) ?? null;
		const body = (document['body'] as string | undefined) ?? '# Refund policy\n\nRefunds within 30 days.';
		const row: Row = {
			id,
			organizationId,
			version: 1,
			createdAt: now,
			updatedAt: now,
			scope: workId ? { type: 'work', id: workId } : { type: 'organization', id: organizationId },
			workId,
			folderId: null,
			path: workId ? 'freeform/refund-policy.md' : 'support/refund-policy.md',
			slug: 'refund-policy',
			title: 'Refund policy',
			description: null,
			class: 'freeform',
			tags: [],
			categories: [],
			status: 'active',
			reviewState: 'accepted',
			locked: false,
			lockMode: null,
			language: 'en',
			source: 'user',
			body,
			revision: 1,
			revisionAt: now,
			normalizedContentHash: hashOf(body),
			decision: null,
			createdById: randomUUID(),
			updatedById: null,
			archivedAt: null,
			wordCount: wordsOf(body),
			webUrl: `https://app.example.test/memory?view=library&doc=${id}`,
			externalLinks: [],
			...document
		};
		this.documents.set(id, row);
		return row;
	}

	/** Adds (or replaces) a library folder of an organization and returns it (its path follows its parents). */
	addFolder(organizationId: string, folder: Partial<Row> = {}): Row {
		const id = (folder['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const row: Row = {
			id,
			organizationId,
			version: 1,
			createdAt: now,
			updatedAt: now,
			name: 'Playbooks',
			parentId: null,
			path: '',
			createdById: randomUUID(),
			webUrl: null,
			externalLinks: [],
			...folder
		};
		row['path'] = this.pathOf(row);
		this.folders.set(id, row);
		return row;
	}

	/** The documents' public DTO (the mock's bookkeeping removed). */
	static dto(row: Row): Row {
		const dto = { ...row };
		delete dto['externalLinks'];
		return dto;
	}

	private readonly route: MockEverWorksExtension = (context) => {
		const { method, path } = context;
		if (!path.startsWith('/kb/')) return null;
		const parts = path.split('/').filter(Boolean); // ['kb', 'documents' | 'folders', id?, action?]
		const collection = parts[1];
		if (collection !== 'documents' && collection !== 'folders') return null;
		const reading = method === 'GET';
		const denied = context.scoped(reading ? 'kb:read' : 'kb:write');
		if (denied) return denied;
		if (collection === 'documents') return this.documentRoute(context, parts);
		return this.folderRoute(context, parts);
	};

	// ── Documents ──────────────────────────────────────────────────────────────────────────────────

	private documentRoute(context: MockEverWorksRouteContext, parts: string[]): EverWorksHttpResponse {
		const { method } = context;
		if (method === 'GET' && parts.length === 2) return context.ok(MockEverWorksServer.page(this.listDocuments(context).map(MockEverWorksKb.dto), context.query));
		if (method === 'POST' && parts.length === 2) return this.createDocument(context);
		const document = this.visibleDocuments(context).find((row) => row['id'] === parts[2]);
		if (!document) return MockEverWorksServer.error(404, 'not_found', 'No such document.');
		if (method === 'GET' && parts.length === 3) return this.answer(context, document);
		if (method === 'PATCH' && parts.length === 3) return this.updateDocument(context, document);
		if (method === 'DELETE' && parts.length === 3) {
			const stale = this.ifMatch(context, document);
			if (stale) return stale;
			if ((document['scope'] as { type: string }).type === 'organization')
				return MockEverWorksServer.error(422, 'domain_rule', 'Organization documents are archived, never deleted: POST /kb/documents/:id/archive.');
			this.documents.delete(document['id'] as string);
			this.bump(document);
			this.emitDocument(context, 'kb.document.deleted', { ...document, deleted: true });
			return { status: 204, headers: {}, data: undefined };
		}
		if (method === 'POST' && parts.length === 4) {
			switch (parts[3]) {
				case 'accept':
					if (document['reviewState'] === 'accepted') return this.answer(context, document);
					document['reviewState'] = 'accepted';
					return this.changed(context, document, 'kb.document.review_changed');
				case 'archive':
					if (document['status'] === 'archived') return this.answer(context, document);
					Object.assign(document, { status: 'archived', archivedAt: new Date().toISOString() });
					return this.changed(context, document, 'kb.document.archived');
				case 'unarchive':
					if (document['status'] !== 'archived') return this.answer(context, document);
					Object.assign(document, { status: 'active', archivedAt: null });
					return this.changed(context, document, 'kb.document.unarchived');
				case 'move': {
					const input = (context.body ?? {}) as Row;
					if (!('folderId' in input) || Object.keys(input).some((key) => key !== 'folderId'))
						return MockEverWorksServer.error(400, 'validation_failed', 'The body is {folderId}.');
					const folderId = (input['folderId'] as string | null) ?? null;
					if ((document['scope'] as { type: string }).type !== 'organization')
						return MockEverWorksServer.error(422, 'domain_rule', 'Only organization documents are filed in library folders.');
					if (folderId && !this.folderOf(context, folderId)) return MockEverWorksServer.error(404, 'not_found', 'No such folder.');
					if ((document['folderId'] ?? null) === folderId) return this.answer(context, document);
					document['folderId'] = folderId;
					return this.changed(context, document, 'kb.document.moved');
				}
				default:
					break;
			}
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${context.path}.`);
	}

	private listDocuments(context: MockEverWorksRouteContext): Row[] {
		const q = context.query;
		return this.visibleDocuments(context)
			.filter((row) => {
				if (q['scope'] && (row['scope'] as { type: string }).type !== q['scope']) return false;
				if (q['workId'] && row['workId'] !== q['workId']) return false;
				if (q['folderId'] === 'unfiled' ? row['folderId'] !== null : q['folderId'] && row['folderId'] !== q['folderId']) return false;
				if (q['class'] && row['class'] !== q['class']) return false;
				if (q['status'] ? row['status'] !== q['status'] : row['status'] === 'archived' && q['includeArchived'] !== 'true') return false;
				if (q['updatedSince'] && String(row['updatedAt']) < q['updatedSince']) return false;
				return true;
			})
			.sort((a, b) => String(a['updatedAt']).localeCompare(String(b['updatedAt'])) || String(a['id']).localeCompare(String(b['id'])));
	}

	/** Documents of the pinned organization: its library and its Works' documents. */
	private visibleDocuments(context: MockEverWorksRouteContext): Row[] {
		return [...this.documents.values()].filter((row) => row['organizationId'] === context.org?.id);
	}

	private createDocument(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const input = (context.body ?? {}) as Row;
		const unknown = Object.keys(input).filter((field) => !CREATE_FIELDS.has(field));
		if (unknown.length) return MockEverWorksServer.error(400, 'validation_failed', `Unknown properties: ${unknown.join(', ')}.`);
		const scope = input['scope'] as { type?: string; id?: string } | undefined;
		const path = typeof input['path'] === 'string' ? input['path'] : '';
		const title = typeof input['title'] === 'string' ? input['title'] : '';
		const kind = input['class'] as string;
		if (!scope || (scope.type !== 'organization' && scope.type !== 'work') || !scope.id)
			return MockEverWorksServer.error(400, 'validation_failed', 'scope is {type: organization|work, id}.');
		if (!path || path.length > 512 || !title || title.length > 255 || typeof input['body'] !== 'string')
			return MockEverWorksServer.error(400, 'validation_failed', 'path, title, class and body are required.');
		if (!(KB_DOCUMENT_CLASSES as readonly string[]).includes(kind)) return MockEverWorksServer.error(400, 'validation_failed', 'Unknown class.');
		if (scope.type === 'organization' && scope.id !== context.org?.id)
			return MockEverWorksServer.error(400, 'validation_failed', 'scope.id must be the pinned organization (X-Scope-Slug).');
		if (scope.type === 'work' && this.works.get(scope.id) !== context.org?.id) return MockEverWorksServer.error(404, 'not_found', 'No such work.');
		const segments = path.split('/');
		if (path.startsWith('/') || path.includes('\\') || segments.includes('..'))
			return MockEverWorksServer.error(400, 'validation_failed', 'path must be relative, without `..`.');
		if (scope.type === 'work' && !(KB_DOCUMENT_CLASSES as readonly string[]).includes(segments[0] ?? ''))
			return MockEverWorksServer.error(400, 'validation_failed', 'A Work document path starts with a class folder.');
		const ref = input['externalRef'] as { source?: string; installationId?: string | null; externalId?: string; externalUrl?: string | null } | undefined;
		if (ref && ref.source !== 'gauzy') return MockEverWorksServer.error(400, 'validation_failed', 'externalRef.source must be "gauzy".');
		if (ref?.externalId) {
			const existing = this.visibleDocuments(context).find((row) => ((row['externalLinks'] as Row[]) ?? []).some((link) => link['externalId'] === ref.externalId));
			if (existing) return this.answer(context, existing, 200);
		}
		const folderId = (input['folderId'] as string | null | undefined) ?? null;
		if (folderId && !this.folderOf(context, folderId)) return MockEverWorksServer.error(404, 'not_found', 'No such folder.');
		const inScope = this.visibleDocuments(context).filter((row) => (row['scope'] as { id: string }).id === scope.id);
		if (inScope.some((row) => row['path'] === path)) return MockEverWorksServer.error(409, 'conflict', 'A document with this path exists.');
		const actAs = context.headers['x-act-as-user'] ?? null;
		const body = input['body'] as string;
		const slug = (segments[segments.length - 1] ?? '').replace(/\.md$/i, '');
		const document = this.addDocument(context.org?.id as string, {
			scope: { type: scope.type, id: scope.id },
			workId: scope.type === 'work' ? scope.id : null,
			folderId,
			path,
			slug,
			title,
			description: (input['description'] as string | null | undefined) ?? null,
			class: kind,
			tags: (input['tags'] as string[] | undefined) ?? [],
			categories: (input['categories'] as string[] | undefined) ?? [],
			language: (input['language'] as string | undefined) ?? 'en',
			status: (input['status'] as string | undefined) ?? 'active',
			reviewState: 'accepted',
			source: actAs ? 'user' : 'imported',
			body,
			normalizedContentHash: hashOf(body),
			createdById: actAs,
			updatedById: actAs,
			externalLinks: ref?.externalId ? [{ source: ref.source, installationId: ref.installationId ?? null, externalId: ref.externalId, externalUrl: ref.externalUrl ?? null }] : []
		});
		this.emitDocument(context, 'kb.document.created', document);
		return this.answer(context, document, 201);
	}

	private updateDocument(context: MockEverWorksRouteContext, document: Row): EverWorksHttpResponse {
		const stale = this.ifMatch(context, document);
		if (stale) return stale;
		const input = (context.body ?? {}) as Row;
		const keys = Object.keys(input);
		if (!keys.length || keys.some((key) => !UPDATE_FIELDS.has(key)))
			return MockEverWorksServer.error(400, 'validation_failed', `Only ${[...UPDATE_FIELDS].join(', ')} can change.`);
		const invalid = invalidUpdate(input);
		if (invalid) return MockEverWorksServer.error(400, 'validation_failed', invalid);
		if (document['locked'] && document['lockMode'] !== 'additions-only')
			return MockEverWorksServer.error(422, 'domain_rule', 'The document is locked.');
		if ('status' in input && document['status'] === 'archived')
			return MockEverWorksServer.error(422, 'domain_rule', 'An archived document is restored with POST /kb/documents/:id/unarchive, not by setting its status.');
		const content = CONTENT_FIELDS.some((field) => field in input && JSON.stringify(input[field]) !== JSON.stringify(document[field]));
		Object.assign(document, input, { updatedById: context.headers['x-act-as-user'] ?? null });
		if (content) {
			document['revision'] = Number(document['revision']) + 1;
			document['revisionAt'] = new Date().toISOString();
			document['normalizedContentHash'] = hashOf(document['body'] as string);
			document['wordCount'] = wordsOf(document['body'] as string);
		}
		return this.changed(context, document, 'kb.document.updated');
	}

	// ── Folders ────────────────────────────────────────────────────────────────────────────────────

	private folderRoute(context: MockEverWorksRouteContext, parts: string[]): EverWorksHttpResponse {
		const { method } = context;
		const all = () => [...this.folders.values()].filter((row) => row['organizationId'] === context.org?.id);
		if (method === 'GET' && parts.length === 2) return context.ok(MockEverWorksServer.page(all().map(MockEverWorksKb.dto), context.query));
		if (method === 'POST' && parts.length === 2) return this.createFolder(context);
		const folder = this.folderOf(context, parts[2]);
		if (!folder) return MockEverWorksServer.error(404, 'not_found', 'No such folder.');
		if (method === 'GET' && parts.length === 3) return this.answer(context, folder);
		if (method === 'PATCH' && parts.length === 3) {
			const stale = this.ifMatch(context, folder);
			if (stale) return stale;
			const input = (context.body ?? {}) as Row;
			const keys = Object.keys(input);
			if (!keys.length || keys.some((key) => key !== 'name' && key !== 'parentId'))
				return MockEverWorksServer.error(400, 'validation_failed', 'Only name and parentId can change.');
			const name = 'name' in input ? String(input['name'] ?? '') : (folder['name'] as string);
			const parentId = 'parentId' in input ? ((input['parentId'] as string | null) ?? null) : ((folder['parentId'] as string | null) ?? null);
			if (!name || name.length > 120) return MockEverWorksServer.error(400, 'validation_failed', 'name is 1 to 120 characters.');
			if (parentId && (!this.folderOf(context, parentId) || this.subtree(folder).some((row) => row['id'] === parentId)))
				return MockEverWorksServer.error(422, 'domain_rule', 'A folder cannot move into itself or a folder outside the library.');
			if (this.siblingNamed(context, parentId, name, folder['id'] as string)) return MockEverWorksServer.error(409, 'conflict', 'A sibling folder has this name.');
			Object.assign(folder, { name, parentId });
			// A rename or a move rewrites the paths of the whole subtree: each of its folders records an update.
			for (const row of this.subtree(folder)) {
				row['path'] = this.pathOf(row);
				this.bump(row);
				this.emitFolder(context, 'kb.folder.updated', row);
			}
			return this.answer(context, folder);
		}
		if (method === 'DELETE' && parts.length === 3) {
			const stale = this.ifMatch(context, folder);
			if (stale) return stale;
			const removed = this.subtree(folder);
			const ids = new Set(removed.map((row) => row['id']));
			let unfiled = 0;
			for (const document of this.visibleDocuments(context)) {
				if (!ids.has(document['folderId'])) continue;
				document['folderId'] = null;
				this.bump(document);
				this.emitDocument(context, 'kb.document.moved', document);
				unfiled++;
			}
			for (const row of removed.reverse()) {
				this.folders.delete(row['id'] as string);
				this.bump(row);
				this.emitFolder(context, 'kb.folder.deleted', { ...row, deleted: true });
			}
			return context.ok({ deletedFolders: removed.length, unfiledDocuments: unfiled });
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${context.path}.`);
	}

	private createFolder(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const input = (context.body ?? {}) as Row;
		const unknown = Object.keys(input).filter((field) => !['name', 'parentId', 'externalRef'].includes(field));
		if (unknown.length) return MockEverWorksServer.error(400, 'validation_failed', `Unknown properties: ${unknown.join(', ')}.`);
		const name = typeof input['name'] === 'string' ? input['name'] : '';
		if (!name || name.length > 120) return MockEverWorksServer.error(400, 'validation_failed', 'name is 1 to 120 characters.');
		const parentId = (input['parentId'] as string | null | undefined) ?? null;
		if (parentId && !this.folderOf(context, parentId)) return MockEverWorksServer.error(404, 'not_found', 'No such folder.');
		const ref = input['externalRef'] as { source?: string; externalId?: string } | undefined;
		if (ref && ref.source !== 'gauzy') return MockEverWorksServer.error(400, 'validation_failed', 'externalRef.source must be "gauzy".');
		if (ref?.externalId) {
			const existing = [...this.folders.values()].find(
				(row) => row['organizationId'] === context.org?.id && ((row['externalLinks'] as Row[]) ?? []).some((link) => link['externalId'] === ref.externalId)
			);
			if (existing) return this.answer(context, existing, 200);
		}
		if (this.siblingNamed(context, parentId, name)) return MockEverWorksServer.error(409, 'conflict', 'A sibling folder has this name.');
		const actAs = context.headers['x-act-as-user'] ?? null;
		const folder = this.addFolder(context.org?.id as string, {
			name,
			parentId,
			createdById: actAs ?? context.key.keyId,
			externalLinks: ref?.externalId ? [{ source: ref.source, externalId: ref.externalId }] : []
		});
		this.emitFolder(context, 'kb.folder.created', folder);
		return this.answer(context, folder, 201);
	}

	private folderOf(context: MockEverWorksRouteContext, id: string | undefined): Row | undefined {
		const folder = id ? this.folders.get(id) : undefined;
		return folder && folder['organizationId'] === context.org?.id ? folder : undefined;
	}

	private siblingNamed(context: MockEverWorksRouteContext, parentId: string | null, name: string, except?: string): boolean {
		return [...this.folders.values()].some(
			(row) =>
				row['organizationId'] === context.org?.id &&
				(row['parentId'] ?? null) === parentId &&
				row['id'] !== except &&
				String(row['name']).toLowerCase() === name.toLowerCase()
		);
	}

	/** The folder and every folder under it, parents first. */
	private subtree(folder: Row): Row[] {
		const out: Row[] = [folder];
		for (let index = 0; index < out.length; index++) {
			for (const row of this.folders.values()) if (row['parentId'] === out[index]['id']) out.push(row);
		}
		return out;
	}

	private pathOf(folder: Row): string {
		const names: string[] = [];
		const seen = new Set<unknown>();
		let current: Row | undefined = folder;
		while (current && !seen.has(current['id'])) {
			seen.add(current['id']);
			names.unshift(String(current['name']));
			current = current['parentId'] ? this.folders.get(current['parentId'] as string) : undefined;
		}
		return `/${names.join('/')}`;
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private ifMatch(context: MockEverWorksRouteContext, row: Row): EverWorksHttpResponse | null {
		const ifMatch = context.headers['if-match'];
		return ifMatch && ifMatch.replace(/"/g, '') !== String(row['version']) ? MockEverWorksServer.error(412, 'version_mismatch', 'The record changed.') : null;
	}

	private bump(row: Row): void {
		row['version'] = Number(row['version']) + 1;
		row['updatedAt'] = new Date().toISOString();
	}

	private changed(context: MockEverWorksRouteContext, document: Row, type: string): EverWorksHttpResponse {
		this.bump(document);
		this.emitDocument(context, type, document);
		return this.answer(context, document);
	}

	private answer(context: MockEverWorksRouteContext, row: Row, status = 200): EverWorksHttpResponse {
		const response = context.ok(MockEverWorksKb.dto(row), status);
		return { ...response, headers: { ...response.headers, etag: `"${row['version']}"` } };
	}

	private emitDocument(context: MockEverWorksRouteContext, type: string, document: Row): void {
		const data = MockEverWorksKb.dto(document);
		// An event over the body limit carries no body (CR-7): the consumer reads the document for it.
		if (typeof data['body'] === 'string' && Buffer.byteLength(data['body'], 'utf8') > EVENT_BODY_LIMIT_BYTES) Object.assign(data, { body: null, bodyOmitted: true });
		this.emit(context, type, { type: 'kb_document', id: document['id'] as string, version: Number(document['version']) }, data);
	}

	private emitFolder(context: MockEverWorksRouteContext, type: string, folder: Row): void {
		this.emit(context, type, { type: 'kb_folder', id: folder['id'] as string, version: Number(folder['version']) }, MockEverWorksKb.dto(folder));
	}

	private emit(context: MockEverWorksRouteContext, type: string, aggregate: { type: string; id: string; version: number }, data: Row): void {
		const actAs = context.headers['x-act-as-user'];
		void this.mock.emit({
			type,
			organizationId: context.org?.id as string,
			aggregate,
			actor: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			origin: { tag: context.headers['x-sync-origin'] ?? null, integrationKeyId: context.key.keyId },
			data
		});
	}
}

/** The event body limit (CR-7: 256 KiB of UTF-8). */
export const EVENT_BODY_LIMIT_BYTES = 262_144;

/** What a PATCH body breaks of `UpdateKbDocument` (types, closed values, `KB_LIMITS`), or `null`. */
function invalidUpdate(input: Row): string | null {
	const text = (value: unknown, min: number, max: number) => typeof value === 'string' && value.length >= min && value.length <= max;
	const list = (value: unknown) => Array.isArray(value) && value.length <= KB_LIMITS.tags && value.every((item) => text(item, 1, KB_LIMITS.tag));
	if ('title' in input && !text(input['title'], 1, KB_LIMITS.title)) return 'title is 1 to 255 characters.';
	if ('body' in input && !text(input['body'], 0, KB_LIMITS.body)) return 'body is a string of at most 1000000 characters.';
	if ('description' in input && input['description'] !== null && !text(input['description'], 0, KB_LIMITS.description)) return 'description is a string of at most 4000 characters, or null.';
	if ('class' in input && !(KB_DOCUMENT_CLASSES as readonly string[]).includes(input['class'] as string)) return 'Unknown class.';
	if ('tags' in input && !list(input['tags'])) return 'tags are at most 50 strings of at most 100 characters.';
	if ('categories' in input && !list(input['categories'])) return 'categories are at most 50 strings of at most 100 characters.';
	if ('language' in input && !text(input['language'], 2, 8)) return 'language is 2 to 8 characters.';
	if ('status' in input && input['status'] !== 'draft' && input['status'] !== 'active') return 'status is draft or active (archive has its own route).';
	return null;
}

function wordsOf(body: string): number {
	return body.split(/\s+/).filter(Boolean).length;
}

/** The mock's `normalizedContentHash`: SHA-256 of the trimmed body. */
function hashOf(body: string): string {
	return createHash('sha256').update(body.replace(/\r\n?/g, '\n').trim()).digest('hex');
}

/**
 * The mock Ever Works Knowledge Base (test code the docs sync is tested against) keeps to the contract
 * (v1-draft.6, CR-7): the KB routes, their refusals and the `kb.*` events they record.
 */
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksListPage } from '../client/ever-works-client.types';
import { MockEverWorksKb } from '../testing/mock-ever-works.kb';
import { MockEverWorksServer } from '../testing/mock-ever-works.server';
import type { EverWorksKbDocument, EverWorksKbFolder } from './ever-works-kb.types';

function setup(scopes?: string[]) {
	const mock = new MockEverWorksServer();
	const ewOrg = { id: 'ew-org-1', slug: 'acme', displayName: 'Acme' };
	const key = mock.addKey({ organizations: [ewOrg], ...(scopes ? { scopes } : {}) });
	const kb = new MockEverWorksKb(mock);
	const client = new EverWorksClient({
		apiBaseUrl: 'https://api.example.test/api',
		apiKey: key,
		transport: mock.transport(),
		connectionId: 'c1',
		scopeSlug: 'acme',
		retry: { maxAttempts: 1 },
		sleep: async () => undefined
	});
	return { mock, kb, client, ewOrg };
}

async function refusal(promise: Promise<unknown>): Promise<{ status: number; code: string }> {
	try {
		await promise;
	} catch (error) {
		if (error instanceof EverWorksApiError) return { status: error.status, code: error.code };
		throw error;
	}
	throw new Error('expected a refusal');
}

describe('mock Ever Works Knowledge Base (contract v1 CR-7)', () => {
	it('creates an organization document once per externalRef and records kb.document.created', async () => {
		const { mock, client, ewOrg } = setup();
		const body = {
			scope: { type: 'organization', id: ewOrg.id },
			path: 'support/refunds.md',
			title: 'Refunds',
			class: 'freeform',
			body: '# Refunds',
			externalRef: { source: 'gauzy', externalId: 'g-doc-1' }
		};
		const created = await client.request<EverWorksKbDocument>('POST', '/kb/documents', { body, idempotencyKey: 'k1', actAsUserId: 'ew-user-1' });
		expect(created).toMatchObject({ title: 'Refunds', scope: { type: 'organization', id: ewOrg.id }, source: 'user', reviewState: 'accepted', revision: 1, version: 1 });
		const again = await client.request<EverWorksKbDocument>('POST', '/kb/documents', { body, idempotencyKey: 'k2' });
		expect(again.id).toBe(created.id);
		expect(mock.events.filter((event) => event.type === 'kb.document.created')).toHaveLength(1);
		expect(mock.events[0]?.aggregate).toEqual({ type: 'kb_document', id: created.id, version: 1 });
	});

	it('refuses what the contract refuses', async () => {
		const { kb, client, ewOrg } = setup();
		const work = kb.addWork(ewOrg.id);
		const base = { scope: { type: 'organization', id: ewOrg.id }, path: 'a.md', title: 'A', class: 'freeform', body: 'a' };
		expect(await refusal(client.request('POST', '/kb/documents', { body: { ...base, path: '../a.md' } }))).toEqual({ status: 400, code: 'validation_failed' });
		expect(await refusal(client.request('POST', '/kb/documents', { body: { ...base, scope: { type: 'work', id: work }, path: 'notes/a.md' } }))).toEqual({ status: 400, code: 'validation_failed' });
		expect(await refusal(client.request('POST', '/kb/documents', { body: { ...base, folderId: '00000000-0000-4000-8000-000000000000' } }))).toEqual({ status: 404, code: 'not_found' });
		const document = await client.request<EverWorksKbDocument>('POST', '/kb/documents', { body: base });
		expect(await refusal(client.request('POST', '/kb/documents', { body: base }))).toEqual({ status: 409, code: 'conflict' });
		// Organization documents are archived, never deleted.
		expect(await refusal(client.request('DELETE', `/kb/documents/${document.id}`))).toEqual({ status: 422, code: 'domain_rule' });
		expect(await refusal(client.request('PATCH', `/kb/documents/${document.id}`, { body: { title: 'B' }, ifMatchVersion: 7 }))).toEqual({ status: 412, code: 'version_mismatch' });
		const locked = kb.addDocument(ewOrg.id, { locked: true, lockMode: 'full' });
		expect(await refusal(client.request('PATCH', `/kb/documents/${locked['id']}`, { body: { title: 'B' } }))).toEqual({ status: 422, code: 'domain_rule' });
		const { client: reader } = setup(['kb:read']);
		expect((await refusal(reader.request('POST', '/kb/documents', { body: base }))).status).toBe(403);
	});

	it('moves revision only on a content change, version on every change, and keeps archived documents out of lists', async () => {
		const { mock, kb, client, ewOrg } = setup();
		const document = kb.addDocument(ewOrg.id);
		const id = document['id'] as string;
		const edited = await client.request<EverWorksKbDocument>('PATCH', `/kb/documents/${id}`, { body: { body: 'New body' }, ifMatchVersion: 1 });
		expect(edited).toMatchObject({ revision: 2, version: 2, body: 'New body' });
		const accepted = await client.request<EverWorksKbDocument>('POST', `/kb/documents/${id}/accept`);
		expect(accepted).toMatchObject({ revision: 2, version: 2 }); // already accepted: unchanged
		const archived = await client.request<EverWorksKbDocument>('POST', `/kb/documents/${id}/archive`);
		expect(archived).toMatchObject({ status: 'archived', revision: 2, version: 3 });
		expect((await client.request<EverWorksListPage<EverWorksKbDocument>>('GET', '/kb/documents')).data).toEqual([]);
		expect((await client.request<EverWorksListPage<EverWorksKbDocument>>('GET', '/kb/documents', { query: { includeArchived: 'true' } })).data.map((row) => row.id)).toEqual([id]);
		expect(await refusal(client.request('PATCH', `/kb/documents/${id}`, { body: { status: 'active' } }))).toEqual({ status: 422, code: 'domain_rule' });
		await client.request('POST', `/kb/documents/${id}/unarchive`);
		expect(mock.events.map((event) => event.type)).toEqual(['kb.document.updated', 'kb.document.archived', 'kb.document.unarchived']);
	});

	it('keeps the folder tree: unique sibling names, subtree paths on a move, documents unfiled on a delete', async () => {
		const { mock, kb, client, ewOrg } = setup();
		const top = await client.request<EverWorksKbFolder>('POST', '/kb/folders', { body: { name: 'Playbooks' } });
		const child = await client.request<EverWorksKbFolder>('POST', '/kb/folders', { body: { name: 'Support', parentId: top.id } });
		expect(child.path).toBe('/Playbooks/Support');
		expect(await refusal(client.request('POST', '/kb/folders', { body: { name: 'playbooks' } }))).toEqual({ status: 409, code: 'conflict' });
		const document = kb.addDocument(ewOrg.id, { folderId: child.id });
		await client.request('POST', `/kb/documents/${document['id']}/move`, { body: { folderId: top.id } });
		await client.request('POST', `/kb/documents/${document['id']}/move`, { body: { folderId: child.id } });
		const renamed = await client.request<EverWorksKbFolder>('PATCH', `/kb/folders/${top.id}`, { body: { name: 'Guides' } });
		expect(renamed.path).toBe('/Guides');
		expect(kb.folders.get(child.id)?.['path']).toBe('/Guides/Support');
		mock.events.length = 0;
		const result = await client.request<{ deletedFolders: number; unfiledDocuments: number }>('DELETE', `/kb/folders/${top.id}`);
		expect(result).toEqual({ deletedFolders: 2, unfiledDocuments: 1 });
		expect(kb.documents.get(document['id'] as string)?.['folderId']).toBeNull();
		expect(mock.events.map((event) => event.type)).toEqual(['kb.document.moved', 'kb.folder.deleted', 'kb.folder.deleted']);
	});
});

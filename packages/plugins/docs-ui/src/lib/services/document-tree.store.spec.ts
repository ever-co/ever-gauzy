/** See `documents.service.spec.ts` — the store reaches `DocumentsService`, which imports this barrel. */
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {} }));

import { firstValueFrom, of } from 'rxjs';
import { DocumentKindEnum, ID, IDocument, IPagination } from '@gauzy/contracts';
import { IDocumentFindInput } from '../models/docs-api.model';
import { DocumentTreeStore } from './document-tree.store';
import { DocumentsService } from './documents.service';

const node = (id: string, name: string, parentId: ID | null = null): IDocument =>
	({ id, name, kind: DocumentKindEnum.FOLDER, parentId } as unknown as IDocument);

/** Records every query the store issues and replays a scripted response per parent. */
class DocumentsServiceStub {
	public readonly calls: IDocumentFindInput[] = [];
	public rootChildren: IDocument[] = [node('folder-1', 'Contracts')];

	getAll(params: IDocumentFindInput = {}) {
		this.calls.push(params);
		const items = params.parentId === 'root' ? this.rootChildren : [];
		return of({ items, total: items.length } as IPagination<IDocument>);
	}
}

describe('DocumentTreeStore', () => {
	let documentsService: DocumentsServiceStub;
	let store: DocumentTreeStore;

	beforeEach(() => {
		documentsService = new DocumentsServiceStub();
		store = new DocumentTreeStore(documentsService as unknown as DocumentsService);
	});

	describe('loadChildren', () => {
		it("browses the top level with parentId='root' (an omitted parent is a flat search)", async () => {
			await store.loadRoots();

			expect(documentsService.calls[0].parentId).toBe('root');
		});

		it('does not ask for a sort the query DTO rejects (`index` is not in its allowlist)', async () => {
			await store.loadRoots();

			expect(documentsService.calls[0].sort).toBeUndefined();
		});

		it('memoizes a loaded branch', async () => {
			await store.loadRoots();
			await store.loadRoots();

			expect(documentsService.calls.length).toBe(1);
		});
	});

	describe('invalidate', () => {
		it('re-fetches the roots it dropped instead of leaving the sidebar blank', async () => {
			await store.loadRoots();
			documentsService.rootChildren = [node('folder-1', 'Contracts'), node('folder-2', 'Invoices')];

			store.invalidate(null);
			// The stub is synchronous; the reload is awaited through the microtask queue.
			await Promise.resolve();

			const nodes = await firstValueFrom(store.nodes$);
			expect(nodes.map((entry) => entry.name)).toEqual(['Contracts', 'Invoices']);
			expect(documentsService.calls.length).toBe(2);
		});

		it('does not eagerly expand a branch that was never loaded', () => {
			store.invalidate('never-opened' as ID);

			expect(documentsService.calls.length).toBe(0);
		});
	});

	describe('invalidateAll', () => {
		it('reloads the roots after a full reset', async () => {
			await store.loadRoots();

			store.invalidateAll();
			await Promise.resolve();

			expect(documentsService.calls.length).toBe(2);
			expect(await firstValueFrom(store.nodes$)).toHaveLength(1);
		});
	});
});

import { DocumentVectorStoreRegistry } from './vector-store.registry';
import { IDocumentVectorStore } from './vector-store.interface';

/**
 * Registry resolution tests: registration order, availability gating, and the
 * `GAUZY_DOCS_VECTOR_STORE` environment pin.
 */
describe('DocumentVectorStoreRegistry', () => {
	const makeStore = (id: string, available: boolean): IDocumentVectorStore => ({
		id,
		isAvailable: jest.fn().mockResolvedValue(available),
		upsertChunks: jest.fn(),
		deleteByDocument: jest.fn(),
		query: jest.fn().mockResolvedValue([])
	});

	afterEach(() => {
		DocumentVectorStoreRegistry.clear();
		delete process.env['GAUZY_DOCS_VECTOR_STORE'];
	});

	it('resolves the first available store in registration order', async () => {
		const vector = makeStore('pgvector', false);
		const lexical = makeStore('lexical', true);
		DocumentVectorStoreRegistry.register(vector);
		DocumentVectorStoreRegistry.register(lexical);

		const resolved = await DocumentVectorStoreRegistry.resolve();
		expect(resolved?.id).toBe('lexical');
	});

	it('prefers an earlier-registered available store', async () => {
		DocumentVectorStoreRegistry.register(makeStore('pgvector', true));
		DocumentVectorStoreRegistry.register(makeStore('lexical', true));

		const resolved = await DocumentVectorStoreRegistry.resolve();
		expect(resolved?.id).toBe('pgvector');
	});

	it('honors the GAUZY_DOCS_VECTOR_STORE pin when the pinned store is available', async () => {
		DocumentVectorStoreRegistry.register(makeStore('pgvector', true));
		DocumentVectorStoreRegistry.register(makeStore('custom', true));
		process.env['GAUZY_DOCS_VECTOR_STORE'] = 'custom';

		const resolved = await DocumentVectorStoreRegistry.resolve();
		expect(resolved?.id).toBe('custom');
	});

	it('falls through an unavailable or unregistered pin', async () => {
		DocumentVectorStoreRegistry.register(makeStore('pgvector', false));
		DocumentVectorStoreRegistry.register(makeStore('lexical', true));
		process.env['GAUZY_DOCS_VECTOR_STORE'] = 'pgvector';
		expect((await DocumentVectorStoreRegistry.resolve())?.id).toBe('lexical');

		process.env['GAUZY_DOCS_VECTOR_STORE'] = 'does-not-exist';
		expect((await DocumentVectorStoreRegistry.resolve())?.id).toBe('lexical');
	});

	it('returns null when nothing is available and never throws on a broken probe', async () => {
		expect(await DocumentVectorStoreRegistry.resolve()).toBeNull();

		const broken = makeStore('broken', true);
		(broken.isAvailable as jest.Mock).mockRejectedValue(new Error('probe exploded'));
		DocumentVectorStoreRegistry.register(broken);
		expect(await DocumentVectorStoreRegistry.resolve()).toBeNull();
	});

	it('supports third-party registration and unregistration', async () => {
		const custom = makeStore('third-party', true);
		DocumentVectorStoreRegistry.register(custom);
		expect(DocumentVectorStoreRegistry.get('third-party')).toBe(custom);
		expect(DocumentVectorStoreRegistry.list()).toHaveLength(1);

		DocumentVectorStoreRegistry.unregister('third-party');
		expect(DocumentVectorStoreRegistry.get('third-party')).toBeUndefined();
	});
});

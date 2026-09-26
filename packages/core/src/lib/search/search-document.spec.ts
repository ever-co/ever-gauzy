import { getMetadataArgsStorage } from 'typeorm';
import { validateSync } from 'class-validator';
import { SearchDocument } from './search-document.entity';

/**
 * The indexed document, as the storage half of search owns it.
 *
 * The index is a projection and never authoritative: a hit carries an entity type and an id, and
 * every reader re-reads the entity from the domain that owns it — no request takes a price, a stock
 * level, a balance or a permission from here. That is what makes the table disposable, and it is
 * asserted as a table contract: the columns the query path reads, the tenant columns a result set is
 * scoped by, and the absence of any column that would invite a caller to treat the index as a source
 * of truth. What a document must state before it is written is asserted through the same validators
 * the API runs.
 */

type Row = Record<string, any>;

/** One document, as the indexer writes it, so a case can vary exactly one thing. */
const document = (overrides: Row = {}): SearchDocument =>
	Object.assign(new SearchDocument(), {
		entity: 'product',
		entityId: '6b1e0f2a-0000-4000-8000-000000000001',
		title: 'Widget — SKU-1',
		body: 'A widget',
		keywords: ['sku-1', 'red'],
		attributes: { colour: ['red'] },
		definitionVersion: 1,
		...overrides
	});

/** The declared columns of the entity and of everything it extends, through the ORM's own metadata. */
const columnsOf = (entity: unknown): string[] => {
	const storage = getMetadataArgsStorage();
	const names = new Set<string>();

	// The tenant columns a result set is scoped by are declared by the base entity, so the walk has to
	// follow the prototype chain rather than read the leaf class alone.
	for (let target = entity as Row; target && target !== Object; target = Object.getPrototypeOf(target)) {
		for (const column of storage.columns.filter((entry) => entry.target === target)) {
			names.add(column.propertyName);
		}
	}

	return [...names];
};

describe('the columns the storage half owns', () => {
	it('declares the projection a query reads, and the tenant it is scoped by', () => {
		const columns = columnsOf(SearchDocument);

		// A query filters on the entity, the tenant and the engine, reads the title, the promoted
		// tokens and the attribute map, and identifies a stale row by the source's own timestamp.
		expect(columns).toEqual(
			expect.arrayContaining([
				'entity',
				'entityId',
				'title',
				'body',
				'keywords',
				'attributes',
				'sourceUpdatedAt',
				'indexedAt',
				'engineKey',
				'definitionVersion',
				'tenantId',
				'organizationId'
			])
		);
	});

	it('holds no authoritative value, so nothing can be read from the index as if it were the source', () => {
		// Control: a document carrying a price, a stock level or a status is how an index quietly
		// becomes a second source of truth — a caller would read a stale value that the domain never
		// agreed to serve.
		const authoritative = columnsOf(SearchDocument).filter((column) =>
			/(price|amount|quantity|stock|balance|cost|total|currency|status)/i.test(column)
		);

		expect(authoritative).toEqual([]);
	});

	it('records which provider built the row and which definition version it was built at', () => {
		// `engineKey` null means the built-in database provider wrote the row; a mismatch between the
		// quoted definition version and the current one is exactly what the reindex sweep looks for.
		expect(columnsOf(SearchDocument)).toEqual(expect.arrayContaining(['engineKey', 'definitionVersion']));
	});
});

describe('what a document must state', () => {
	it('accepts the document an indexer writes', () => {
		expect(validateSync(document()).map((error) => error.property)).toEqual([]);
	});

	it('requires the entity key, the source id and the title a listing renders', () => {
		expect(validateSync(document({ entity: undefined })).map((error) => error.property)).toContain('entity');
		expect(validateSync(document({ entityId: undefined })).map((error) => error.property)).toContain('entityId');
		expect(validateSync(document({ title: undefined })).map((error) => error.property)).toContain('title');
	});

	it('refuses an id that is not an entity id, because a hit has to be resolvable back to its row', () => {
		expect(validateSync(document({ entityId: 'row-1' })).map((error) => error.property)).toEqual(['entityId']);
	});

	it('keeps the entity key and the title inside the columns that store them', () => {
		expect(validateSync(document({ entity: 'a'.repeat(128) })).map((error) => error.property)).toEqual([]);
		expect(validateSync(document({ entity: 'a'.repeat(129) })).map((error) => error.property)).toEqual(['entity']);
		expect(validateSync(document({ title: 'a'.repeat(512) })).map((error) => error.property)).toEqual([]);
		expect(validateSync(document({ title: 'a'.repeat(513) })).map((error) => error.property)).toEqual(['title']);
	});

	it('refuses a definition version below the first, which would make every row look stale', () => {
		expect(validateSync(document({ definitionVersion: 0 })).map((error) => error.property)).toEqual([
			'definitionVersion'
		]);
		expect(validateSync(document({ definitionVersion: 2 })).map((error) => error.property)).toEqual([]);
	});

	it('leaves the engine key open for the built-in provider and bounded for an engine', () => {
		expect(validateSync(document({ engineKey: undefined })).map((error) => error.property)).toEqual([]);
		expect(validateSync(document({ engineKey: 'engine' })).map((error) => error.property)).toEqual([]);
		expect(validateSync(document({ engineKey: 'a'.repeat(65) })).map((error) => error.property)).toEqual(['engineKey']);
	});

	it('refuses a source timestamp that is not a date, because staleness is decided by comparing it', () => {
		expect(validateSync(document({ sourceUpdatedAt: '2026-03-01T10:00:00Z' })).map((error) => error.property)).toEqual([]);
		expect(validateSync(document({ sourceUpdatedAt: 'yesterday' })).map((error) => error.property)).toEqual([
			'sourceUpdatedAt'
		]);
	});
});

import { validateSync } from 'class-validator';
import { getMetadataArgsStorage } from 'typeorm';
import { SearchFieldKind } from '@gauzy/contracts';
import { SearchIndexDefinition } from './search-index-definition.entity';

/**
 * The index definition, as the storage half of search owns it.
 *
 * The declaration is *data*: it says which fields of an entity the index holds, how much each of them
 * counts, whether it may be searched, filtered or faceted, and which of them are promoted into the
 * document's filterable token list. Two properties are asserted here. The first is the table contract
 * a query and an indexer depend on — including that `defaultWeight` is an exact decimal at the scale
 * the column declares, because the driver returns it as a string and a float here would promise a
 * type the row never carries. The second is what a definition must state before it is written, so a
 * malformed declaration cannot produce an index that silently never matches.
 *
 * The field *list* itself is validated where it is authored — the search package's registry refuses a
 * definition whose kinds disagree with their flags — so this suite pins the storage contract the
 * registry writes into rather than re-implementing that validation.
 */

type Row = Record<string, any>;

/** The declared columns of the entity and of everything it extends, through the ORM's own metadata. */
const columnsOf = (entity: unknown): string[] => {
	const storage = getMetadataArgsStorage();
	const names = new Set<string>();

	for (let target = entity as Row; target && target !== Object; target = Object.getPrototypeOf(target)) {
		for (const column of storage.columns.filter((entry) => entry.target === target)) {
			names.add(column.propertyName);
		}
	}

	return [...names];
};

/** The declared column options of one property, through the ORM's own metadata. */
const optionsOf = (entity: unknown, property: string): Row | undefined => {
	const storage = getMetadataArgsStorage();

	for (let target = entity as Row; target && target !== Object; target = Object.getPrototypeOf(target)) {
		const declared = storage.columns.find((entry) => entry.target === target && entry.propertyName === property);

		if (declared) {
			return declared.options as Row;
		}
	}

	return undefined;
};

/** One definition, as a package registers it, so a case can vary exactly one thing. */
const definition = (overrides: Row = {}): SearchIndexDefinition =>
	Object.assign(new SearchIndexDefinition(), {
		entity: 'product',
		label: 'Products',
		fields: [
			{ name: 'name', kind: SearchFieldKind.TEXT, weight: 3, searchable: true, filterable: false, facetable: false },
			{ name: 'categoryId', kind: SearchFieldKind.ENTITY, weight: 1, searchable: false, filterable: true, facetable: true }
		],
		defaultWeight: '1',
		keywordFields: ['categoryId'],
		sourceUpdatedAtField: 'updatedAt',
		isSystem: false,
		version: 1,
		...overrides
	});

describe('the columns a query and an indexer read', () => {
	it('declares the entity key, the labels, the field list and the templates', () => {
		const columns = columnsOf(SearchIndexDefinition);

		// A request passes the entity key as its entity filter; an indexer reads the field list, the
		// templates, the promoted token list and the source column that decides staleness.
		expect(columns).toEqual(
			expect.arrayContaining([
				'entity',
				'label',
				'engineKey',
				'fields',
				'defaultWeight',
				'titleTemplate',
				'bodyTemplate',
				'keywordFields',
				'sourceUpdatedAtField',
				'isSystem',
				'version',
				'metadata',
				'tenantId',
				'organizationId'
			])
		);
	});

	it('keeps the default weight an exact decimal at the column’s own scale', () => {
		// The driver returns a numeric column as a string, so the value is stored and read as a decimal
		// rather than as a float that would have to be rounded back into one.
		expect(optionsOf(SearchIndexDefinition, 'defaultWeight')).toMatchObject({
			type: 'numeric',
			precision: 9,
			scale: 6,
			default: 1
		});
	});

	it('keeps the entity key bounded, because it is the value a request filters by', () => {
		expect(optionsOf(SearchIndexDefinition, 'entity')).toMatchObject({ type: 'varchar', length: 128 });
	});

	it('leaves the engine key open for the built-in provider, which is what makes search work unconfigured', () => {
		// Null means the built-in database provider wrote the definition, and the definition is one row
		// per entity per engine.
		expect(optionsOf(SearchIndexDefinition, 'engineKey')).toMatchObject({
			type: 'varchar',
			length: 64,
			nullable: true
		});
	});
});

describe('what a definition must state', () => {
	it('accepts the declaration a seeded definition carries', () => {
		expect(validateSync(definition()).map((error) => error.property)).toEqual([]);
	});

	it('requires the entity key and the label a searchable entity is listed by', () => {
		expect(validateSync(definition({ entity: undefined })).map((error) => error.property)).toEqual(['entity']);
		expect(validateSync(definition({ label: undefined })).map((error) => error.property)).toEqual(['label']);
	});

	it('keeps the entity key, the label and the templates inside the columns that store them', () => {
		expect(validateSync(definition({ entity: 'a'.repeat(129) })).map((error) => error.property)).toEqual(['entity']);
		expect(validateSync(definition({ label: 'a'.repeat(256) })).map((error) => error.property)).toEqual(['label']);
		expect(validateSync(definition({ titleTemplate: 'a'.repeat(513) })).map((error) => error.property)).toEqual([
			'titleTemplate'
		]);
		expect(validateSync(definition({ bodyTemplate: 'a'.repeat(1_025) })).map((error) => error.property)).toEqual([
			'bodyTemplate'
		]);
	});

	it('requires the source column whose movement decides staleness', () => {
		expect(validateSync(definition({ sourceUpdatedAtField: undefined })).map((error) => error.property)).toEqual([
			'sourceUpdatedAtField'
		]);
	});

	it('refuses a version below the first, which is what a definition bump starts from', () => {
		// The version is how a weight change takes effect: a document built at an older one is rebuilt.
		expect(validateSync(definition({ version: 0 })).map((error) => error.property)).toEqual(['version']);
		expect(validateSync(definition({ version: 2 })).map((error) => error.property)).toEqual([]);
	});

	it('refuses a flag that is not a boolean, because `isSystem` decides whether a definition may be deleted', () => {
		expect(validateSync(definition({ isSystem: 'yes' })).map((error) => error.property)).toEqual(['isSystem']);
	});

	it('leaves the engine key and the templates optional', () => {
		expect(
			validateSync(definition({ engineKey: undefined, titleTemplate: undefined, bodyTemplate: undefined })).map(
				(error) => error.property
			)
		).toEqual([]);
	});

	it('refuses an engine key longer than the column that stores it', () => {
		expect(validateSync(definition({ engineKey: 'a'.repeat(65) })).map((error) => error.property)).toEqual(['engineKey']);
	});
});

describe('the definition a document is built from', () => {
	it('names the fields a filter and a facet refer to, and the flags that decide how each is used', () => {
		// The declaration is what makes a filter on an undeclared field refusable rather than silently
		// matching nothing, so the field list is part of the storage contract.
		const fields = definition().fields;

		expect(fields.map((field) => field.name)).toEqual(['name', 'categoryId']);
		expect(fields[0]).toMatchObject({ kind: SearchFieldKind.TEXT, searchable: true, filterable: false });
		expect(fields[1]).toMatchObject({ kind: SearchFieldKind.ENTITY, filterable: true, facetable: true });
		// Weights are normalised into the document at index time, so they are declared per field.
		expect(fields.every((field) => typeof field.weight === 'number')).toBe(true);
	});
});

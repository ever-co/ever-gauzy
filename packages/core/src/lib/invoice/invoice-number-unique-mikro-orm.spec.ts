import { MetadataStorage } from '@mikro-orm/core';

/**
 * GHSA-57hw-jqpj-ww97, MikroORM half of the entity change.
 *
 * `MultiORMColumn` and the relation decorators register properties for the ACTIVE ORM only, so the
 * unique has to be declared per ORM as well — and MikroORM validates index properties against the
 * ones it knows, which is why it keys on the `tenant` relation rather than the (non-persisted)
 * `tenantId`. The entity is re-imported in a fresh module registry with `DB_ORM=mikro-orm`, because
 * the decorator decides at class-definition time.
 */
describe('Invoice entity under MikroORM (GHSA-57hw-jqpj-ww97)', () => {
	const originalOrm = process.env.DB_ORM;

	afterAll(() => {
		if (originalOrm === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = originalOrm;
		}
	});

	it('registers a unique on (tenant, invoiceNumber) and none on invoiceNumber alone', () => {
		process.env.DB_ORM = 'mikro-orm';

		jest.isolateModules(() => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			require('../core/entities/internal');
		});

		// Read the storage by key rather than by class: MikroORM files metadata under
		// `<className>-<hash of the file the decorator ran in>`, and the decorator inside
		// `jest.isolateModules` and a later lookup from this file do not land on the same key.
		const storage: Record<string, { uniques?: Array<{ properties: string | string[] }> }> = (
			MetadataStorage as any
		).metadata;
		const propertySets = Object.entries(storage)
			.filter(([key]) => key.startsWith('Invoice-'))
			.flatMap(([, meta]) => (meta.uniques ?? []).map((unique) => unique.properties));

		expect(propertySets).toContainEqual(['tenant', 'invoiceNumber']);
		expect(propertySets).not.toContainEqual(['invoiceNumber']);
		expect(propertySets).not.toContainEqual('invoiceNumber');
	});
});

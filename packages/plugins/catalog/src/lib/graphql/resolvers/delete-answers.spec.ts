/**
 * `deleteCollection` and `deleteProductRelation` answer whether a row was removed — owner decision, handover
 * 2026-09-20 §7.65 item 21: "GraphQL delete of a non-existent id answers false".
 *
 * Both fields used to `return true` after the service's delete, which is the kernel's
 * `TenantAwareCrudService.delete`: it does not read the row first, so an identifier that names no row — or
 * another tenant's row — runs a statement that touches nothing and reports `affected: 0`, which the REST
 * route hands back as it is. The fields now answer from that count through the kernel's `answersDeleted`.
 *
 * Nothing is doubled but the service, so `answersDeleted` is the kernel's own; the cost is that this suite
 * loads the `@gauzy/core` barrel, as `soft-delete.spec.ts` does.
 */
import { CollectionResolver } from './collection.resolver';
import { ProductRelationResolver } from './product-relation.resolver';

const ID = 'row-1';

/** The converted fields: the resolver, the property its service sits under, and the method it awaits. */
const ROWS = [
	{ field: 'deleteCollection', resolver: CollectionResolver, service: 'collectionService', method: 'delete' },
	{
		field: 'deleteProductRelation',
		resolver: ProductRelationResolver,
		service: 'productRelationService',
		method: 'delete'
	}
];

/** Runs one field against a service whose delete answers `outcome`. */
function invoke(row: (typeof ROWS)[number], outcome: unknown) {
	const stub = jest.fn().mockResolvedValue(outcome);
	const resolver = Object.create(row.resolver.prototype) as Record<string, any>;
	resolver[row.service] = { [row.method]: stub };

	return { stub, answer: resolver[row.field](ID) as Promise<boolean> };
}

describe('catalog delete fields answer whether a row was removed', () => {
	describe.each(ROWS)('$field', (row) => {
		it('answers false when the delete affected no row', async () => {
			await expect(invoke(row, { affected: 0, raw: [] }).answer).resolves.toBe(false);
		});

		it('answers true when the delete affected a row', async () => {
			await expect(invoke(row, { affected: 1, raw: [] }).answer).resolves.toBe(true);
		});

		it('hands the service the same identifier as before', async () => {
			const { stub, answer } = invoke(row, { affected: 1, raw: [] });
			await answer;

			expect(stub).toHaveBeenCalledTimes(1);
			expect(stub).toHaveBeenCalledWith(ID);
		});
	});
});

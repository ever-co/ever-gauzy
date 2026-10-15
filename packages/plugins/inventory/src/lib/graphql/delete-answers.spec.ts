/**
 * `deleteStockAlert` answers whether a rule was removed — owner decision, handover 2026-09-20 §7.65 item 21:
 * "GraphQL delete of a non-existent id answers false".
 *
 * The field used to answer `.then(() => true)` after the service's delete, which is the kernel's
 * `TenantAwareCrudService.delete`: it does not read the row first, so an identifier that names no rule — or
 * another tenant's rule — runs a statement that touches nothing and reports `affected: 0`, which the REST
 * route hands back as it is. The field now answers from that count through the kernel's `answersDeleted`.
 *
 * Nothing is doubled but the service, so `answersDeleted` is the kernel's own; the cost is that this suite
 * loads the `@gauzy/core` barrel, as `write-routes.spec.ts` does.
 */
import { StockAlertResolver } from './stock-alert.resolver';

const ID = 'rule-1';

/** One converted field: the resolver, the property its service sits under, and the method it awaits. */
const ROWS = [{ field: 'deleteStockAlert', resolver: StockAlertResolver, service: 'service', method: 'delete' }];

/** Runs one field against a service whose delete answers `outcome`. */
function invoke(row: (typeof ROWS)[number], outcome: unknown) {
	const stub = jest.fn().mockResolvedValue(outcome);
	const resolver = Object.create(row.resolver.prototype) as Record<string, any>;
	resolver[row.service] = { [row.method]: stub };

	return { stub, answer: resolver[row.field](ID) as Promise<boolean> };
}

describe('inventory delete fields answer whether a row was removed', () => {
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

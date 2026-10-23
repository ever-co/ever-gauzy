import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary: the base
 * the cart services inherit is reduced to the switch it states. The organization boundary itself — who it confines,
 * and how every read, write and delete of the base keeps to it, a delete by id of a row outside it answering
 * `affected: 0` — is proven against real stores on both ORMs in core
 * (`tenant-aware-crud.service.organization-boundary.spec.ts`). What is proven here is that the cart services ask for
 * it; the refusal the cart's create adds on top is proven in `commerce-cart.service.spec.ts` (R2-G19). **The cart base
 * under test is the real one.**
 */
jest.mock('@gauzy/core', () => {
	class TenantAwareCrudService {
		/** Off in the platform's base: a service applies the boundary only when it says so. */
		protected appliesOrganizationBoundary(): boolean {
			return false;
		}
	}

	return { TenantAwareCrudService };
});

import { CartCrudService } from './cart-crud.service';

class CommerceCartService extends CartCrudService<any> {
	applies(): boolean {
		return this.appliesOrganizationBoundary();
	}
}

/** Every `*.service.ts` file under a folder. */
function serviceFiles(folder: string): string[] {
	return readdirSync(folder).flatMap((name) => {
		const path = join(folder, name);
		if (statSync(path).isDirectory()) {
			return serviceFiles(path);
		}
		return name.endsWith('.service.ts') ? [path] : [];
	});
}

describe('CartCrudService — the cart services keep every caller inside the organization boundary', () => {
	const service = new CommerceCartService(undefined as never, undefined as never);

	it('applies the platform’s organization boundary', () => {
		expect(service.applies()).toBe(true);
	});

	it('is the base of every cart service: none extends the tenant-aware base directly', () => {
		const direct = serviceFiles(__dirname)
			.filter((path) => !path.endsWith('cart-crud.service.ts'))
			.filter((path) => /extends\s+TenantAwareCrudService\b/.test(readFileSync(path, 'utf8')));

		expect(direct).toEqual([]);
	});
});

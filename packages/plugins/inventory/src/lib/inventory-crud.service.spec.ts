import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary: the base
 * the inventory services inherit is reduced to the reads and the delete it states. The organization boundary itself —
 * who it confines, and how every read, write and delete of the base keeps to it — is proven against real stores on
 * both ORMs in core (`tenant-aware-crud.service.organization-boundary.spec.ts`). What is proven here is that the
 * inventory services ask for it, and what the inventory base adds on top. **The inventory base under test is the real
 * one.** How the channel assignment's own delete keeps to the boundary is in `channel-warehouse.service.spec.ts`.
 */
const deleted: unknown[] = [];

/** The rows the stand-in base finds: what a caller inside the boundary reaches. */
const reachable = new Set<string>();

jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	class TenantAwareCrudService {
		/** Off in the platform's base: a service applies the boundary only when it says so. */
		protected appliesOrganizationBoundary(): boolean {
			return false;
		}

		/** The read by id, kept inside the boundary: a row the caller cannot reach is a miss. */
		async findOneByIdString(id: string): Promise<unknown> {
			if (!reachable.has(id)) {
				throw new NotFoundException('The requested record was not found');
			}
			return { id };
		}

		/** The delete, which answers a row outside the boundary as a missing one: `affected: 0`. */
		async delete(criteria: unknown): Promise<unknown> {
			deleted.push(criteria);
			return { affected: 1, raw: [] };
		}
	}

	return { TenantAwareCrudService };
});

import { NotFoundException } from '@nestjs/common';
import { InventoryCrudService } from './inventory-crud.service';

class AlertService extends InventoryCrudService<any> {
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

describe('InventoryCrudService — the inventory services keep every caller inside the organization boundary', () => {
	const service = new AlertService(undefined as never, undefined as never);

	beforeEach(() => {
		deleted.length = 0;
		reachable.clear();
		reachable.add('own');
	});

	it('applies the platform’s organization boundary', () => {
		expect(service.applies()).toBe(true);
	});

	it('is the base of every inventory service: none extends the tenant-aware base directly', () => {
		const direct = serviceFiles(__dirname)
			.filter((path) => !path.endsWith('inventory-crud.service.ts'))
			.filter((path) => /extends\s+TenantAwareCrudService\b/.test(readFileSync(path, 'utf8')));

		expect(direct).toEqual([]);
	});

	it('answers a delete by id of a row outside the boundary with the read’s 404, and deletes nothing', async () => {
		await expect(service.delete('sibling')).rejects.toBeInstanceOf(NotFoundException);
		expect(deleted).toEqual([]);
	});

	it('deletes a row inside the boundary by its id', async () => {
		await service.delete('own');
		expect(deleted).toEqual(['own']);
	});
});

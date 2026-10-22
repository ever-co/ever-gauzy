/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary: the base
 * the order services inherit is reduced to the tenant-scoped reads and delete it states, and the request scope is the
 * caller's tenant and organization. **The order base under test is the real one.**
 */
const ORG = '00000000-0000-4000-8000-000000000002';
const SIBLING_ORG = '00000000-0000-4000-8000-000000000003';
const rows: Record<string, Record<string, unknown>> = {};
const deleted: unknown[] = [];
let callerOrganization: string | null = ORG;

jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	class TenantAwareCrudService {
		/** The tenant-scoped read: every row of the caller's tenant, of any organization. */
		async findOneByIdString(id: string): Promise<unknown> {
			if (!rows[id]) {
				throw new NotFoundException('The requested record was not found');
			}
			return rows[id];
		}

		/** The tenant-scoped read by conditions: the first row of the caller's tenant that matches. */
		async findOneByWhereOptions(where: Record<string, unknown>): Promise<unknown> {
			const row = Object.values(rows).find((candidate) =>
				Object.entries(where).every(([key, value]) => candidate[key] === value)
			);
			if (!row) {
				throw new NotFoundException('The requested record was not found');
			}
			return row;
		}

		/** The tenant-scoped delete: `DELETE … WHERE id AND tenantId`, with no read. */
		async delete(criteria: unknown): Promise<unknown> {
			deleted.push(criteria);
			return { affected: 1, raw: [] };
		}
	}

	return {
		TenantAwareCrudService,
		RequestContext: {
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => callerOrganization
		}
	};
});

import { NotFoundException } from '@nestjs/common';
import { OrderCrudService } from './order-crud.service';

class OrderService extends OrderCrudService<any> {}

describe('OrderCrudService — a row addressed by its identifier or its number is a row of the caller’s organization', () => {
	const service = new OrderService(undefined as never, undefined as never);

	beforeEach(() => {
		callerOrganization = ORG;
		deleted.length = 0;
		rows['own'] = { id: 'own', number: 'ORD-1', organizationId: ORG };
		rows['sibling'] = { id: 'sibling', number: 'ORD-2', organizationId: SIBLING_ORG };
		rows['unowned'] = { id: 'unowned', number: 'ORD-3', organizationId: null };
	});

	it('reads the caller’s own row, and a row stored without an organization', async () => {
		await expect(service.findOneByIdString('own')).resolves.toMatchObject({ id: 'own' });
		await expect(service.findOneByIdString('unowned')).resolves.toMatchObject({ id: 'unowned' });
	});

	it('answers a sibling organization’s row as a miss — the GET, the update’s pre-read, the change confirmation, withdraw and restore', async () => {
		await expect(service.findOneByIdString('sibling')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('answers a sibling organization’s order number as a miss, and reads the caller’s own', async () => {
		await expect(service.findOneByWhereOptions({ number: 'ORD-2' })).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.findOneByWhereOptions({ number: 'ORD-1' })).resolves.toMatchObject({ id: 'own' });
	});

	it('does not delete a sibling organization’s row by its identifier, and deletes the caller’s own', async () => {
		await expect(service.delete('sibling')).rejects.toBeInstanceOf(NotFoundException);
		expect(deleted).toEqual([]);

		await service.delete('own');
		expect(deleted).toEqual(['own']);
	});

	it('does not narrow a caller with no organization in context (the staleness sweep)', async () => {
		callerOrganization = null;

		await expect(service.findOneByIdString('sibling')).resolves.toMatchObject({ id: 'sibling' });
		await expect(service.findOneByWhereOptions({ number: 'ORD-2' })).resolves.toMatchObject({ id: 'sibling' });
	});
});

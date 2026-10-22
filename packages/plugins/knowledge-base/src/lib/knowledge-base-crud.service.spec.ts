/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary: the base
 * the knowledge-base services inherit is reduced to the tenant-scoped reads and delete it states, and the request
 * scope is the caller's tenant and organization. **The knowledge-base base under test is the real one**, and so is
 * the help-center service whose base-id routes build their own reads.
 */
const ORG = '00000000-0000-4000-8000-000000000002';
const SIBLING_ORG = '00000000-0000-4000-8000-000000000003';
const rows: Record<string, Record<string, unknown>> = {};
const deleted: unknown[] = [];
const finds: unknown[] = [];
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

		/** The tenant-scoped read that reports a miss instead of raising it. */
		async findOneOrFailByIdString(id: string): Promise<unknown> {
			return rows[id] ? { success: true, record: rows[id] } : { success: false, error: new NotFoundException() };
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

		/** The tenant-scoped list, recording the conditions it was given. */
		async find(options: { where?: Record<string, unknown> } = {}): Promise<unknown[]> {
			finds.push(options.where);
			return Object.values(rows).filter((row) =>
				Object.entries(options.where ?? {}).every(([key, value]) => row[key] === value)
			);
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
jest.mock('./help-center/help-center.entity', () => ({ HelpCenter: class {} }));
jest.mock('./help-center/repository/type-orm-help-center.repository', () => ({
	TypeOrmHelpCenterRepository: class {}
}));
jest.mock('./help-center/repository/mikro-orm-help-center.repository', () => ({
	MikroOrmHelpCenterRepository: class {}
}));

import { NotFoundException } from '@nestjs/common';
import { KnowledgeBaseCrudService } from './knowledge-base-crud.service';
import { HelpCenterService } from './help-center/help-center.service';

class HelpCenterAuthorService extends KnowledgeBaseCrudService<any> {}

describe('KnowledgeBaseCrudService — a row addressed by its identifier is a row of the caller’s organization', () => {
	const service = new HelpCenterAuthorService(undefined as never, undefined as never);

	beforeEach(() => {
		callerOrganization = ORG;
		deleted.length = 0;
		finds.length = 0;
		for (const key of Object.keys(rows)) {
			delete rows[key];
		}
		rows['own'] = { id: 'own', parentId: 'base', organizationId: ORG };
		rows['sibling'] = { id: 'sibling', parentId: 'base', organizationId: SIBLING_ORG };
		rows['unowned'] = { id: 'unowned', organizationId: null };
	});

	it('reads the caller’s own row, and a row stored without an organization', async () => {
		await expect(service.findOneByIdString('own')).resolves.toMatchObject({ id: 'own' });
		await expect(service.findOneByIdString('unowned')).resolves.toMatchObject({ id: 'unowned' });
		await expect(service.findOneOrFailByIdString('own')).resolves.toMatchObject({ success: true });
	});

	it('answers a sibling organization’s row as a miss — the GET, the update’s pre-read, versioning, duplicate and restore', async () => {
		await expect(service.findOneByIdString('sibling')).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.findOneOrFailByIdString('sibling')).resolves.toMatchObject({ success: false });
		await expect(service.findOneByWhereOptions({ id: 'sibling' })).rejects.toBeInstanceOf(NotFoundException);
	});

	it('does not delete a sibling organization’s row by its identifier, answering it as a row that is not there', async () => {
		await expect(service.delete('sibling')).resolves.toMatchObject({ affected: 0 });
		expect(deleted).toEqual([]);

		await service.delete('own');
		expect(deleted).toEqual(['own']);
	});

	it('does not narrow a caller with no organization in context (the seeder)', async () => {
		callerOrganization = null;

		await expect(service.findOneByIdString('sibling')).resolves.toMatchObject({ id: 'sibling' });
	});

	it('lists, and so bulk-deletes, the categories under a base inside the caller’s organization only', async () => {
		const helpCenters = new HelpCenterService(undefined as never, undefined as never);

		await expect(helpCenters.getCategoriesByBaseId('base')).resolves.toEqual([rows['own']]);
		await expect(helpCenters.getAllNodes()).resolves.toEqual([rows['own']]);
		expect(finds).toEqual([{ parentId: 'base', organizationId: ORG }, { organizationId: ORG }]);
	});
});

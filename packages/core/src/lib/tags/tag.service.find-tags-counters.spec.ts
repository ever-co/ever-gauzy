import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TagService } from './tag.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `findTags` LEFT JOINs every tagged relation at once, so each usage counter must be a
 * `COUNT(DISTINCT ...)`: a plain COUNT multiplies it by the matches of every other relation
 * (a tag on 2 employees and 3 tasks used to report 6 employees and 6 tasks).
 */
describe('TagService.findTags usage counters (TypeORM)', () => {
	const { tenantA } = createCrossTenantFixture();

	let restore: () => void;
	let addSelect: jest.Mock;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		addSelect = jest.fn();
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('counts each relation with COUNT(DISTINCT ...)', async () => {
		const query = {
			alias: 'tag',
			setFindOptions: jest.fn(),
			leftJoin: jest.fn(),
			select: jest.fn(),
			addSelect,
			addGroupBy: jest.fn(),
			where: jest.fn(),
			getRawMany: jest.fn().mockResolvedValue([])
		};
		const service = new TagService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'tag' }, createQueryBuilder: jest.fn().mockReturnValue(query) } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);

		await service.findTags({ tenantId: tenantA.tenantId, organizationId: tenantA.organizationId });

		const counters = addSelect.mock.calls.filter(([, alias]) => String(alias).endsWith('_counter'));
		expect(counters.length).toBeGreaterThan(0);
		for (const [selection, alias] of counters) {
			expect({ alias, selection }).toEqual({ alias, selection: expect.stringContaining('COUNT(DISTINCT ') });
		}
	});
});

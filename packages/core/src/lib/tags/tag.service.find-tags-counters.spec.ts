import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TagService } from './tag.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

// The TypeORM branch's usage counters run against a real database in `tag.service.counters.spec.ts`.

/**
 * The MikroORM branch returns entities, not the TypeORM raw rows, so it has to load `tagType` itself and
 * expose `tagTypeName` for the tags page's Type column.
 */
describe('TagService.findTags tag type (MikroORM)', () => {
	const { tenantA } = createCrossTenantFixture();

	let restore: () => void;
	let findAndCount: jest.Mock;
	let service: TagService;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		// `serialize` uses MikroORM's wrap(); these stand-in rows are already plain objects
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(TagService.prototype as any, 'serialize').mockImplementation((entity: object) => ({ ...entity }));
		findAndCount = jest.fn().mockResolvedValue([
			[
				{ id: 'tag-1', name: 'Urgent', tagType: { type: 'Priority' } },
				{ id: 'tag-2', name: 'Misc', tagType: null }
			],
			2
		]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new TagService({ metadata: { tableName: 'tag' } } as any, { findAndCount } as any);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('always populates tagType and exposes its type as tagTypeName', async () => {
		// No relations requested: tagType must still be loaded
		const { items } = await service.findTags({
			tenantId: tenantA.tenantId,
			organizationId: tenantA.organizationId
		});

		expect(findAndCount.mock.calls[0][1].populate).toEqual(['tagType']);
		const rows = items as unknown as Array<{ tagTypeName: string | null }>;
		expect(rows.map((tag) => tag.tagTypeName)).toEqual(['Priority', null]);
	});
});

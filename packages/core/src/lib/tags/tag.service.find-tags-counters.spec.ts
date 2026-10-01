import '../core/entities/internal';

import * as config from '@gauzy/config';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TAG_USAGE_COUNTERS, TagService } from './tag.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `findTags` LEFT JOINs every tagged relation at once, so each usage counter must be a
 * `COUNT(DISTINCT ...)`: a plain COUNT multiplies it by the matches of every other relation
 * (a tag on 2 employees and 3 tasks used to report 6 employees and 6 tasks).
 *
 * The query builder is a recorder: it checks which joins and selections are built, not the SQL a
 * database would run. The WHERE callback (tenant / organization filtering) is not executed here.
 */
describe('TagService.findTags usage counters (TypeORM)', () => {
	const { tenantA } = createCrossTenantFixture();
	// Quotes differ per database (`"x"` on PostgreSQL / SQLite, backticks on MySQL)
	const countOf = (alias: string) => new RegExp(`COUNT\\(DISTINCT [\`"]?${alias}[\`"]?\\.[\`"]?id[\`"]?\\)`);

	let restore: () => void;
	let query: Record<string, jest.Mock | string>;

	const findTags = async () => {
		const service = new TagService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'tag' }, createQueryBuilder: jest.fn().mockReturnValue(query) } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
		await service.findTags({ tenantId: tenantA.tenantId, organizationId: tenantA.organizationId });
	};
	const selections = () => new Map((query.addSelect as jest.Mock).mock.calls.map(([sql, alias]) => [alias, sql]));
	const withTagCustomFields = (fields: object[]) => {
		const original = config.getConfig();
		jest.spyOn(config, 'getConfig').mockReturnValue({
			...original,
			customFields: { ...original.customFields, Tag: fields }
		} as unknown as ReturnType<typeof config.getConfig>);
	};

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		query = {
			alias: 'tag',
			setFindOptions: jest.fn(),
			leftJoin: jest.fn(),
			select: jest.fn(),
			addSelect: jest.fn(),
			addGroupBy: jest.fn(),
			where: jest.fn(),
			getRawMany: jest.fn().mockResolvedValue([])
		};
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('joins every tagged relation and counts each one once, under its own counter', async () => {
		withTagCustomFields([]);
		await findTags();

		const selected = selections();
		for (const [relation, alias, counter] of TAG_USAGE_COUNTERS) {
			expect(query.leftJoin).toHaveBeenCalledWith(`tag.${relation}`, alias);
			expect(selected.get(counter)).toMatch(countOf(alias));
		}
		// No other counter than the expected ones
		const counters = [...selected.keys()].filter((alias) => String(alias).endsWith('_counter'));
		expect(counters.sort()).toEqual(TAG_USAGE_COUNTERS.map(([, , counter]) => counter).sort());
	});

	it('counts many-to-many custom fields with COUNT(DISTINCT ...) too', async () => {
		withTagCustomFields([{ name: 'labels', type: 'relation', relationType: 'many-to-many' }]);

		await findTags();

		expect(query.leftJoin).toHaveBeenCalledWith('tag.customFields.labels', 'labels');
		expect(selections().get('labels_counter')).toMatch(countOf('labels'));
	});
});

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

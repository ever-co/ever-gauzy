import '../core/entities/internal';

import * as config from '@gauzy/config';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TagService } from './tag.service';

/**
 * The MikroORM tag queries filter by name / color / description. `$ilike` is PostgreSQL-only in MikroORM,
 * so the filters must use `$like` on MySQL / SQLite, and both queries must keep all three filters.
 */
describe('TagService MikroORM text filters', () => {
	const { tenantA } = createCrossTenantFixture();
	const input = { tenantId: tenantA.tenantId, organizationId: tenantA.organizationId };
	const search = { name: 'Urgent', color: '#f00', description: 'blocker' };

	let restore: () => void;
	let findAndCount: jest.Mock;
	let service: TagService;

	const withMikroOrmDriver = (driver: unknown) => {
		const original = config.getConfig();
		jest.spyOn(config, 'getConfig').mockReturnValue({
			...original,
			dbMikroOrmConnectionOptions: { ...original.dbMikroOrmConnectionOptions, driver }
		} as unknown as ReturnType<typeof config.getConfig>);
	};

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn(TagService.prototype as any, 'serialize').mockImplementation((entity: object) => ({ ...entity }));
		findAndCount = jest.fn().mockResolvedValue([[], 0]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new TagService({ metadata: { tableName: 'tag' } } as any, { findAndCount } as any);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const queries = {
		findTagsByLevel: () => service.findTagsByLevel({ ...input, ...search }),
		findTags: () => service.findTags({ ...input, ...search })
	};

	describe.each(Object.keys(queries))('%s', (query: keyof typeof queries) => {
		it('uses $ilike for every text filter on PostgreSQL', async () => {
			withMikroOrmDriver(PostgreSqlDriver);
			await queries[query]();
			expect(findAndCount.mock.calls[0][0]).toMatchObject({
				name: { $ilike: '%Urgent%' },
				color: { $ilike: '%#f00%' },
				description: { $ilike: '%blocker%' }
			});
		});

		it('uses $like for every text filter on MySQL', async () => {
			withMikroOrmDriver(MySqlDriver);
			await queries[query]();
			expect(findAndCount.mock.calls[0][0]).toMatchObject({
				name: { $like: '%Urgent%' },
				color: { $like: '%#f00%' },
				description: { $like: '%blocker%' }
			});
		});
	});
});

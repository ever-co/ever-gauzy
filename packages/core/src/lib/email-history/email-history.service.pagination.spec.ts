import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmailHistoryService } from './email-history.service';

/**
 * The email history list read `take` but never `skip`, so `GET /email-history?take=20&skip=2` answered the
 * newest 20 rows on every page.
 */
describe('EmailHistoryService.findAll pages', () => {
	const filterFor = (page: Record<string, unknown>) => ({ where: { organizationId: 'org-1' }, ...page }) as any;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	});

	afterEach(() => jest.restoreAllMocks());

	describe('TypeORM', () => {
		const run = async (page: Record<string, unknown>) => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			const query: Record<string, jest.Mock | string> = { alias: 'email_sent' };
			for (const method of ['leftJoin', 'addSelect', 'where', 'take', 'skip', 'orderBy', 'withDeleted']) {
				query[method] = jest.fn().mockReturnValue(query);
			}
			query.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
			const service = new EmailHistoryService(
				{ metadata: { tableName: 'email_sent' }, createQueryBuilder: () => query } as any,
				{} as any
			);
			await service.findAll(filterFor(page));
			return query as Record<string, jest.Mock>;
		};

		it('skips the rows of the previous pages', async () => {
			const query = await run({ take: 20, skip: 3 });
			expect(query.take).toHaveBeenCalledWith(20);
			expect(query.skip).toHaveBeenCalledWith(40);
		});

		it('starts at the first row without a page, 20 rows by default', async () => {
			const query = await run({});
			expect(query.take).toHaveBeenCalledWith(20);
			expect(query.skip).toHaveBeenCalledWith(0);
		});
	});

	describe('MikroORM', () => {
		it('passes the page offset', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			const findAndCount = jest.fn().mockResolvedValue([[], 0]);
			const service = new EmailHistoryService(
				{ metadata: { tableName: 'email_sent' } } as any,
				{ findAndCount } as any
			);

			await service.findAll(filterFor({ take: 10, skip: 2 }));

			expect(findAndCount.mock.calls[0][1]).toMatchObject({ limit: 10, offset: 10 });
		});
	});
});

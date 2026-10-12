import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { CandidateService } from './candidate.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `CandidateService.pagination` builds its own query, so the sort the candidates table sends
 * (`order[appliedDate]=DESC`, ...) only takes effect if each ORM branch forwards it.
 */
describe('CandidateService.pagination sort order', () => {
	const { tenantA } = createCrossTenantFixture();
	const typeOrmRepositoryMetadata = { metadata: { tableName: 'candidate' } };

	let restore: () => void;

	const paginate = (service: CandidateService, order?: unknown) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service.pagination({ where: { organizationId: tenantA.organizationId }, order, take: 10, skip: 1 } as any);

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('TypeORM', () => {
		let query: Record<string, unknown> & { setFindOptions: jest.Mock };
		let service: CandidateService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			query = {
				alias: 'candidate',
				leftJoin: jest.fn(),
				setFindOptions: jest.fn(),
				where: jest.fn(),
				getManyAndCount: jest.fn().mockResolvedValue([[], 0])
			};
			const typeOrmRepository = { ...typeOrmRepositoryMetadata, createQueryBuilder: jest.fn().mockReturnValue(query) };
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			service = new CandidateService(typeOrmRepository as any, {} as any);
		});

		it('forwards the sanitized order as `order`', async () => {
			await paginate(service, { appliedDate: 'desc', tenantId: 'ASC' });
			expect(query.setFindOptions).toHaveBeenCalledWith(
				expect.objectContaining({ order: { appliedDate: 'DESC' } })
			);
		});

		it('passes an empty order when no sort is requested', async () => {
			await paginate(service);
			expect(query.setFindOptions).toHaveBeenCalledWith(expect.objectContaining({ order: {} }));
		});
	});

	describe('MikroORM', () => {
		let findAndCount: jest.Mock;
		let service: CandidateService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			findAndCount = jest.fn().mockResolvedValue([[], 0]);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			service = new CandidateService(typeOrmRepositoryMetadata as any, { findAndCount } as any);
		});

		it('forwards the sanitized order as `orderBy`', async () => {
			await paginate(service, { status: 'ASC', hiredDate: 'sideways' });
			expect(findAndCount).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ orderBy: { status: 'ASC' } })
			);
		});

		it('passes an empty orderBy when no sort is requested', async () => {
			await paginate(service);
			expect(findAndCount).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderBy: {} }));
		});
	});
});

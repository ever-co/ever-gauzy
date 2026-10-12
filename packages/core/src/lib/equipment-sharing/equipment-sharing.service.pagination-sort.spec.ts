import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EquipmentSharingService } from './equipment-sharing.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `EquipmentSharingService.pagination` builds its own query, so the sort the equipment sharing table
 * sends (`order[shareStartDay]=DESC`, ...) only takes effect if each ORM branch forwards it.
 */
describe('EquipmentSharingService.pagination sort order', () => {
	const { tenantA } = createCrossTenantFixture();
	const typeOrmRepositoryMetadata = { metadata: { tableName: 'equipment_sharing' } };
	const configService = { dbConnectionOptions: { type: 'postgres' } };

	let restore: () => void;

	const createService = (typeOrmRepository: unknown, mikroOrmRepository: unknown) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		new EquipmentSharingService(typeOrmRepository as any, mikroOrmRepository as any, {} as any, configService as any);

	const paginate = (service: EquipmentSharingService, order?: unknown) =>
		service.pagination({ where: { organizationId: tenantA.organizationId }, order, take: 10, skip: 1 });

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('TypeORM', () => {
		let query: Record<string, unknown> & { addOrderBy: jest.Mock };
		let service: EquipmentSharingService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			query = {
				alias: 'equipment_sharing',
				innerJoinAndSelect: jest.fn(),
				leftJoinAndSelect: jest.fn(),
				andWhere: jest.fn(),
				addOrderBy: jest.fn(),
				getManyAndCount: jest.fn().mockResolvedValue([[], 0])
			};
			query.skip = jest.fn().mockReturnValue(query);
			query.take = jest.fn().mockReturnValue(query);
			service = createService(
				{ ...typeOrmRepositoryMetadata, createQueryBuilder: jest.fn().mockReturnValue(query) },
				{}
			);
		});

		it('adds an ORDER BY for each sanitized column, in the requested order', async () => {
			await paginate(service, { shareEndDay: 'asc', name: 'ASC', shareStartDay: 'DESC' });
			expect(query.addOrderBy.mock.calls).toEqual([
				['equipment_sharing.shareEndDay', 'ASC'],
				['equipment_sharing.shareStartDay', 'DESC']
			]);
		});

		it('adds no ORDER BY when no sort is requested', async () => {
			await paginate(service);
			expect(query.addOrderBy).not.toHaveBeenCalled();
		});
	});

	describe('MikroORM', () => {
		let findAndCount: jest.Mock;
		let service: EquipmentSharingService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			findAndCount = jest.fn().mockResolvedValue([[], 0]);
			service = createService(typeOrmRepositoryMetadata, { findAndCount });
		});

		it('forwards the sanitized order as `orderBy`', async () => {
			await paginate(service, { shareRequestDay: 'DESC', tenantId: 'ASC' });
			expect(findAndCount).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ orderBy: { shareRequestDay: 'DESC' } })
			);
		});

		it('passes an empty orderBy when no sort is requested', async () => {
			await paginate(service);
			expect(findAndCount).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderBy: {} }));
		});
	});
});

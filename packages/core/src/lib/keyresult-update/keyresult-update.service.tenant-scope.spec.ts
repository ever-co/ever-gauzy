import '../core/entities/internal';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { KeyResultUpdateService } from './keyresult-update.service';

/**
 * `findByKeyResultId` reads the repositories directly, so it states the caller's tenant itself. It filtered on the
 * key result alone, which answered another tenant's progress updates to anyone who named that key result.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const KEY_RESULT = '22222222-2222-4222-8222-222222222222';

function buildService() {
	const service: any = Object.create(KeyResultUpdateService.prototype);
	const builder: any = {
		where: jest.fn(() => builder),
		andWhere: jest.fn(() => builder),
		getMany: jest.fn(async () => [{ id: 'update-1' }])
	};
	service.typeOrmRepository = { createQueryBuilder: jest.fn(() => builder) };
	service.mikroOrmRepository = { find: jest.fn(async () => [{ id: 'update-1' }]) };
	service.serialize = (entity: unknown) => entity;
	return { service, builder };
}

afterEach(() => jest.restoreAllMocks());

describe('KeyResultUpdateService.findByKeyResultId', () => {
	it('reads only the caller’s tenant (TypeORM)', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		const { service, builder } = buildService();

		await expect(service.findByKeyResultId(KEY_RESULT)).resolves.toEqual([{ id: 'update-1' }]);

		expect(builder.where).toHaveBeenCalledWith('key_result_update.keyResultId = :keyResultId', {
			keyResultId: KEY_RESULT
		});
		expect(builder.andWhere).toHaveBeenCalledWith('key_result_update.tenantId = :tenantId', { tenantId: TENANT });
	});

	it('reads only the caller’s tenant (MikroORM)', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		const { service } = buildService();

		await service.findByKeyResultId(KEY_RESULT);

		expect(service.mikroOrmRepository.find).toHaveBeenCalledWith({ keyResultId: KEY_RESULT, tenantId: TENANT });
	});

	it('answers nothing, without reading, when the request has no tenant', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		const { service } = buildService();

		await expect(service.findByKeyResultId(KEY_RESULT)).resolves.toEqual([]);

		expect(service.typeOrmRepository.createQueryBuilder).not.toHaveBeenCalled();
	});
});

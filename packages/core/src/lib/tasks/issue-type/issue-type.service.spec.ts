import { MultiORMEnum } from '../../core/utils';
import { IssueTypeService } from './issue-type.service';

describe('IssueTypeService', () => {
	it('returns system defaults without logging an error when a TypeORM scope has no issue types', async () => {
		const queryBuilder = {
			where: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(null),
			getManyAndCount: jest.fn()
		};
		const typeOrmRepository = {
			metadata: { tableName: 'issue_type' },
			createQueryBuilder: jest.fn().mockReturnValue(queryBuilder)
		};
		const service = new IssueTypeService(typeOrmRepository as never, {} as never, {} as never);
		const defaults = { items: [], total: 0 };

		jest.spyOn(service, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(service, 'getDefaultEntities').mockResolvedValue(defaults);
		const errorLogger = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);

		await expect(
			service.fetchAll({
				tenantId: 'tenant-id',
				organizationId: 'organization-id',
				organizationTeamId: 'team-id'
			})
		).resolves.toStrictEqual(defaults);

		expect(queryBuilder.getOne).toHaveBeenCalledTimes(1);
		expect(queryBuilder.getManyAndCount).not.toHaveBeenCalled();
		expect(service.getDefaultEntities).toHaveBeenCalledTimes(1);
		expect(errorLogger).not.toHaveBeenCalled();
	});
});

import '../core/entities/internal';

jest.mock('@gauzy/config', () => ({ ...jest.requireActual('@gauzy/config'), isMySQL: jest.fn() }));

import { Brackets } from 'typeorm';
import { isMySQL } from '@gauzy/config';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EquipmentSharingService } from './equipment-sharing.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `GET /equipment-sharing/organization/:id` joined the approval requests with `uuid(x) = uuid(y)` on MySQL as
 * on PostgreSQL. MySQL's UUID() takes no argument, so the endpoint always failed there; its scope conditions
 * were double-quoted too.
 */
describe('EquipmentSharingService.findEquipmentSharingsByOrganizationId on MySQL', () => {
	const { tenantA } = createCrossTenantFixture();

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.mocked(isMySQL).mockReturnValue(true);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('joins the approval requests and scopes the query with MySQL syntax', async () => {
		let query: Record<string, any> = { alias: 'equipment_sharing' };
		for (const method of ['leftJoinAndSelect', 'innerJoinAndSelect', 'where']) {
			query[method] = jest.fn().mockReturnValue(query);
		}
		query.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
		const service = new EquipmentSharingService(
			{
				metadata: { tableName: 'equipment_sharing' },
				createQueryBuilder: jest.fn().mockReturnValue(query)
			} as any,
			{} as any,
			{} as any,
			{ dbConnectionOptions: { type: 'mysql' } } as any
		);

		await service.findEquipmentSharingsByOrganizationId(tenantA.organizationId);

		const approvalJoin = query.leftJoinAndSelect.mock.calls.find(([table]) => table === 'request_approval');
		expect(approvalJoin[2]).toBe('`equipment_sharing`.`id` = `requestApproval`.`requestId`');

		const scope = { andWhere: jest.fn() };
		(query.where.mock.calls[0][0] as Brackets).whereFactory(scope as any);
		expect(scope.andWhere.mock.calls).toEqual([
			['`equipment_sharing`.`tenantId` = :tenantId', { tenantId: tenantA.tenantId }],
			['`equipment_sharing`.`organizationId` = :organizationId', { organizationId: tenantA.organizationId }]
		]);
	});
});

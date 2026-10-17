import '../core/entities/internal';

jest.mock('@gauzy/config', () => ({ ...jest.requireActual('@gauzy/config'), isMySQL: jest.fn() }));

import { isMySQL } from '@gauzy/config';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { OrganizationVendorService } from './organization-vendor.service';

/**
 * Deleting a vendor first checks that no expense uses it. The check's raw SQL was double-quoted, which MySQL
 * reads as a string: the query failed there and no vendor could be deleted.
 */
describe('OrganizationVendorService.deleteVendor (TypeORM)', () => {
	const run = async (mysql: boolean) => {
		jest.mocked(isMySQL).mockReturnValue(mysql);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		const query: Record<string, jest.Mock> = {};
		for (const method of ['leftJoin', 'where']) {
			query[method] = jest.fn().mockReturnValue(query);
		}
		query.getOne = jest.fn().mockResolvedValue(null);
		const service = new OrganizationVendorService(
			{ metadata: { tableName: 'organization_vendor' }, createQueryBuilder: jest.fn().mockReturnValue(query) } as any,
			{} as any
		);
		const remove = jest.spyOn(service, 'delete').mockResolvedValue({ affected: 1 } as any);

		await service.deleteVendor('vendor-1');

		return { query, remove };
	};

	afterEach(() => jest.restoreAllMocks());

	it('checks the expenses with MySQL quoting on MySQL, then deletes the unused vendor', async () => {
		const { query, remove } = await run(true);

		expect(query.leftJoin.mock.calls[0][2]).toBe('`vendor`.`id` = `expense`.`vendorId`');
		expect(query.where).toHaveBeenCalledWith('`expense`.`vendorId` = :vendorId', { vendorId: 'vendor-1' });
		expect(remove).toHaveBeenCalledWith('vendor-1');
	});

	it('keeps the double quotes elsewhere', async () => {
		const { query } = await run(false);

		expect(query.where).toHaveBeenCalledWith('"expense"."vendorId" = :vendorId', { vendorId: 'vendor-1' });
	});
});

import '../core/entities/internal';

// `@gauzy/config` re-exports its database helpers through `export *` (non-configurable getters under
// CommonJS), so they are replaced through a module factory rather than spied on.
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isMySQL: jest.fn(),
	isPostgres: jest.fn(),
	isSqlite: jest.fn(),
	isBetterSqlite3: jest.fn()
}));

import { isBetterSqlite3, isMySQL, isPostgres, isSqlite } from '@gauzy/config';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { RequestApprovalService } from './request-approval.service';

/**
 * `findAllRequestApprovals` joins the polymorphic `requestId` to time off requests and equipment sharings.
 * On MySQL, the TypeORM join condition for equipment sharing compared `time_off_request.id` (a copy of the
 * line above) instead of `equipment_sharing.id`: it never matched, and since equipment sharing approvals
 * carry no approval policy, they were missing from the approvals list.
 */
describe('RequestApprovalService.findAllRequestApprovals joins (TypeORM, MySQL)', () => {
	const fixture = createTenantFixture();

	let restore: () => void;
	let joins: [string, string, string][];

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		(isMySQL as jest.Mock).mockReturnValue(true);
		(isPostgres as jest.Mock).mockReturnValue(false);
		(isSqlite as jest.Mock).mockReturnValue(false);
		(isBetterSqlite3 as jest.Mock).mockReturnValue(false);
		jest
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.spyOn(RequestApprovalService.prototype as any, 'assertRelationsPermitted')
			.mockImplementation(() => undefined);
		joins = [];
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('joins equipment sharings on their own id', async () => {
		const query: Record<string, jest.Mock> = {};
		for (const method of ['leftJoinAndSelect', 'setFindOptions', 'where', 'orWhere']) {
			query[method] = jest.fn(() => query);
		}
		query.leftJoinAndSelect.mockImplementation((...args: [string, string, string]) => {
			joins.push(args);
			return query;
		});
		query.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
		const service = new RequestApprovalService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'request_approval' }, createQueryBuilder: () => query } as any,
			...(Array.from({ length: 5 }, () => ({})) as [never, never, never, never, never])
		);

		await service.findAllRequestApprovals({}, { organizationId: fixture.organizationId });

		const [, , equipmentJoin] = joins.find(([table]) => table === 'equipment_sharing');
		// `prepareSQLQuery` turns the double quotes into backticks on MySQL
		expect(equipmentJoin).toContain('`equipment_sharing`.`id`');
		expect(equipmentJoin).not.toContain('time_off_request');
		const [, , timeOffJoin] = joins.find(([table]) => table === 'time_off_request');
		expect(timeOffJoin).toContain('`time_off_request`.`id`');
	});
});

// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimerService } from './timer.service';

/**
 * The MikroORM branch of `getTimerWorkedStatus` picks each employee's last log with raw knex
 * (`DISTINCT ON ("employeeId")`), which skips the soft-delete filter. When that last log was deleted, the
 * follow-up `find()` (which does filter deleted rows) returned nothing and the employee vanished from the
 * result, instead of falling back to their previous log as the TypeORM branch does.
 */
describe('TimerService.getTimerWorkedStatus (MikroORM)', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as never });

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		// An employee without CHANGE_SELECTED_EMPLOYEE / ORG_MEMBER_LAST_LOG_VIEW only sees their own status
		jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(false);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('never picks a soft-deleted time log as the last log', async () => {
		const builder: Record<string, jest.Mock> = {};
		for (const method of ['select', 'whereNotNull', 'whereNull', 'whereIn', 'andWhere', 'orderBy']) {
			builder[method] = jest.fn(() => builder);
		}
		builder.toString = jest.fn(() => 'select ...');
		const knex = Object.assign(jest.fn(() => builder), {
			raw: jest.fn((sql: string) => (sql === 'select ...' ? Promise.resolve({ rows: [{ id: 'log-1' }] }) : sql))
		});
		const find = jest.fn().mockResolvedValue([]);

		await TimerService.prototype.getTimerWorkedStatus.call(
			{
				ormType: MultiORMEnum.MikroORM,
				typeOrmTimeLogRepository: {},
				mikroOrmTimeLogRepository: { getKnex: () => knex, find }
			},
			{ organizationId: fixture.organizationId }
		);

		expect(knex).toHaveBeenCalledWith('time_log');
		expect(builder.whereNull).toHaveBeenCalledWith('deletedAt');
		expect(builder.whereIn).toHaveBeenCalledWith('employeeId', ['employee-1']);
		expect(find).toHaveBeenCalledWith({ id: { $in: ['log-1'] } }, expect.anything());
	});
});

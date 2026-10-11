// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { MultiORMEnum } from '../../../../core/utils';
import {
	asTenantUser,
	createCrossTenantFixture
} from '../../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { UpdateEmployeeTotalWorkedHoursHandler } from './update-employee-total-worked-hours.handler';

/**
 * The total is the sum of each time log's own start / stop. It used to join the log's time slots, so every
 * log was counted once per slot (a 1h log with six 10-minute slots made 6h). The MikroORM branch runs raw
 * knex, which skips the soft-delete filter, so it must exclude deleted logs itself.
 */
describe('UpdateEmployeeTotalWorkedHoursHandler', () => {
	const { tenantA } = createCrossTenantFixture();
	const employeeId = 'employee-1';

	let restore: () => void;
	let employeeService: { update: jest.Mock };

	const createHandler = (ormType: MultiORMEnum, repositories: { typeOrm?: object; mikroOrm?: object }) => {
		employeeService = { update: jest.fn() };
		const handler = new UpdateEmployeeTotalWorkedHoursHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			repositories.typeOrm as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			repositories.mikroOrm as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } } as any
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(handler as any).ormType = ormType;
		return handler;
	};

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('TypeORM: sums the time logs without joining their time slots', async () => {
		const query = {
			alias: 'TimeLog',
			innerJoin: jest.fn(),
			leftJoin: jest.fn(),
			select: jest.fn(),
			where: jest.fn(),
			getRawOne: jest.fn().mockResolvedValue({ duration: '3600' })
		};
		query.select.mockReturnValue(query);
		query.where.mockReturnValue(query);
		const handler = createHandler(MultiORMEnum.TypeORM, {
			typeOrm: { createQueryBuilder: () => query }
		});

		await handler.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));

		expect(query.innerJoin).not.toHaveBeenCalled();
		expect(query.leftJoin).not.toHaveBeenCalled();
		expect(query.where).toHaveBeenCalledWith({ employeeId, tenantId: tenantA.tenantId });
		expect(employeeService.update).toHaveBeenCalledWith(employeeId, { totalWorkHours: 1 });
	});

	it('MikroORM: sums only non-deleted time logs, without joining their time slots', async () => {
		const calls: string[] = [];
		const builder: Record<string, unknown> = {};
		for (const method of ['withSchema', 'select', 'where', 'whereNull', 'innerJoin', 'leftJoin']) {
			builder[method] = jest.fn((...args: unknown[]) => {
				calls.push(`${method}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`);
				return builder;
			});
		}
		builder.first = jest.fn().mockResolvedValue({ duration: 7200 });
		const knex = Object.assign(jest.fn(() => builder), {
			raw: (sql: string) => sql,
			userParams: { schema: 'public' }
		});
		const handler = createHandler(MultiORMEnum.MikroORM, { mikroOrm: { getKnex: () => knex } });

		await handler.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));

		expect(calls.some((call) => call.includes('Join'))).toBe(false);
		expect(builder.whereNull).toHaveBeenCalledWith('time_log.deletedAt');
		expect(builder.where).toHaveBeenCalledWith({
			'time_log.employeeId': employeeId,
			'time_log.tenantId': tenantA.tenantId
		});
		expect(employeeService.update).toHaveBeenCalledWith(employeeId, { totalWorkHours: 2 });
	});
});

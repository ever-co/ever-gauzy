// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { MultiORMEnum } from '../../../../core/utils';
import { asTenantUser, createTenantFixture } from '../../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimesheetRecalculateCommand } from '../timesheet-recalculate.command';
import { TimesheetRecalculateHandler } from './timesheet-recalculate.handler';

/**
 * Deleting a time log soft-deletes its time slots, then recalculates the timesheet. The MikroORM branch sums
 * the slots with raw knex, which skips the soft-delete filter, so it kept counting the deleted slots.
 */
describe('TimesheetRecalculateHandler (MikroORM)', () => {
	const fixture = createTenantFixture();
	const timesheet = {
		id: 'timesheet-1',
		employeeId: 'employee-1',
		organizationId: fixture.organizationId,
		startedAt: '2026-09-28T00:00:00.000Z',
		stoppedAt: '2026-10-04T23:59:59.999Z'
	};

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('sums only the time slots that are not soft-deleted', async () => {
		const builder: Record<string, jest.Mock> = {};
		for (const method of ['withSchema', 'select', 'where', 'andWhere', 'whereNull']) {
			builder[method] = jest.fn(() => builder);
		}
		builder.first = jest.fn().mockResolvedValue({ duration: 3600, keyboard: 10, mouse: 20, overall: 30 });
		const knex = Object.assign(jest.fn(() => builder), {
			raw: (sql: string) => sql,
			userParams: { schema: 'public' }
		});
		const timesheetService = {
			findOneByIdString: jest.fn().mockResolvedValue(timesheet),
			update: jest.fn()
		};
		const handler = new TimesheetRecalculateHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			timesheetService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ getKnex: () => knex } as any
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(handler as any).ormType = MultiORMEnum.MikroORM;

		await handler.execute(new TimesheetRecalculateCommand(timesheet.id));

		expect(knex).toHaveBeenCalledWith('time_slot');
		expect(builder.whereNull).toHaveBeenCalledWith('deletedAt');
		expect(builder.where).toHaveBeenCalledWith({
			employeeId: timesheet.employeeId,
			organizationId: timesheet.organizationId,
			tenantId: fixture.tenantId
		});
		expect(timesheetService.update).toHaveBeenCalledWith(timesheet.id, {
			duration: 3600,
			keyboard: 10,
			mouse: 20,
			overall: 30
		});
	});
});

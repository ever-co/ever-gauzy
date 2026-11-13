// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { RequestContext } from '../../../../core/context';
import { FindTimeLogRatesCommand } from '../find-time-log-rates.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogUpdateHandler } from './time-log-update.handler';

jest.mock('../../time-log-references', () => ({ assertTimeLogReferencesOfTenant: jest.fn(async () => undefined) }));

const TENANT = 'tenant-a';

const CLIENT_RATES = { projectBillRateValue: 120, projectMemberBillRateValue: null, projectBillRateCurrency: 'EUR' };
const ALL_RATES = {
	billRateValue: 60,
	billRateCurrency: 'EUR',
	payRateValue: 35,
	payRateCurrency: 'EUR',
	...CLIENT_RATES,
	ratesStored: true
};

function createHandler() {
	const row = {
		id: 'log-1',
		tenantId: TENANT,
		organizationId: 'org-a',
		employeeId: 'marie',
		projectId: 'site',
		timesheetId: 'timesheet-1',
		startedAt: new Date('2026-10-05T09:00:00.000Z'),
		stoppedAt: new Date('2026-10-05T11:00:00.000Z')
	};
	const commands: unknown[] = [];
	const timeLogRepository = {
		findOneBy: jest.fn(async () => ({ ...row })),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown) => {
			commands.push(command);
			if (command instanceof FindTimeLogRatesCommand) {
				if (command.part === 'client') {
					return CLIENT_RATES;
				}
				return ALL_RATES;
			}
			return { id: 'timesheet-2' };
		})
	};
	const handler = new TimeLogUpdateHandler(
		commandBus as any,
		timeLogRepository as any,
		{} as any,
		{} as any,
		{ generateTimeSlots: jest.fn(() => []) } as any
	);
	return { handler, timeLogRepository, commands };
}

const ratesReads = (commands: unknown[]) =>
	commands.filter((command): command is FindTimeLogRatesCommand => command instanceof FindTimeLogRatesCommand);

/**
 * A log keeps the rates it was recorded with through every edit, except the ones that make it someone else's time or
 * another project's: it then takes that member's or that project's rates of the moment.
 */
describe("TimeLogUpdateHandler: a log moved to another project or member takes that one's rates", () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it("gives a log put on another project that project's client rates, in the same update", async () => {
		const { handler, timeLogRepository, commands } = createHandler();

		await handler.execute(new TimeLogUpdateCommand({ projectId: 'internal' } as any, 'log-1'));

		const [read] = ratesReads(commands);
		expect(read.scope).toEqual({ tenantId: TENANT, employeeId: 'marie', projectId: 'internal' });
		expect(read.part).toBe('client');
		expect(timeLogRepository.update).toHaveBeenCalledWith(
			{ id: 'log-1', tenantId: TENANT },
			{ projectId: 'internal', ...CLIENT_RATES }
		);
	});

	it('clears the client rates of a log taken off its project', async () => {
		const { handler, commands } = createHandler();

		await handler.execute(new TimeLogUpdateCommand({ projectId: null } as any, 'log-1'));

		expect(ratesReads(commands)[0].scope.projectId).toBeNull();
	});

	it('keeps the stored rates through an edit that leaves the member and the project', async () => {
		const { handler, timeLogRepository, commands } = createHandler();

		await handler.execute(new TimeLogUpdateCommand({ description: 'edited', projectId: 'site' } as any, 'log-1'));

		expect(ratesReads(commands)).toHaveLength(0);
		expect(timeLogRepository.update).toHaveBeenCalledWith(
			{ id: 'log-1', tenantId: TENANT },
			{ description: 'edited', projectId: 'site' }
		);
	});

	it("gives a log moved to another member all of that member's rates, with the move", async () => {
		const { handler, commands } = createHandler();
		jest.spyOn(handler as any, 'planRelease').mockResolvedValue({ remove: [], unlink: [] });
		jest.spyOn(handler as any, 'bulkCreateTimeSlots').mockResolvedValue([]);
		jest.spyOn(handler as any, 'applyRelease').mockResolvedValue(undefined);
		jest.spyOn(handler as any, 'recalculateTimesheetAndEmployeeHours').mockResolvedValue(undefined);
		const saved = jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockResolvedValue(undefined);

		await handler.execute(new TimeLogUpdateCommand({ employeeId: 'paul' } as any, 'log-1'));

		const [read] = ratesReads(commands);
		expect(read.scope).toEqual({ tenantId: TENANT, employeeId: 'paul', projectId: 'site' });
		expect(read.part).toBe('all');
		expect(saved.mock.calls[0][0]).toMatchObject({ employeeId: 'paul', ...ALL_RATES });
	});
});

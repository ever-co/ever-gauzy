// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimeLogSourceEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { FindTimeLogRatesCommand } from '../find-time-log-rates.command';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { TimeLogCreateHandler } from './time-log-create.handler';

jest.mock('../../time-log-references', () => ({ assertTimeLogReferencesOfTenant: jest.fn(async () => undefined) }));

const TENANT_ID = 'tenant-1';

/** The rates of the moment, as `FindTimeLogRatesHandler` reads them. */
const RATES_OF_THE_MOMENT = {
	billRateValue: 40,
	billRateCurrency: 'EUR',
	payRateValue: 25,
	payRateCurrency: 'EUR',
	projectBillRateValue: 90,
	projectMemberBillRateValue: null,
	projectBillRateCurrency: 'EUR',
	ratesStored: true
};

function createHandler() {
	const saved: TimeLog[] = [];
	const commands: unknown[] = [];
	const typeOrmTimeLogRepository = {
		save: jest.fn(async (timeLog: TimeLog) => {
			timeLog.id = `log-${saved.length + 1}`;
			saved.push(timeLog);
			return timeLog;
		})
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown) => {
			commands.push(command);
			if (command instanceof TimesheetFirstOrCreateCommand) {
				return { id: 'timesheet-1' };
			}
			if (command instanceof FindTimeLogRatesCommand) {
				return RATES_OF_THE_MOMENT;
			}
			return undefined;
		})
	};
	const timeSlotService = {
		generateTimeSlots: jest.fn((start: Date, end: Date) => generateTimeSlots(start, end)),
		bulkCreate: jest.fn(async (slots: unknown[]) => slots)
	};
	const timeLogService = {
		findOneByIdString: jest.fn(async (id: string) => saved.find((timeLog) => timeLog.id === id) ?? null)
	};
	const handler = new TimeLogCreateHandler(
		typeOrmTimeLogRepository as any,
		{} as any,
		commandBus as any,
		timeSlotService as any,
		timeLogService as any
	);
	return { handler, saved, commands };
}

/**
 * Every time log the API records (a timer start, manual time, an integration's sync, a CSV import through the manual
 * time route) goes through `TimeLogCreateHandler`, which stores the rates of the moment on it in its one save.
 */
describe('TimeLogCreateHandler: a new time log stores the rates of the moment', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});
	afterEach(() => jest.restoreAllMocks());

	it("reads the member's and the project's rates of the moment and saves them with the log", async () => {
		const { handler, saved, commands } = createHandler();

		await handler.execute(
			new TimeLogCreateCommand({
				employeeId: 'employee-1',
				organizationId: 'organization-1',
				projectId: 'project-1',
				startedAt: new Date('2026-10-24T09:00:00.000Z'),
				isRunning: true,
				source: TimeLogSourceEnum.WEB_TIMER
			})
		);

		const read = commands.find((command) => command instanceof FindTimeLogRatesCommand) as FindTimeLogRatesCommand;
		expect(read.scope).toEqual({
			tenantId: TENANT_ID,
			organizationId: 'organization-1',
			employeeId: 'employee-1',
			projectId: 'project-1'
		});
		expect(read.part).toBe('all');
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject(RATES_OF_THE_MOMENT);
	});

	it('names no project for a log without one', async () => {
		const { handler, commands } = createHandler();

		await handler.execute(
			new TimeLogCreateCommand({
				employeeId: 'employee-1',
				organizationId: 'organization-1',
				startedAt: new Date('2026-10-24T09:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T09:30:00.000Z')
			})
		);

		const read = commands.find((command) => command instanceof FindTimeLogRatesCommand) as FindTimeLogRatesCommand;
		expect(read.scope.projectId).toBeNull();
	});

	it('never takes a rate from its input: a client names no price for its own time', async () => {
		const { handler, saved } = createHandler();

		await handler.execute(
			new TimeLogCreateCommand({
				employeeId: 'employee-1',
				organizationId: 'organization-1',
				startedAt: new Date('2026-10-24T09:00:00.000Z'),
				stoppedAt: new Date('2026-10-24T09:30:00.000Z'),
				billRateValue: 1000,
				payRateValue: 1000
			})
		);

		expect(saved[0]).toMatchObject({ billRateValue: 40, payRateValue: 25 });
	});
});

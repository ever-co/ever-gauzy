// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ITimeLog, TimeLogSourceEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { IntegrationMapSyncTimeLogCommand } from '../../../../integration-map/commands/integration-map.sync-time-log.command';
import { IntegrationMapSyncTimeLogHandler } from '../../../../integration-map/commands/handlers/integration-map.sync-time-log.handler';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { isRunningTimeLogInput, TimeLogCreateHandler, withRunningLogStoppedAt } from './time-log-create.handler';

// The tenant check on project / task / client / team has its own spec (time-log-references.spec.ts).
jest.mock('../../time-log-references', () => ({ assertTimeLogReferencesOfTenant: jest.fn(async () => undefined) }));

/**
 * A running time log could be stored with a null `stoppedAt`: `TimeLogCreateHandler` gives a desktop-source log
 * `isRunning: true` when the input does not say, and wrote `stoppedAt` only when the input named one, and
 * `IntegrationMapSyncTimeLogHandler` passes its entity straight in. The timer status and stop / toggle reads look
 * for a running log with `stoppedAt IS NOT NULL`, so such a row ran unseen. The handler now writes a running log
 * with `stoppedAt = startedAt`, the shape `TimerService.startTimer` gives it; the reads are covered in
 * timer.service.running-log.spec.ts.
 */

const TENANT_ID = 'tenant-1';
const ORGANIZATION_ID = 'organization-1';
const EMPLOYEE_ID = 'employee-1';
const STARTED_AT = new Date('2026-10-24T09:00:00.000Z');
const STOPPED_AT = new Date('2026-10-24T09:30:00.000Z');

function createHandler() {
	const saved: TimeLog[] = [];
	const typeOrmTimeLogRepository = {
		save: jest.fn(async (timeLog: TimeLog) => {
			timeLog.id = timeLog.id ?? `log-${saved.length + 1}`;
			saved.push(timeLog);
			return timeLog;
		})
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown) =>
			command instanceof TimesheetFirstOrCreateCommand ? { id: 'timesheet-1' } : undefined
		)
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
	return { handler, saved, timeSlotService };
}

const input = (overrides: Partial<TimeLog>): Partial<TimeLog> => ({
	employeeId: EMPLOYEE_ID,
	organizationId: ORGANIZATION_ID,
	tenantId: TENANT_ID,
	startedAt: STARTED_AT,
	...overrides
});

describe('TimeLogCreateHandler: a running log is written with stoppedAt = startedAt', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});
	afterEach(() => jest.restoreAllMocks());

	describe('isRunningTimeLogInput', () => {
		it('follows the input when it says', () => {
			expect(isRunningTimeLogInput({ isRunning: true })).toBe(true);
			expect(isRunningTimeLogInput({ isRunning: false, source: TimeLogSourceEnum.DESKTOP })).toBe(false);
		});

		it('defaults to running for a desktop log only, as the entity default does', () => {
			expect(isRunningTimeLogInput({ source: TimeLogSourceEnum.DESKTOP })).toBe(true);
			expect(isRunningTimeLogInput({ source: TimeLogSourceEnum.WEB_TIMER })).toBe(false);
			expect(isRunningTimeLogInput({ source: TimeLogSourceEnum.HUBSTAFF })).toBe(false);
			expect(isRunningTimeLogInput({})).toBe(false);
		});
	});

	describe('withRunningLogStoppedAt', () => {
		it('stamps stoppedAt = startedAt on a running log that names no end', () => {
			expect(withRunningLogStoppedAt(input({ isRunning: true }))).toMatchObject({
				isRunning: true,
				startedAt: STARTED_AT,
				stoppedAt: STARTED_AT
			});
			const desktopWithNullEnd = input({ source: TimeLogSourceEnum.DESKTOP, stoppedAt: null });
			expect(withRunningLogStoppedAt(desktopWithNullEnd)).toMatchObject({ stoppedAt: STARTED_AT });
		});

		it('keeps a stoppedAt the input names', () => {
			expect(withRunningLogStoppedAt(input({ isRunning: true, stoppedAt: STOPPED_AT })).stoppedAt).toBe(
				STOPPED_AT
			);
		});

		it('leaves a log that is not running as it is', () => {
			const notRunning = input({ source: TimeLogSourceEnum.WEB_TIMER });
			expect(withRunningLogStoppedAt(notRunning)).toBe(notRunning);
			expect(withRunningLogStoppedAt(notRunning).stoppedAt).toBeUndefined();
		});

		it('does not change the caller object', () => {
			const running = input({ isRunning: true });
			withRunningLogStoppedAt(running);
			expect(running.stoppedAt).toBeUndefined();
		});
	});

	describe('execute', () => {
		it('CONTROL: the timer start path already sends stoppedAt = startedAt, and gets no blank slots for it', () => {
			expect(generateTimeSlots(STARTED_AT, STARTED_AT)).toEqual([]);
		});

		it('writes a running log with no stoppedAt as the timer start path does', async () => {
			const { handler, saved } = createHandler();

			await handler.execute(new TimeLogCreateCommand(input({ isRunning: true })));

			expect(saved).toHaveLength(1);
			expect(saved[0]).toMatchObject({ isRunning: true, startedAt: STARTED_AT, stoppedAt: STARTED_AT });
			expect(saved[0].timeSlots).toEqual([]);
		});

		it('writes a desktop log that names no end (running by default) with stoppedAt = startedAt', async () => {
			const { handler, saved } = createHandler();

			await handler.execute(new TimeLogCreateCommand(input({ source: TimeLogSourceEnum.DESKTOP })));

			expect(saved[0]).toMatchObject({ isRunning: true, stoppedAt: STARTED_AT });
		});

		it('keeps a completed log as before: its stoppedAt, and the blank slots between', async () => {
			const { handler, saved, timeSlotService } = createHandler();

			await handler.execute(
				new TimeLogCreateCommand(input({ source: TimeLogSourceEnum.WEB_TIMER, stoppedAt: STOPPED_AT }))
			);

			expect(saved[0]).toMatchObject({ isRunning: false, stoppedAt: STOPPED_AT });
			expect(timeSlotService.generateTimeSlots).toHaveBeenCalledWith(STARTED_AT, STOPPED_AT);
			expect(saved[0].timeSlots).toHaveLength(3);
		});
	});

	describe('IntegrationMapSyncTimeLogHandler, which passes its entity straight to the create', () => {
		it('stores a running synced log with stoppedAt = startedAt', async () => {
			const { handler: createHandlerInstance, saved } = createHandler();
			const commandBus = {
				execute: jest.fn(async (command: unknown) =>
					command instanceof TimeLogCreateCommand
						? createHandlerInstance.execute(command)
						: { id: 'integration-map-1' }
				)
			};
			const integrationMapService = {
				// Not mapped yet: the handler creates the log
				findOneByWhereOptions: jest.fn(async () => {
					throw new Error('not found');
				})
			};
			const syncHandler = new IntegrationMapSyncTimeLogHandler(commandBus as any, integrationMapService as any);

			await syncHandler.execute(
				new IntegrationMapSyncTimeLogCommand({
					sourceId: 'source-1',
					integrationId: 'integration-1',
					organizationId: ORGANIZATION_ID,
					entity: input({ isRunning: true, source: TimeLogSourceEnum.HUBSTAFF }) as Partial<ITimeLog>
				})
			);

			expect(saved).toHaveLength(1);
			expect(saved[0]).toMatchObject({ isRunning: true, stoppedAt: STARTED_AT });
		});
	});
});

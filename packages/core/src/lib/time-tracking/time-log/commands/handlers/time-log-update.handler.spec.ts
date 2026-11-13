// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { TimesheetFirstOrCreateCommand } from '../../../timesheet/commands';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { omitScopeFields, TimeLogUpdateHandler } from './time-log-update.handler';

/**
 * GHSA-6qvm-3wg4-26w4 — PUT /timesheet/time-log/:id.
 *
 * The handler spread its input straight into `update(timeLog.id, { ...input })`, and TenantBaseGuard
 * skips the body tenant check when a Tenant-Id header is present, so an employee could re-point their
 * own log at another tenant. Tenant and organization now come from the stored row.
 */

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

const LOGS = [
	{ id: 'log-own', tenantId: TENANT_A, organizationId: 'org-a', employeeId: 'employee-a' },
	{ id: 'log-foreign', tenantId: TENANT_B, organizationId: 'org-b', employeeId: 'employee-b' }
];

function createHandler() {
	const timeLogRepository = {
		findOneBy: jest.fn(
			async (where: any) =>
				LOGS.find((log) => Object.entries(where).every(([key, value]) => (log as any)[key] === value)) ?? null
		),
		update: jest.fn(async () => ({ affected: 1 }))
	};
	const timeSlotService = { generateTimeSlots: jest.fn(() => []) };
	const handler = new TimeLogUpdateHandler(
		{ execute: jest.fn() } as any,
		timeLogRepository as any,
		{} as any,
		{} as any,
		timeSlotService as any
	);
	return { handler, timeLogRepository };
}

describe('TimeLogUpdateHandler (GHSA-6qvm-3wg4-26w4)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
	});
	afterEach(() => jest.restoreAllMocks());

	const body = { description: 'edited', isBillable: true, tenantId: TENANT_B, organizationId: 'org-b' } as any;

	it('CONTROL: the pre-fix payload carries the body tenant and organization into the update', () => {
		expect({ ...body }).toMatchObject({ tenantId: TENANT_B, organizationId: 'org-b' });
	});

	it('updates within the stored tenant, without the body tenant / organization', async () => {
		const { handler, timeLogRepository } = createHandler();

		await handler.execute(new TimeLogUpdateCommand(body, 'log-own'));

		expect(timeLogRepository.update).toHaveBeenCalledWith(
			{ id: 'log-own', tenantId: TENANT_A },
			{ description: 'edited', isBillable: true }
		);
	});

	it('resolves an id inside the caller tenant only', async () => {
		const { handler, timeLogRepository } = createHandler();

		await expect(handler.execute(new TimeLogUpdateCommand(body, 'log-foreign'))).rejects.toThrow(NotFoundException);
		expect(timeLogRepository.findOneBy).toHaveBeenCalledWith({ id: 'log-foreign', tenantId: TENANT_A });
		expect(timeLogRepository.update).not.toHaveBeenCalled();
	});

	// A changed `employeeId` is a move (re-homed by the handler, see time-log.service.spec.ts); this pins the organization.
	it("runs its own slot cleanup in the stored log's organization, whatever organization the input names", async () => {
		const { handler } = createHandler();
		const timeSlotService = (handler as any).timeSlotService;
		const kept = new Date('2026-01-05T09:00:00.000Z');
		const dropped = new Date('2026-01-05T08:00:00.000Z');
		// The edited range keeps 09:00 and drops 08:00, so the 08:00 slot is the one the cleanup removes.
		timeSlotService.generateTimeSlots
			.mockReturnValueOnce([{ startedAt: kept }])
			.mockReturnValueOnce([{ startedAt: dropped }, { startedAt: kept }]);
		(handler as any).commandBus.execute.mockResolvedValue({ id: 'timesheet-1' });
		const removed = jest.spyOn(handler as any, 'planRelease').mockResolvedValue({ remove: [], unlink: [] });
		jest.spyOn(handler as any, 'applyRelease').mockResolvedValue(undefined);
		jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockResolvedValue(undefined);
		jest.spyOn(handler as any, 'recalculateTimesheetAndEmployeeHours').mockResolvedValue(undefined);

		await handler.execute(
			new TimeLogUpdateCommand(
				{
					startedAt: kept,
					stoppedAt: new Date('2026-01-05T10:00:00.000Z'),
					organizationId: 'org-b'
				} as any,
				'log-own'
			)
		);

		expect(removed).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'log-own' }),
			TENANT_A,
			'org-a',
			'employee-a',
			[dropped]
		);
	});

	it('releases only the slots of the part a new start between seconds drops', () => {
		const { handler } = createHandler();
		const at = (time: string) => new Date(`2026-01-05T${time}Z`);
		// The slots the log had, as stored (a slot's start never has milliseconds)...
		const previous = ['09:40', '09:50', '10:00'].map((time) => ({ startedAt: at(`${time}:00.000`) }));
		// ...and those of its range from a new start at 09:55:00.500, as generateTimeSlots computes them.
		const kept = generateTimeSlots(at('09:55:00.500'), at('10:10:00.000'));

		expect((handler as any).getConflictingStartTimes(previous, kept)).toEqual([at('09:40:00.000')]);
	});

	it('keeps the fields internal callers rely on (the timer stop sends isRunning / stoppedAt)', () => {
		expect(omitScopeFields({ isRunning: false, stoppedAt: 'x', id: 'y', tenant: {}, organization: {}, employee: {} })).toEqual({
			isRunning: false,
			stoppedAt: 'x'
		});
	});
});

/**
 * The timer stops a replaced run through this update (`TimerService.stopPreviousRunningTimers`) and relies on what it
 * does: the start the update names picks the log's timesheet (naming none picks the week of now); the stop is written
 * before the later steps (time slots, timesheet, worked hours), so a failure in them leaves the log stopped; and the
 * same update sent again completes those steps from what was written, which is how the timer recovers such a failure.
 */
describe('TimeLogUpdateHandler stopping a run', () => {
	const startedAt = new Date('2026-10-17T09:00:00.000Z');
	const stoppedAt = new Date('2026-10-24T02:00:00.000Z');
	const stop = () => new TimeLogUpdateCommand({ isRunning: false, startedAt, stoppedAt }, 'log-own');

	let handler: TimeLogUpdateHandler;
	let timeLogRepository: { findOneBy: jest.Mock; update: jest.Mock };
	let execute: jest.Mock;

	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		({ handler, timeLogRepository } = createHandler());
		execute = (handler as any).commandBus.execute;
		execute.mockResolvedValue({ id: 'timesheet-of-its-week' });
		jest.spyOn(handler as any, 'planRelease').mockResolvedValue({ remove: [], unlink: [] });
		jest.spyOn(handler as any, 'applyRelease').mockResolvedValue(undefined);
		jest.spyOn(handler as any, 'recalculateTimesheetAndEmployeeHours').mockResolvedValue(undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it('files the log under the timesheet of the start the update names', async () => {
		jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockResolvedValue(undefined);

		await handler.execute(stop());

		const commands = execute.mock.calls.map(([command]) => command);
		const lookup = commands.find((command) => command instanceof TimesheetFirstOrCreateCommand);
		expect(lookup.date).toEqual(startedAt);
		expect(timeLogRepository.update).toHaveBeenCalledWith(
			{ id: 'log-own', tenantId: TENANT_A },
			expect.objectContaining({ timesheetId: 'timesheet-of-its-week' })
		);
	});

	it('writes the stop before its later steps, so a failure in them leaves the log stopped', async () => {
		jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockRejectedValue(
			new Error('the time slots could not be saved')
		);

		await expect(handler.execute(stop())).rejects.toThrow('the time slots could not be saved');

		expect(timeLogRepository.update).toHaveBeenCalledWith(
			{ id: 'log-own', tenantId: TENANT_A },
			expect.objectContaining({ isRunning: false, stoppedAt })
		);
	});

	it('completes on a second run, from what the first one wrote, the steps a failure after the stop left undone', async () => {
		// A web timer run as stored, which the update writes and reads back
		const runStart = new Date('2026-10-24T00:00:00.000Z');
		const runEnd = new Date('2026-10-24T02:00:00.000Z');
		const stored = {
			id: 'log-own',
			tenantId: TENANT_A,
			organizationId: 'org-a',
			employeeId: 'employee-a',
			source: TimeLogSourceEnum.WEB_TIMER,
			isRunning: true,
			startedAt: runStart,
			stoppedAt: runStart
		};
		timeLogRepository.findOneBy.mockImplementation(async () => stored);
		timeLogRepository.update.mockImplementation(async (_where: unknown, changes: object) =>
			Object.assign(stored, changes)
		);
		(handler as any).timeSlotService.generateTimeSlots.mockImplementation(generateTimeSlots);
		const createSlots = jest.spyOn(handler as any, 'bulkCreateTimeSlots').mockResolvedValue([]);
		const save = jest
			.spyOn(handler as any, 'saveUpdatedTimeLog')
			.mockRejectedValueOnce(new Error('the time slots could not be saved'))
			.mockResolvedValue(undefined);
		const recalculate = (handler as any).recalculateTimesheetAndEmployeeHours as jest.Mock;
		const stopRun = () =>
			new TimeLogUpdateCommand({ isRunning: false, startedAt: runStart, stoppedAt: runEnd }, 'log-own');

		await expect(handler.execute(stopRun())).rejects.toThrow('the time slots could not be saved');
		expect(stored).toMatchObject({ isRunning: false, stoppedAt: runEnd, timesheetId: 'timesheet-of-its-week' });
		expect(recalculate).not.toHaveBeenCalled();

		await handler.execute(stopRun());

		// Its twelve ten-minute slots are created (only where missing) and linked, and its totals recalculated
		expect(createSlots).toHaveBeenCalledTimes(2);
		expect(createSlots.mock.calls[1][0]).toHaveLength(12);
		expect(save).toHaveBeenCalledTimes(2);
		expect(recalculate).toHaveBeenCalledWith('timesheet-of-its-week', 'employee-a');
		expect(stored).toMatchObject({ isRunning: false, startedAt: runStart, stoppedAt: runEnd });
	});

	it('releases on a second run, given the log as it was, the slots past an end the first run moved back', async () => {
		// An Ever Teams run with heartbeats until 01:58, cut back to 01:45: its slot at 01:50, which only it holds, goes
		const runStart = new Date('2026-10-24T00:00:00.000Z');
		const oldEnd = new Date('2026-10-24T01:58:00.000Z');
		const newEnd = new Date('2026-10-24T01:45:00.000Z');
		const stored = {
			id: 'log-own',
			tenantId: TENANT_A,
			organizationId: 'org-a',
			employeeId: 'employee-a',
			source: TimeLogSourceEnum.TEAMS,
			isRunning: true,
			startedAt: runStart,
			stoppedAt: oldEnd
		};
		const logAsItWas = new TimeLog({ ...stored });
		timeLogRepository.findOneBy.mockImplementation(async () => stored);
		timeLogRepository.update.mockImplementation(async (_where: unknown, changes: object) =>
			Object.assign(stored, changes)
		);
		(handler as any).timeSlotService.generateTimeSlots.mockImplementation(generateTimeSlots);
		const pastEnd = { id: 'slot-past-end', startedAt: new Date('2026-10-24T01:50:00.000Z'), timeLogs: [stored] };
		// Its heartbeats posted its slots, so the stop keeps those and takes none of its range (#11843)
		jest.spyOn(handler as any, 'hasTimeSlots').mockResolvedValue(true);
		jest.spyOn(handler as any, 'findTimeSlots').mockImplementation(async (...args: unknown[]) => {
			const startTimes = args[3] as Date[];
			return startTimes.some((time) => time.getTime() === pastEnd.startedAt.getTime()) ? [pastEnd] : [];
		});
		// The release is planned for real, over the slot above; the failure comes after the write, before the release
		(handler as any).planRelease.mockRestore();
		const release = (handler as any).applyRelease as jest.Mock;
		jest.spyOn(handler as any, 'saveUpdatedTimeLog')
			.mockRejectedValueOnce(new Error('the time slots could not be saved'))
			.mockResolvedValue(undefined);
		const cut = { isRunning: false, startedAt: runStart, stoppedAt: newEnd };

		await expect(handler.execute(new TimeLogUpdateCommand(cut, 'log-own'))).rejects.toThrow(
			'the time slots could not be saved'
		);
		expect(stored).toMatchObject({ isRunning: false, stoppedAt: newEnd });
		expect(release).not.toHaveBeenCalled();

		await handler.execute(new TimeLogUpdateCommand(cut, logAsItWas));

		expect(release).toHaveBeenCalledTimes(1);
		expect(release).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'log-own' }),
			TENANT_A,
			'org-a',
			'employee-a',
			{ remove: ['slot-past-end'], unlink: [] },
			false
		);
	});
});

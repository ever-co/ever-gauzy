// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { mockRequestContext } from '../testing/recording-query-builder';
import {
	at,
	SPAN_EMPLOYEE_ID,
	SPAN_ORGANIZATION_ID,
	SPAN_TENANT_ID,
	SPAN_TIMESHEET_ID,
	TimeSpanStore
} from '../testing/time-span-store';
import { TimeLogCreateCommand, TimeLogUpdateCommand } from './commands';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

/**
 * Manual time saved over another entry of the same member, through the real overlap handling (DeleteTimeSpanHandler
 * and the handlers it runs) over a scripted store of logs and time slots.
 *
 * The overlap was resolved once per time slot of the other entry, and each pass deleted the slot it was given:
 * the entry lost every slot, and with the last one the entry itself, whatever the time the two shared. The entry now
 * loses the shared time only, with the slots that time alone reached.
 */

const USER_ID = '2e4f6a8c-0b1d-4e3f-9a5b-7c9d1e3f5a71';

/** A manual entry, as the web and the Angular UI save one. */
const MANUAL_ENTRY = { logType: TimeLogType.MANUAL, source: TimeLogSourceEnum.WEB_TIMER };

/** A moment of the week after the store's day, for the cases that need the current week to be a later one. */
const NEXT_WEEK = new Date('2026-11-12T12:00:00.000Z');

/** Every ten-minute start from `from` up to `to`, `to` excluded (`HH:mm`). */
function slotStarts(from: string, to: string): string[] {
	const starts: string[] = [];
	for (let time = at(from).getTime(); time < at(to).getTime(); time += 10 * 60 * 1000) {
		starts.push(new Date(time).toISOString().slice(11, 16));
	}
	return starts;
}

describe('TimeLogService: manual time over another entry of the same member', () => {
	let store: TimeSpanStore;
	let service: TimeLogService;

	beforeEach(async () => {
		store = new TimeSpanStore();
		const employee = {
			id: SPAN_EMPLOYEE_ID,
			organizationId: SPAN_ORGANIZATION_ID,
			organization: { id: SPAN_ORGANIZATION_ID, futureDateAllowed: true, allowManualTime: true }
		};

		const module: TestingModule = await Test.createTestingModule({ providers: [TimeLogService] })
			.useMocker((token) => {
				if (token === TypeOrmEmployeeRepository) {
					return { findOne: jest.fn().mockResolvedValue(employee) };
				}
				if (token === CommandBus) {
					return { execute: store.execute };
				}
				if (token === ManagedEmployeeService) {
					return { canManageEmployee: jest.fn().mockResolvedValue(true) };
				}
				if (token === TypeOrmTimeLogRepository) {
					// No timer of the member runs in these cases (the running-timer read of manual time finds none)
					return { metadata: { tableName: 'time_log' }, find: jest.fn().mockResolvedValue([]) };
				}
				return {};
			})
			.compile();

		service = module.get<TimeLogService>(TimeLogService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		mockRequestContext({
			tenantId: SPAN_TENANT_ID,
			user: { id: USER_ID, employeeId: SPAN_EMPLOYEE_ID },
			canChangeSelectedEmployee: true
		});
		jest.spyOn(service, 'findOneByIdString').mockImplementation(async (id) => store.read(id));
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	const entry = (from: Date, to: Date) =>
		({
			employeeId: SPAN_EMPLOYEE_ID,
			organizationId: SPAN_ORGANIZATION_ID,
			startedAt: from,
			stoppedAt: to
		}) as IManualTimeInput;

	const addManualTime = (from: string, to: string) => service.addManualTime(entry(at(from), at(to)));

	it.each([
		['whole minutes', at('12:53'), at('14:47')],
		['seconds and milliseconds', new Date('2026-11-02T12:53:27.123Z'), new Date('2026-11-02T14:47:05.456Z')]
	])(
		'a tracked entry overlapped at its start keeps its time after the new one (started at %s)',
		async (_precision, startedAt, stoppedAt) => {
			store.addTimeLog('tracked', '12:53', '14:47', { startedAt, stoppedAt });

			await addManualTime('12:30', '13:30');

			expect(store.shapes()).toEqual([
				['12:30', '13:30', slotStarts('12:30', '13:30')],
				['13:30', '14:47', slotStarts('13:30', '14:50')]
			]);
		}
	);

	it('an entry overlapped at its end keeps its time before the new one', async () => {
		store.addTimeLog('manual', '10:00', '12:00', MANUAL_ENTRY);

		await addManualTime('11:30', '12:30');

		expect(store.shapes()).toEqual([
			['10:00', '11:30', slotStarts('10:00', '11:30')],
			['11:30', '12:30', slotStarts('11:30', '12:30')]
		]);
	});

	it('an entry of an earlier week overlapped at its end stays under the timesheet of its own week', async () => {
		jest.spyOn(Date, 'now').mockReturnValue(NEXT_WEEK.getTime());
		store.addTimeLog('manual', '10:00', '12:00', MANUAL_ENTRY);

		await addManualTime('11:30', '12:30');

		expect(store.read('manual').timesheetId).toBe(SPAN_TIMESHEET_ID);
	});

	it('an entry with the new one in its middle keeps its time before it and after it, each with its slots', async () => {
		store.addTimeLog('manual', '10:00', '13:00', MANUAL_ENTRY);

		await addManualTime('11:00', '12:00');

		expect(store.shapes()).toEqual([
			['10:00', '11:00', slotStarts('10:00', '11:00')],
			['11:00', '12:00', slotStarts('11:00', '12:00')],
			['12:00', '13:00', slotStarts('12:00', '13:00')]
		]);
	});

	/**
	 * A split saves the copy of the entry's time after the new one, then shortens the entry. A failed shortening was
	 * logged and the manual entry saved anyway, over an entry still holding that time. The split is now undone, and
	 * the manual time refused.
	 */
	it('manual time is refused, and the entry left whole, when the entry it splits cannot be shortened', async () => {
		store.addTimeLog('manual', '10:00', '13:00', MANUAL_ENTRY);
		store.failOn(TimeLogUpdateCommand);

		await expect(addManualTime('11:00', '12:00')).rejects.toThrow('The database connection was lost');

		expect(store.shapes()).toEqual([['10:00', '13:00', slotStarts('10:00', '13:00')]]);
	});

	it('an entry starting inside the new one keeps its time after it', async () => {
		store.addTimeLog('manual', '10:00', '12:00', MANUAL_ENTRY);

		await addManualTime('09:30', '10:30');

		expect(store.shapes()).toEqual([
			['09:30', '10:30', slotStarts('09:30', '10:30')],
			['10:30', '12:00', slotStarts('10:30', '12:00')]
		]);
	});

	it('a new entry inside one ten-minute slot of an entry leaves that slot to both parts of it', async () => {
		store.addTimeLog('manual', '10:00', '11:00', MANUAL_ENTRY);

		await addManualTime('10:22', '10:27');

		expect(store.shapes()).toEqual([
			['10:00', '10:22', ['10:00', '10:10', '10:20']],
			['10:22', '10:27', ['10:20']],
			['10:27', '11:00', ['10:20', '10:30', '10:40', '10:50']]
		]);
	});

	it('an entry the new one covers is deleted, and the next one keeps its time after it', async () => {
		store.addTimeLog('covered', '10:00', '10:30', MANUAL_ENTRY);
		store.addTimeLog('next', '10:30', '12:00', MANUAL_ENTRY);

		await addManualTime('09:30', '11:00');

		expect(store.shapes()).toEqual([
			['09:30', '11:00', slotStarts('09:30', '11:00')],
			['11:00', '12:00', slotStarts('11:00', '12:00')]
		]);
	});

	it('an entry the new one does not reach keeps its time and the slot it shares with the entry it does', async () => {
		// 10:00 to 10:05 and 10:05 to 11:00 share the 10:00 slot; the new entry sits in the middle of the second one.
		store.addTimeLog('untouched', '10:00', '10:05', MANUAL_ENTRY);
		store.addTimeLog('overlapped', '10:05', '11:00', MANUAL_ENTRY);

		await addManualTime('10:20', '10:40');

		expect(store.shapes()).toEqual([
			['10:00', '10:05', ['10:00']],
			['10:05', '10:20', ['10:00', '10:10']],
			['10:20', '10:40', ['10:20', '10:30']],
			['10:40', '11:00', ['10:40', '10:50']]
		]);
	});

	it('an entry moved over a tracked one leaves the tracked one its time after the move', async () => {
		store.addTimeLog('moved', '09:00', '10:00', MANUAL_ENTRY);
		store.addTimeLog('tracked', '10:30', '12:00');

		await service.updateManualTime('moved', entry(at('10:00'), at('11:00')));

		expect(store.shapes()).toEqual([
			['10:00', '11:00', slotStarts('10:00', '11:00')],
			['11:00', '12:00', slotStarts('11:00', '12:00')]
		]);
	});

	/**
	 * The slot both entries hold kept the overlapped entry's duration from before the overlap was taken out of it, and
	 * the entry saved over it joined the slot without adding its own time, which the slot creation leaves out of a
	 * slot already stored (360 seconds for 480 seconds of entries, on a running API).
	 */
	it('a slot the new entry shares with what is left of an entry counts the time of both', async () => {
		store.addTimeLog('manual', '13:32', '13:38', MANUAL_ENTRY);

		await addManualTime('13:30', '13:36');

		expect(store.shapes()).toEqual([
			['13:30', '13:36', ['13:30']],
			['13:36', '13:38', ['13:30']]
		]);
		expect(store.timeSlotDurations()).toEqual([['13:30', 480]]);
	});

	/**
	 * The recount ran only once every cut and the save had succeeded. When the save failed after a cut, the slot the cut
	 * entry still holds kept the time of the whole entry (360 seconds for the 120 it has left).
	 */
	it('a slot the cut entry holds counts what is left of it when the manual entry then fails to save', async () => {
		store.addTimeLog('manual', '13:32', '13:38', MANUAL_ENTRY);
		store.failOn(TimeLogCreateCommand);

		await expect(addManualTime('13:30', '13:36')).rejects.toThrow('The database connection was lost');

		expect(store.shapes()).toEqual([['13:36', '13:38', ['13:30']]]);
		expect(store.timeSlotDurations()).toEqual([['13:30', 120]]);
	});

	it('a slot the cut entry holds counts what is left of it when the moved entry then fails to save', async () => {
		store.addTimeLog('moved', '09:00', '10:00', MANUAL_ENTRY);
		store.addTimeLog('tracked', '10:32', '10:38');
		const dispatch = store.execute.getMockImplementation();
		store.execute.mockImplementation((command: unknown) => {
			const updatesTheMovedEntry =
				command instanceof TimeLogUpdateCommand && (command.id as { id?: string })?.id === 'moved';
			if (updatesTheMovedEntry) {
				return Promise.reject(new Error('The database connection was lost'));
			}
			return dispatch(command);
		});

		await expect(service.updateManualTime('moved', entry(at('10:00'), at('10:36')))).rejects.toThrow(
			'The database connection was lost'
		);

		expect(store.timeSlotDurations()).toEqual([
			['09:00', 600],
			['09:10', 600],
			['09:20', 600],
			['09:30', 600],
			['09:40', 600],
			['09:50', 600],
			['10:30', 120]
		]);
	});

	it('a slot an entry moved over another shares with what is left of it counts the time of both', async () => {
		store.addTimeLog('moved', '09:00', '10:00', MANUAL_ENTRY);
		store.addTimeLog('tracked', '10:32', '10:38');

		await service.updateManualTime('moved', entry(at('10:00'), at('10:36')));

		expect(store.shapes()).toEqual([
			['10:00', '10:36', ['10:00', '10:10', '10:20', '10:30']],
			['10:36', '10:38', ['10:30']]
		]);
		expect(store.timeSlotDurations()).toEqual([
			['10:00', 600],
			['10:10', 600],
			['10:20', 600],
			['10:30', 480]
		]);
	});
});

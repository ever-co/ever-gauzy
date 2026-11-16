// Must stay first: see time-log.service.spec.ts.
import '../../core/entities/internal';

import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IManualTimeInput, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { ApiException } from '../../core/errors/api-exception';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { mockRequestContext } from '../testing/recording-query-builder';
import { at, SPAN_EMPLOYEE_ID, SPAN_ORGANIZATION_ID, SPAN_TENANT_ID, TimeSpanStore } from '../testing/time-span-store';
import { DeleteTimeSpanCommand, TimeLogUpdateCommand } from './commands';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TIME_LOG_CHANGED } from './time-log-precondition';
import { TimeLogService } from './time-log.service';

/**
 * A manual edit under a precondition (`expectedUpdatedAt`, ever-co/ever-teams#5382), through the real overlap handling
 * over a scripted store of logs and time slots.
 *
 * An edit's overlap cleanup writes OTHER entries before the edit itself is written. An edit made on a read the entry
 * no longer holds is therefore refused before that cleanup, not only by the write (which checks it again under the
 * entry's lock, see `time-log-conditional-write.orm-parity.spec.ts`): a refused edit cuts nothing.
 */

const USER_ID = '2e4f6a8c-0b1d-4e3f-9a5b-7c9d1e3f5a72';

const MANUAL_ENTRY = { logType: TimeLogType.MANUAL, source: TimeLogSourceEnum.WEB_TIMER };

/** The `updatedAt` the edited entry holds, and an earlier one a stale read saw. */
const STORED_VERSION = new Date('2026-11-02T08:00:00.123Z');
const EARLIER_VERSION = '2026-11-01T08:00:00.000Z';

describe('TimeLogService: a manual edit under a precondition', () => {
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

	/** The edited entry over 09:00-10:00, and another one the edit's new range (10:00-11:00) overlaps. */
	const storeEntries = () => {
		store.addTimeLog('edited', '09:00', '10:00', { ...MANUAL_ENTRY, updatedAt: STORED_VERSION });
		store.addTimeLog('tracked', '10:30', '12:00');
	};

	const edit = (expectedUpdatedAt?: string) =>
		service.updateManualTime('edited', {
			employeeId: SPAN_EMPLOYEE_ID,
			organizationId: SPAN_ORGANIZATION_ID,
			startedAt: at('10:00'),
			stoppedAt: at('11:00'),
			...(expectedUpdatedAt === undefined ? {} : { expectedUpdatedAt })
		} as IManualTimeInput);

	const commandsRun = () => store.execute.mock.calls.map(([command]) => command);

	it('refuses an edit made on a read the entry no longer holds before anything is cut or written', async () => {
		storeEntries();
		const before = store.shapes();

		const error: any = await edit(EARLIER_VERSION).then(
			() => null,
			(refusal) => refusal
		);

		expect(error).toBeInstanceOf(ApiException);
		expect(error.getStatus()).toBe(409);
		expect(error.code).toBe('CONCURRENT_MODIFICATION');
		expect(error.message).toBe(TIME_LOG_CHANGED);
		expect(error.details).toMatchObject({
			expectedUpdatedAt: EARLIER_VERSION,
			actualUpdatedAt: STORED_VERSION.toISOString(),
			timeLog: { id: 'edited' }
		});
		expect(store.shapes()).toEqual(before);
		const commands = commandsRun();
		expect(commands.some((command) => command instanceof DeleteTimeSpanCommand)).toBe(false);
		expect(commands.some((command) => command instanceof TimeLogUpdateCommand)).toBe(false);
	});

	it("never answers a coworker's entry: an edit the caller may not make is refused as before, without it", async () => {
		storeEntries();
		const before = store.shapes();
		// A caller who may record their own time only, naming themselves on a coworker's entry, with a stale version
		const ownEmployeeId = '2e4f6a8c-0b1d-4e3f-9a5b-7c9d1e3f5a73';
		mockRequestContext({
			tenantId: SPAN_TENANT_ID,
			user: { id: USER_ID, employeeId: ownEmployeeId },
			canChangeSelectedEmployee: false
		});

		const error: any = await service
			.updateManualTime('edited', {
				employeeId: ownEmployeeId,
				organizationId: SPAN_ORGANIZATION_ID,
				startedAt: at('10:00'),
				stoppedAt: at('11:00'),
				expectedUpdatedAt: EARLIER_VERSION
			} as IManualTimeInput)
			.then(
				() => null,
				(refusal) => refusal
			);

		expect(error?.getStatus?.()).toBe(403);
		expect(error).not.toBeInstanceOf(ApiException);
		expect(JSON.stringify(error.getResponse())).not.toContain('edited');
		expect(store.shapes()).toEqual(before);
	});

	it('refuses a precondition that is no date and time with 400, before anything is cut or written', async () => {
		storeEntries();
		const before = store.shapes();

		await expect(edit('yesterday')).rejects.toMatchObject({ status: 400 });

		expect(store.shapes()).toEqual(before);
		expect(commandsRun().some((command) => command instanceof DeleteTimeSpanCommand)).toBe(false);
	});

	it('hands the precondition the entry still holds on to the write, which checks it again under the lock', async () => {
		storeEntries();
		// The write itself is the handler's (see the ORM parity spec); here it is only the command it is given
		const updates: TimeLogUpdateCommand[] = [];
		const dispatch = store.execute.getMockImplementation();
		store.execute.mockImplementation((command: unknown) => {
			// The edit's own write; the cleanup's writes of the entry it overlaps run as they always do
			const isTheEdit = command instanceof TimeLogUpdateCommand && 'expectedUpdatedAt' in command.input;
			if (isTheEdit) {
				updates.push(command);
				return Promise.resolve(undefined);
			}
			return dispatch(command);
		});

		await edit(STORED_VERSION.toISOString());

		expect(updates).toHaveLength(1);
		expect(updates[0].input).toMatchObject({ expectedUpdatedAt: STORED_VERSION.toISOString() });
		// The overlap cleanup ran, as for any edit the precondition lets through
		expect(commandsRun().some((command) => command instanceof DeleteTimeSpanCommand)).toBe(true);
	});

	it('without a precondition, edits as before', async () => {
		storeEntries();

		await edit();

		expect(store.read('edited')).toMatchObject({ startedAt: at('10:00'), stoppedAt: at('11:00') });
	});
});

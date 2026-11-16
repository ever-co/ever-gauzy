/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `time-log.service.spec.ts` for the cycle it avoids.
 */
import '../../core/entities/internal';
import { ConflictException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { ITimeLog, TimeLogType, TimesheetStatus } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { Organization } from '../../organization/organization.entity';
import { Timesheet } from '../timesheet/timesheet.entity';
import { DeleteTimeSpanCommand } from './commands';
import { TimeLogService } from './time-log.service';
import {
	TIME_LOG_SPLIT_APPROVED,
	TIME_LOG_SPLIT_CHANGED,
	TIME_LOG_SPLIT_INVOICED,
	TIME_LOG_SPLIT_OFF_BOUNDARY,
	TIME_LOG_SPLIT_REASON_REQUIRED,
	TIME_LOG_SPLIT_RUNNING
} from './time-log-split-rule';

jest.mock('./time-log-references', () => ({ assertTimeLogReferencesOfTenant: jest.fn(async () => undefined) }));

const TENANT_ID = '12030000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '12030000-0000-4000-8000-0000000000bb';
const EMPLOYEE_ID = '12030000-0000-4000-8000-0000000000cc';
const TIMESHEET_ID = '12030000-0000-4000-8000-0000000000dd';
const LOG_ID = '12030000-0000-4000-8000-000000000001';
const CHECKOUT_TASK_ID = '12030000-0000-4000-8000-000000000002';

/** 2026-11-16 at `HH:mm`, UTC. */
const at = (time: string) => new Date(`2026-11-16T${time}:00.000Z`);

/** What the store behind the service answers, for one spec. */
interface IStoreState {
	log: ITimeLog;
	part?: ITimeLog;
	timesheetStatus: TimesheetStatus;
	requireReason: boolean;
	slotCount: number;
	/** Whether the read of the log not billed by a live invoice finds it. */
	notInvoicedCount: number;
	canManage: boolean;
	/** What the split command answers: whether it split the log. */
	splits: boolean;
}

/** Marie's tracked log from 09:00 to 13:00, on a draft timesheet, holding its 24 slots. */
function marieLog(changes: Partial<ITimeLog> = {}): ITimeLog {
	return {
		id: LOG_ID,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		timesheetId: TIMESHEET_ID,
		startedAt: at('09:00'),
		stoppedAt: at('13:00'),
		isRunning: false,
		logType: TimeLogType.TRACKED,
		duration: 4 * 3600,
		...changes
	} as ITimeLog;
}

function createService(changes: Partial<IStoreState> = {}) {
	const state: IStoreState = {
		log: marieLog(),
		timesheetStatus: TimesheetStatus.DRAFT,
		requireReason: false,
		slotCount: 24,
		notInvoicedCount: 1,
		canManage: true,
		splits: true,
		...changes
	};

	// The two counts the service reads through a query: the log's slots, then the log as not billed by a live invoice
	let counts = 0;
	const queryBuilder = () => {
		const builder = {
			alias: 'time_log',
			innerJoin: () => builder,
			where: () => builder,
			andWhere: () => builder,
			getCount: async () => {
				const readsSlots = counts === 0;
				counts++;
				if (readsSlots) {
					return state.slotCount;
				}
				return state.notInvoicedCount;
			}
		};
		return builder;
	};
	const manager = {
		findOne: jest.fn(async (entity: unknown) => {
			if (entity === Timesheet) {
				return { id: TIMESHEET_ID, status: state.timesheetStatus };
			}
			if (entity === Organization) {
				return { id: ORGANIZATION_ID, requireReason: state.requireReason };
			}
			return null;
		})
	};
	const timeLogRepository = {
		manager,
		createQueryBuilder: jest.fn(queryBuilder),
		// The second part a split made, looked up by the log it was cut from and its start
		findOne: jest.fn(async ({ where }: { where: { splitFromTimeLogId: string; startedAt: Date } }) => {
			const part = state.part;
			const isThePart =
				Boolean(part) &&
				where.splitFromTimeLogId === LOG_ID &&
				new Date(part.startedAt).getTime() === new Date(where.startedAt).getTime();
			if (!isThePart) {
				return null;
			}
			return part;
		})
	};
	const execute = jest.fn(async (command: unknown) => {
		if (!(command instanceof DeleteTimeSpanCommand)) {
			throw new Error(`Unexpected command ${(command as object)?.constructor?.name}`);
		}
		if (!state.splits) {
			return false;
		}
		const splitAt = command.newTime.start;
		state.part = { ...state.log, id: 'second-part', startedAt: splitAt, ...command.split.secondPart } as ITimeLog;
		state.log = { ...state.log, stoppedAt: splitAt };
		return true;
	});
	const managedEmployees = { canManageEmployee: jest.fn(async () => state.canManage) };

	const service = new TimeLogService(
		timeLogRepository as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{ execute } as never,
		managedEmployees as never
	);
	jest.spyOn(service as any, 'withoutEmployeeFilter').mockImplementation((callback: () => Promise<unknown>) =>
		callback()
	);
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => ({ ...state.log }) as never);

	return { service, execute, state, managedEmployees };
}

/** The body of the HTTP refusal a promise rejects with, with its status. */
async function refusalOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		if (error instanceof HttpException) {
			return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
		}
		throw error;
	}
	return null;
}

describe('TimeLogService.splitTimeLog (CORE-26)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it('splits the log through the internal split, at that one moment, and answers both parts', async () => {
		const { service, execute } = createService();

		const result = await service.splitTimeLog(LOG_ID, {
			splitAt: at('11:00'),
			taskId: CHECKOUT_TASK_ID,
			reason: '  Switched to the checkout bug  '
		});

		expect(execute).toHaveBeenCalledTimes(1);
		const command = execute.mock.calls[0][0] as DeleteTimeSpanCommand;
		expect(command.newTime).toEqual({ start: at('11:00'), end: at('11:00') });
		expect(command.timeLog.id).toBe(LOG_ID);
		// Only the fields the body names: the others keep the log's value
		expect(command.split).toEqual({
			secondPart: { taskId: CHECKOUT_TASK_ID },
			history: { reason: 'Switched to the checkout bug' }
		});
		expect(result.first).toMatchObject({ id: LOG_ID, stoppedAt: at('11:00') });
		expect(result.second).toMatchObject({ id: 'second-part', startedAt: at('11:00'), taskId: CHECKOUT_TASK_ID });
	});

	it('answers the two parts of a split that already went through, writing nothing, when the request comes again', async () => {
		const { service, execute } = createService();
		await service.splitTimeLog(LOG_ID, { splitAt: at('11:00') });
		execute.mockClear();

		const again = await service.splitTimeLog(LOG_ID, { splitAt: at('11:00') });

		expect(execute).not.toHaveBeenCalled();
		expect(again.first.stoppedAt).toEqual(at('11:00'));
		expect(again.second.id).toBe('second-part');
	});

	it('refuses a split off a slot boundary with the two nearest ones, and writes nothing', async () => {
		const { service, execute } = createService();

		const refusal = await refusalOf(service.splitTimeLog(LOG_ID, { splitAt: at('11:05') }));

		expect(refusal).toEqual({
			status: HttpStatus.BAD_REQUEST,
			body: {
				statusCode: HttpStatus.BAD_REQUEST,
				code: TIME_LOG_SPLIT_OFF_BOUNDARY,
				message: expect.any(String),
				before: at('11:00').toISOString(),
				after: at('11:10').toISOString()
			}
		});
		expect(execute).not.toHaveBeenCalled();
	});

	it.each([
		['a running log', { log: marieLog({ isRunning: true }) }, TIME_LOG_SPLIT_RUNNING],
		['a log on an approved timesheet', { timesheetStatus: TimesheetStatus.APPROVED }, TIME_LOG_SPLIT_APPROVED],
		[
			'a log a live invoice bills',
			{ log: marieLog({ invoiceItemId: 'line' }), notInvoicedCount: 0 },
			TIME_LOG_SPLIT_INVOICED
		]
	] as Array<[string, Partial<IStoreState>, string]>)(
		'refuses to split %s with the reason, writing nothing',
		async (_what, state, code) => {
			const { service, execute } = createService(state);

			const refusal = await refusalOf(service.splitTimeLog(LOG_ID, { splitAt: at('11:00') }));

			expect(refusal).toMatchObject({ status: HttpStatus.FORBIDDEN, body: { code } });
			expect(execute).not.toHaveBeenCalled();
		}
	);

	it('splits a log a voided invoice billed', async () => {
		const { service, execute } = createService({ log: marieLog({ invoiceItemId: 'line' }), notInvoicedCount: 1 });

		await service.splitTimeLog(LOG_ID, { splitAt: at('11:00') });

		expect(execute).toHaveBeenCalledTimes(1);
	});

	it("refuses another member's log to a caller who does not manage them, before reading anything else", async () => {
		const { service, execute, managedEmployees } = createService({ canManage: false });

		await expect(service.splitTimeLog(LOG_ID, { splitAt: at('11:00') })).rejects.toBeInstanceOf(ForbiddenException);

		expect(managedEmployees.canManageEmployee).toHaveBeenCalledWith(EMPLOYEE_ID, undefined, ORGANIZATION_ID);
		expect(execute).not.toHaveBeenCalled();
	});

	it('asks for a reason where the organization requires one', async () => {
		const { service, execute } = createService({ requireReason: true });

		const refusal = await refusalOf(service.splitTimeLog(LOG_ID, { splitAt: at('11:00') }));

		expect(refusal).toMatchObject({
			status: HttpStatus.BAD_REQUEST,
			body: { code: TIME_LOG_SPLIT_REASON_REQUIRED }
		});
		expect(execute).not.toHaveBeenCalled();
	});

	it('splits a manual log at any minute', async () => {
		const { service, execute } = createService({ log: marieLog({ logType: TimeLogType.MANUAL }) });

		await service.splitTimeLog(LOG_ID, { splitAt: at('11:05') });

		expect(execute).toHaveBeenCalledTimes(1);
	});

	it('answers a conflict when the log changed before its turn came, and nothing was split', async () => {
		const { service } = createService({ splits: false });

		const outcome = service.splitTimeLog(LOG_ID, { splitAt: at('11:00') });

		await expect(outcome).rejects.toBeInstanceOf(ConflictException);
		await expect(outcome).rejects.toMatchObject({ response: { code: TIME_LOG_SPLIT_CHANGED } });
	});
});

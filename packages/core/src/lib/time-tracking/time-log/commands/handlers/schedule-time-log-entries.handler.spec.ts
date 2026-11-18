// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { Brackets } from 'typeorm';
import { TimeLogType } from '@gauzy/contracts';
import { MultiORMEnum } from '../../../../core/utils';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';
import { ScheduleTimeLogEntriesHandler } from './schedule-time-log-entries.handler';

/**
 * `ScheduleTimeLogEntriesCommand` closes an employee's pending time logs (the running ones, and those stored without an
 * end) when a timer starts or stops. Its query kept the employee, organization and tenant filters only when the
 * employee and organization ids were both set: without one, it selected every pending log of every employee and
 * tenant, and closed them all. The handler now refuses to run unless the three ids are given, and closes nothing.
 *
 * The repositories answer from an in-memory table. Their query builders keep the filters the handler adds, so a query
 * built without them selects every pending log, as the SQL would.
 */

const NOW = new Date('2026-11-12T11:30:00.000Z');

/** The employee filter's columns, as the handler names them. */
const EMPLOYEE_FILTER_COLUMNS = ['employeeId', 'organizationId', 'tenantId'];

interface TimeLogRow {
	id: string;
	employeeId: string;
	organizationId: string;
	tenantId: string;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date | null;
	logType?: TimeLogType;
}

/** Two employees of two tenants, each with a timer running since 11:00. */
const runningLogs = (): TimeLogRow[] => [
	{
		id: 'log-1',
		employeeId: 'employee-1',
		organizationId: 'organization-1',
		tenantId: 'tenant-1',
		isRunning: true,
		startedAt: new Date('2026-11-12T11:00:00.000Z'),
		stoppedAt: new Date('2026-11-12T11:00:00.000Z')
	},
	{
		id: 'log-2',
		employeeId: 'employee-2',
		organizationId: 'organization-2',
		tenantId: 'tenant-2',
		isRunning: true,
		startedAt: new Date('2026-11-12T11:00:00.000Z'),
		stoppedAt: new Date('2026-11-12T11:00:00.000Z')
	}
];

/** The pending logs the employee filter selects; with no filter, every pending log. */
function selectPending(table: TimeLogRow[], filter: Record<string, unknown>): TimeLogRow[] {
	const isPending = (row: TimeLogRow) => row.isRunning || row.stoppedAt === null;
	const matchesFilter = (row: TimeLogRow) =>
		Object.entries(filter).every(([column, value]) => row[column as keyof TimeLogRow] === value);
	return table.filter((row) => isPending(row) && matchesFilter(row));
}

/** The employee filter among the named parameters a query was given. */
function employeeFilter(parameters: Record<string, unknown>): Record<string, unknown> {
	const filter: Record<string, unknown> = {};
	for (const column of EMPLOYEE_FILTER_COLUMNS) {
		if (column in parameters) {
			filter[column] = parameters[column];
		}
	}
	return filter;
}

/** Writes a partial time log onto its row. */
function write(table: TimeLogRow[], partial: Partial<TimeLogRow> & { id: string }) {
	const row = table.find((candidate) => candidate.id === partial.id);
	return Object.assign(row, partial);
}

/** The TypeORM repository: its query builder keeps the parameters of every condition, inside brackets too. */
function typeOrmRepository(table: TimeLogRow[]) {
	return {
		createQueryBuilder: () => {
			const parameters: Record<string, unknown> = {};
			const conditions = {
				alias: 'time_log',
				andWhere: (where: unknown, values?: Record<string, unknown>) => {
					if (where instanceof Brackets) {
						where.whereFactory(conditions as never);
					} else {
						Object.assign(parameters, values);
					}
					return conditions;
				},
				orWhere: (where: unknown, values?: Record<string, unknown>) => conditions.andWhere(where, values)
			};
			const builder = {
				setFindOptions: () => builder,
				// The handler hands `where` a function that adds its conditions to the builder it is given
				where: (addConditions: (qb: unknown) => void) => {
					addConditions(conditions);
					return builder;
				},
				getQueryAndParameters: () => ['', []],
				getMany: async () =>
					selectPending(table, employeeFilter(parameters)).map((row) => ({ ...row, timeSlots: [] }))
			};
			return builder;
		},
		save: async (partial: Partial<TimeLogRow> & { id: string }) => write(table, partial)
	};
}

/** The MikroORM repository: its knex builder keeps the columns `andWhere` is given. */
function mikroOrmRepository(table: TimeLogRow[]) {
	const knex = Object.assign(
		() => {
			const columns: Record<string, unknown> = {};
			const builder = {
				withSchema: () => builder,
				// The pending condition, which `selectPending` applies
				where: () => builder,
				andWhere: (values: Record<string, unknown>) => {
					Object.assign(columns, values);
					return builder;
				},
				select: async () => selectPending(table, employeeFilter(columns)).map(({ id }) => ({ id }))
			};
			return builder;
		},
		{ userParams: { schema: undefined } }
	);

	return {
		getKnex: () => knex,
		find: async ({ id }: { id: { $in: string[] } }) =>
			table.filter((row) => id.$in.includes(row.id)).map((row) => ({ ...row, timeSlots: [] })),
		getEntityManager: () => ({
			getReference: (_entityName: string, id: string) => ({ id }),
			assign: (entity: object, partial: object) => Object.assign(entity, partial),
			persistAndFlush: async (entity: Partial<TimeLogRow> & { id: string }) => {
				write(table, entity);
			}
		})
	};
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('ScheduleTimeLogEntriesHandler (%s)', (ormType) => {
	const setup = () => {
		const table = runningLogs();
		const handler: ScheduleTimeLogEntriesHandler = Object.assign(
			Object.create(ScheduleTimeLogEntriesHandler.prototype),
			{
				ormType,
				typeOrmTimeLogRepository: typeOrmRepository(table),
				mikroOrmTimeLogRepository: mikroOrmRepository(table)
			}
		);
		return { handler, table };
	};

	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each([
		['employee', new ScheduleTimeLogEntriesCommand(undefined, 'organization-1', 'tenant-1')],
		['organization', new ScheduleTimeLogEntriesCommand('employee-1', undefined, 'tenant-1')],
		['tenant', new ScheduleTimeLogEntriesCommand('employee-1', 'organization-1', undefined)]
	])('refuses to run without the %s id, and closes nothing', async (_missingId, command) => {
		const { handler, table } = setup();

		await expect(handler.execute(command)).rejects.toThrow(
			"Can't close pending time logs without an employee, organization and tenant id"
		);
		expect(table.map((row) => row.isRunning)).toEqual([true, true]);
	});

	it('closes the pending logs of the employee it names, and no one else’s', async () => {
		const { handler, table } = setup();

		await handler.execute(new ScheduleTimeLogEntriesCommand('employee-1', 'organization-1', 'tenant-1'));

		expect(table[0]).toMatchObject({ id: 'log-1', isRunning: false });
		expect(table[1]).toMatchObject({ id: 'log-2', isRunning: true });
	});

	it('ends a running break at the moment it is replaced, where a run without slots gets ten seconds', async () => {
		const { handler, table } = setup();
		const breakStart = new Date('2026-11-12T10:30:00.000Z');
		Object.assign(table[0], { logType: TimeLogType.BREAK, startedAt: breakStart, stoppedAt: breakStart });
		const runStart = new Date('2026-11-12T10:30:00.000Z');
		Object.assign(table[1], {
			employeeId: 'employee-1',
			organizationId: 'organization-1',
			tenantId: 'tenant-1',
			startedAt: runStart,
			stoppedAt: runStart
		});

		await handler.execute(new ScheduleTimeLogEntriesCommand('employee-1', 'organization-1', 'tenant-1'));

		expect(table[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
		expect(table[1]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-11-12T10:30:10.000Z') });
	});

	it('ends a break at the start of the run that replaces it, set earlier than now', async () => {
		const { handler, table } = setup();
		const breakStart = new Date('2026-11-12T10:30:00.000Z');
		Object.assign(table[0], { logType: TimeLogType.BREAK, startedAt: breakStart, stoppedAt: breakStart });
		const workStart = new Date('2026-11-12T11:00:00.000Z');

		await handler.execute(
			new ScheduleTimeLogEntriesCommand('employee-1', 'organization-1', 'tenant-1', undefined, workStart)
		);

		expect(table[0]).toMatchObject({ isRunning: false, stoppedAt: workStart });
	});

	it.each([
		['at the same time as the break', '2026-11-12T10:30:00.000Z'],
		['before the break', '2026-11-12T10:00:00.000Z']
	])('ends a break at its own start when the run that replaces it starts %s', async (_when, workStart) => {
		const { handler, table } = setup();
		const breakStart = new Date('2026-11-12T10:30:00.000Z');
		Object.assign(table[0], { logType: TimeLogType.BREAK, startedAt: breakStart, stoppedAt: breakStart });

		await handler.execute(
			new ScheduleTimeLogEntriesCommand(
				'employee-1',
				'organization-1',
				'tenant-1',
				undefined,
				new Date(workStart)
			)
		);

		expect(table[0]).toMatchObject({ isRunning: false, stoppedAt: breakStart });
	});

	it('closes only the running logs the command names, and still ends a log stored without one', async () => {
		const { handler, table } = setup();
		const employeeOne = { employeeId: 'employee-1', organizationId: 'organization-1', tenantId: 'tenant-1' };
		table.push(
			// Started by another client after the stop read the runs going
			{
				id: 'log-started-meanwhile',
				...employeeOne,
				isRunning: true,
				startedAt: new Date('2026-11-12T11:20:00.000Z'),
				stoppedAt: new Date('2026-11-12T11:20:00.000Z')
			},
			// Stored stopped, without an end
			{
				id: 'log-without-end',
				...employeeOne,
				isRunning: false,
				startedAt: new Date('2026-11-12T09:00:00.000Z'),
				stoppedAt: null
			}
		);

		await handler.execute(new ScheduleTimeLogEntriesCommand('employee-1', 'organization-1', 'tenant-1', ['log-1']));

		const row = (id: string) => table.find((candidate) => candidate.id === id);
		expect(row('log-1')).toMatchObject({ isRunning: false });
		expect(row('log-started-meanwhile')).toMatchObject({ isRunning: true });
		// No slot and over ten minutes old: ten seconds after its start, as every start and stop gave it on develop
		expect(row('log-without-end')).toMatchObject({
			isRunning: false,
			stoppedAt: new Date('2026-11-12T09:00:10.000Z')
		});
	});
});

/**
 * ever-co/ever-gauzy#12071: the stop of a run left going, for the webhooks, commits with the stop where the outbox can
 * share its transaction (TypeORM), and is written right after it otherwise. The fact is built from the row as stored,
 * read through TypeORM: the end worked out before the stop is written apart from it, and a MikroORM read leaves the
 * scalar ids out. A read that only feeds the fact never stops the close.
 */
describe('ScheduleTimeLogEntriesHandler: the fact of a run it closes', () => {
	/** The end the handler works out for a run of no slot started at 11:00: ten seconds after its start. */
	const WORKED_OUT_END = new Date('2026-11-12T11:00:10.000Z');

	const setup = (ormType: MultiORMEnum, appendsWithinWrites: boolean) => {
		const table = runningLogs();
		/** The row as a TypeORM read by id answers it. */
		const stored = async (where: { id: string }) => {
			const row = table.find((candidate) => candidate.id === where.id);
			return row ? { ...row } : null;
		};
		/**
		 * A save of a partial entity. As TypeORM's does, it sets every nullable column it was not given to null on the
		 * object it saves, and answers that object: laid over the row, it would erase the row's end.
		 */
		const saveOf = () =>
			jest.fn(async (partial: Partial<TimeLogRow> & { id: string }) => {
				write(table, partial);
				if (partial.stoppedAt === undefined) {
					partial.stoppedAt = null;
				}
				return partial;
			});
		const repository = Object.assign(typeOrmRepository(table), { save: saveOf(), findOneBy: jest.fn(stored) });
		// The transaction's own repository, over the same rows, with spies of its own
		const transactionRepository = {
			save: saveOf(),
			findOne: jest.fn(async ({ where }: { where: { id: string } }) => stored(where)),
			findOneBy: jest.fn(stored)
		};
		// The stop's transaction: it reads nothing back for the fact, which is the locked row with what the stop wrote
		const transactionManager = { getRepository: jest.fn(() => transactionRepository) };
		// The facts written: by name, whether in the stop's transaction, and the entry each carries
		const recorded: Array<{ name: string; within: boolean; entry: unknown }> = [];
		const facts = {
			appendsWithinWrites: () => appendsWithinWrites,
			record: jest.fn(async (name: string, entry: unknown) => {
				recorded.push({ name, within: false, entry });
			}),
			recordWithin: jest.fn(async (manager: unknown, name: string, entry: unknown) => {
				recorded.push({ name, within: manager === transactionManager, entry });
			})
		};
		// A MikroORM read hands the log without its scalar ids (tenant, organization, employee)
		const mikroOrm = Object.assign(mikroOrmRepository(table), {
			find: async ({ id }: { id: { $in: string[] } }) =>
				table
					.filter((row) => id.$in.includes(row.id))
					.map((row) => ({
						id: row.id,
						isRunning: row.isRunning,
						startedAt: row.startedAt,
						stoppedAt: row.stoppedAt,
						timeSlots: []
					}))
		});
		const logger = { warn: jest.fn() };
		const handler: ScheduleTimeLogEntriesHandler = Object.assign(
			Object.create(ScheduleTimeLogEntriesHandler.prototype),
			{
				ormType,
				logger,
				typeOrmTimeLogRepository: Object.assign(repository, {
					manager: { transaction: jest.fn(async (work: (m: unknown) => unknown) => work(transactionManager)) }
				}),
				mikroOrmTimeLogRepository: mikroOrm,
				facts
			}
		);
		return { handler, table, recorded, logger, repository, transactionRepository };
	};
	const command = () => new ScheduleTimeLogEntriesCommand('employee-1', 'organization-1', 'tenant-1');
	/** The run as stored once stopped, as its fact must carry it. */
	const stoppedRun = (stoppedAt: Date = WORKED_OUT_END) =>
		expect.objectContaining({
			id: 'log-1',
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			employeeId: 'employee-1',
			isRunning: false,
			stoppedAt
		});

	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});
	afterEach(() => jest.restoreAllMocks());

	it('writes time_log.stopped in the transaction of the stop under TypeORM, with the row as stored', async () => {
		const { handler, table, recorded, repository, transactionRepository } = setup(MultiORMEnum.TypeORM, true);

		await handler.execute(command());

		expect(table[0]).toMatchObject({ id: 'log-1', isRunning: false, stoppedAt: WORKED_OUT_END });
		// The stop goes through the transaction's repository, the end worked out before it through the handler's own
		expect(transactionRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'log-1', isRunning: false })
		);
		expect(repository.save).toHaveBeenCalledWith({ id: 'log-1', stoppedAt: WORKED_OUT_END });
		expect(repository.save).not.toHaveBeenCalledWith(expect.objectContaining({ isRunning: false }));
		expect(recorded).toEqual([{ name: 'time_log.stopped', within: true, entry: stoppedRun() }]);
		// Read once, under the row's lock, before the stop: nothing is read after it
		expect(transactionRepository.findOne).toHaveBeenCalledTimes(1);
		expect(transactionRepository.findOneBy).not.toHaveBeenCalled();
	});

	it('writes it right after the stop under MikroORM, with the ids and the end the row stores', async () => {
		const { handler, table, recorded } = setup(MultiORMEnum.MikroORM, false);

		await handler.execute(command());

		expect(table[0]).toMatchObject({ id: 'log-1', isRunning: false });
		expect(recorded).toEqual([{ name: 'time_log.stopped', within: false, entry: stoppedRun() }]);
	});

	it('tells of an update, not a second stop, when another stop closed the run since the pending read', async () => {
		const { handler, table, recorded, transactionRepository } = setup(MultiORMEnum.TypeORM, true);
		// The other stop commits before this one takes the row's lock
		transactionRepository.findOne.mockImplementationOnce(async ({ where }: { where: { id: string } }) => {
			write(table, { id: where.id, isRunning: false });
			return { ...table.find((row) => row.id === where.id) };
		});

		await handler.execute(command());

		expect(recorded).toEqual([
			{ name: 'time_log.updated', within: true, entry: expect.objectContaining({ id: 'log-1', isRunning: false }) }
		]);
	});

	it('keeps the end of a stop that closed the run before the lock, as the locked row holds it', async () => {
		const { handler, table, recorded, transactionRepository } = setup(MultiORMEnum.TypeORM, true);
		// A run read with no end, started five minutes ago: the close works out no end of its own
		Object.assign(table[0], { startedAt: new Date('2026-11-12T11:25:00.000Z'), stoppedAt: null });
		const otherStopsEnd = new Date('2026-11-12T11:28:00.000Z');
		transactionRepository.findOne.mockImplementationOnce(async ({ where }: { where: { id: string } }) => {
			write(table, { id: where.id, isRunning: false, stoppedAt: otherStopsEnd });
			return { ...table.find((row) => row.id === where.id) };
		});

		await handler.execute(command());

		// Decided from the locked row, the stop writes no end over the other stop's
		expect(transactionRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'log-1', isRunning: false })
		);
		expect(transactionRepository.save).not.toHaveBeenCalledWith(
			expect.objectContaining({ stoppedAt: expect.any(Date) })
		);
		expect(table[0].stoppedAt).toEqual(otherStopsEnd);
		expect(recorded).toEqual([{ name: 'time_log.updated', within: true, entry: stoppedRun(otherStopsEnd) }]);
	});

	it('stops nothing, and tells of nothing, for a run deleted since the pending read', async () => {
		const { handler, recorded, transactionRepository } = setup(MultiORMEnum.TypeORM, true);
		transactionRepository.findOne.mockResolvedValueOnce(null);

		await handler.execute(command());

		// A save of its id would insert it again
		expect(transactionRepository.save).not.toHaveBeenCalled();
		expect(recorded).toEqual([]);
	});

	it('still closes the run when the row cannot be read for its fact', async () => {
		const { handler, table, logger, repository } = setup(MultiORMEnum.MikroORM, false);
		repository.findOneBy.mockRejectedValue(new Error('The read failed'));

		await expect(handler.execute(command())).resolves.toBeUndefined();

		expect(table[0]).toMatchObject({ id: 'log-1', isRunning: false });
		expect(logger.warn).toHaveBeenCalled();
	});
});

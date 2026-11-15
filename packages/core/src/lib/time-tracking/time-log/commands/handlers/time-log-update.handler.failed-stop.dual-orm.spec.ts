import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * ever-co/ever-gauzy#11889: a stop whose time slots cannot all be written leaves the run running, with the slots it
 * took given back, and a stop sent again stops it with every slot of its range. Read here on a real SQLite database,
 * with each ORM: the stop's reads of the employee's slots and their logs, the slot it deletes and the link it drops.
 * Each stop runs with its own MikroORM context, as a request does, and reads its slots in it before and after its
 * writes, which go through TypeORM.
 *
 * The slot insert itself (`TimeSlotBulkCreateHandler`) stands in: it saves the slots missing at the range's starts,
 * linked to the run, then fails on the first stop, as its merge of the employee's slots would.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11889000-0000-4000-8000-000000000001';
const ORGANIZATION = '11889000-0000-4000-8000-000000000002';
const EMPLOYEE = '11889000-0000-4000-8000-000000000003';
const TIMESHEET = '11889000-0000-4000-8000-000000000004';
const RUN = '11889000-0000-4000-8000-000000000011';
const OTHER_LOG = '11889000-0000-4000-8000-000000000012';
/** A slot of the other log at 09:10, inside the run's range. */
const SHARED_SLOT = '11889000-0000-4000-8000-000000000021';

/** 2026-01-05 at `HH:mm`, UTC. */
const at = (time: string) => new Date(`2026-01-05T${time}:00.000Z`);

interface IState {
	isRunning: boolean;
	stoppedAt: string;
	/** The starts of the slots the run holds, `HH:mm`. */
	runSlots: string[];
	/** The starts of the slots the other log holds. */
	otherLogSlots: string[];
	/** How many slots the employee has. */
	slotCount: number;
}

interface IMeasured {
	firstError?: string;
	afterFailedStop?: IState;
	secondError?: string;
	afterStopSentAgain?: IState;
}

async function measure(orm: 'mikro-orm' | 'typeorm'): Promise<IMeasured> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-failed-stop-${orm}-${process.pid}-${Date.now()}.sqlite3`);
	const measured: IMeasured = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { RequestContext } = require('../../../../core/context');
			const { MultiORMEnum } = require('../../../../core/utils');
			const { generateTimeSlots } = require('../../../time-slot/utils');
			const { TimeSlot } = require('../../../time-slot/time-slot.entity');
			const { TimeLog } = require('../../time-log.entity');
			const { TimesheetFirstOrCreateCommand } = require('../../../timesheet/commands');
			const { TimeSlotBulkDeleteCommand } = require('../../../time-slot/commands');
			const {
				TimeSlotBulkDeleteHandler
			} = require('../../../time-slot/commands/handlers/time-slot-bulk-delete.handler');
			const {
				TypeOrmTimeSlotRepository
			} = require('../../../time-slot/repository/type-orm-time-slot.repository');
			const {
				MikroOrmTimeSlotRepository
			} = require('../../../time-slot/repository/mikro-orm-time-slot.repository');
			const { TypeOrmTimeLogRepository } = require('../../repository/type-orm-time-log.repository');
			const { TimeLogUpdateCommand } = require('../time-log-update.command');
			const { TimeLogUpdateHandler } = require('./time-log-update.handler');

			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(console, 'log').mockImplementation(() => undefined);

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();
			// The placeholders below fill NOT NULL references (the employee's user, for one) with rows that do not
			// exist: what is read here is the slots and their links, not the integrity of the rows around them.
			await dataSource.query('PRAGMA foreign_keys = OFF');

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
						? 0
						: /date|time/.test(type)
							? '2026-01-01 00:00:00'
							: 'x';
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
						.map(() => '?')
						.join(', ')})`,
					keys.map((key) => values[key])
				);
			};

			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('employee', { id: EMPLOYEE, tenantId: TENANT, organizationId: ORGANIZATION });
			const timeLogRepository = dataSource.getRepository(TimeLog);
			const timeSlotRepository = dataSource.getRepository(TimeSlot);
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION, employeeId: EMPLOYEE };
			// The run of an Ever Teams client that posted no slot, and the other log's 09:10 slot
			await timeLogRepository.save([
				timeLogRepository.create({
					...scope,
					id: RUN,
					timesheetId: TIMESHEET,
					source: 'TEAMS',
					logType: 'TRACKED',
					startedAt: at('09:00'),
					stoppedAt: at('09:00'),
					isRunning: true
				}),
				timeLogRepository.create({
					...scope,
					id: OTHER_LOG,
					timesheetId: TIMESHEET,
					source: 'DESKTOP',
					logType: 'TRACKED',
					startedAt: at('08:15'),
					stoppedAt: at('09:15'),
					isRunning: false
				})
			]);
			await timeSlotRepository.save(
				timeSlotRepository.create({
					...scope,
					id: SHARED_SLOT,
					startedAt: at('09:10'),
					duration: 300,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					timeLogs: [{ id: OTHER_LOG }]
				})
			);

			const hhmm = (date: Date) => new Date(date).toISOString().slice(11, 16);
			const slotsOf = async (logId: string) => {
				const slots = await timeSlotRepository
					.createQueryBuilder('time_slot')
					.innerJoin('time_slot.timeLogs', 'time_log', 'time_log.id = :logId', { logId })
					.getMany();
				return slots.map((slot: { startedAt: Date }) => hhmm(slot.startedAt)).sort();
			};
			const state = async (): Promise<IState> => {
				const run = await timeLogRepository.findOneBy({ id: RUN });
				return {
					isRunning: Boolean(run.isRunning),
					stoppedAt: hhmm(run.stoppedAt),
					runSlots: await slotsOf(RUN),
					otherLogSlots: await slotsOf(OTHER_LOG),
					slotCount: await timeSlotRepository.count()
				};
			};

			// The slot insert: the slots missing at the requested starts, saved linked to the run, then its merge,
			// which fails on the first stop. It answers every slot of the employee at those starts.
			let mergeFails = true;
			const timeSlotService = {
				generateTimeSlots,
				bulkCreate: async (requested: Array<{ startedAt: Date }>) => {
					const all = await timeSlotRepository.find({ where: { employeeId: EMPLOYEE } });
					const startOf = (slot: { startedAt: Date }) => hhmm(slot.startedAt);
					const existing = new Set(all.map(startOf));
					const missing = requested.filter((slot) => !existing.has(startOf(slot)));
					await timeSlotRepository.save(
						missing.map((slot) =>
							timeSlotRepository.create({
								...scope,
								id: randomUUID(),
								startedAt: new Date(slot.startedAt),
								duration: 600,
								keyboard: 0,
								mouse: 0,
								overall: 0,
								timeLogs: [{ id: RUN }]
							})
						)
					);
					if (mergeFails) {
						mergeFails = false;
						throw new Error('The merge failed');
					}
					const starts = new Set(requested.map(startOf));
					const now = await timeSlotRepository.find({ where: { employeeId: EMPLOYEE } });
					return now.filter((slot: { startedAt: Date }) => starts.has(startOf(slot)));
				}
			};

			const mikroOrm =
				orm === 'mikro-orm'
					? await MikroORM.init({
							...dbMikroOrmConnectionConfig,
							dbName: file,
							entities: coreEntities,
							allowGlobalContext: true,
							colors: false,
							discovery: { warnWhenNoEntities: false }
						})
					: undefined;

			try {
				// One stop, as one request: its own MikroORM context, read before and after its writes
				const stop = async (time: string) => {
					const ormType = orm === 'mikro-orm' ? MultiORMEnum.MikroORM : MultiORMEnum.TypeORM;
					const typeOrmTimeSlotRepository = new TypeOrmTimeSlotRepository(timeSlotRepository);
					const mikroOrmTimeSlotRepository = mikroOrm
						? new MikroOrmTimeSlotRepository(mikroOrm.em.fork(), TimeSlot)
						: {};
					const slotDelete = new TimeSlotBulkDeleteHandler(
						typeOrmTimeSlotRepository,
						mikroOrmTimeSlotRepository
					);
					slotDelete.ormType = ormType;
					const commandBus = {
						execute: async (command: unknown) => {
							if (command instanceof TimesheetFirstOrCreateCommand) return { id: TIMESHEET };
							if (command instanceof TimeSlotBulkDeleteCommand) return slotDelete.execute(command);
							return undefined;
						}
					};
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const handler: any = new TimeLogUpdateHandler(
						commandBus,
						new TypeOrmTimeLogRepository(timeLogRepository),
						typeOrmTimeSlotRepository,
						mikroOrmTimeSlotRepository,
						timeSlotService
					);
					handler.ormType = ormType;
					return handler
						.execute(new TimeLogUpdateCommand({ isRunning: false, stoppedAt: at(time) }, RUN))
						.then(
							() => undefined,
							(error: Error) => error.message
						);
				};

				measured.firstError = await stop('09:30');
				measured.afterFailedStop = await state();
				measured.secondError = await stop('09:50');
				measured.afterStopSentAgain = await state();
			} finally {
				await mikroOrm?.close(true);
			}
		});
	} finally {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		jest.restoreAllMocks();
		fs.rmSync(file, { force: true });
	}

	return measured;
}

describe.each<['MikroORM' | 'TypeORM', 'mikro-orm' | 'typeorm']>([
	['MikroORM', 'mikro-orm'],
	['TypeORM', 'typeorm']
])('TimeLogUpdateHandler, a stop whose time slots fail, then a stop sent again, on %s (#11889)', (_name, orm) => {
	let measured: IMeasured;

	beforeAll(async () => {
		measured = await measure(orm);
	}, TIMEOUT);

	it('raises the error and leaves the run running, its slots given back and the other log its own', () => {
		expect(measured.firstError).toBe('The merge failed');
		expect(measured.afterFailedStop).toEqual({
			isRunning: true,
			stoppedAt: '09:00',
			runSlots: [],
			otherLogSlots: ['09:10'],
			slotCount: 1
		});
	});

	it('stops the run with every slot of its range when the stop is sent again', () => {
		expect(measured.secondError).toBeUndefined();
		expect(measured.afterStopSentAgain).toEqual({
			isRunning: false,
			stoppedAt: '09:50',
			runSlots: ['09:00', '09:10', '09:20', '09:30', '09:40'],
			otherLogSlots: ['09:10'],
			slotCount: 5
		});
	});
});

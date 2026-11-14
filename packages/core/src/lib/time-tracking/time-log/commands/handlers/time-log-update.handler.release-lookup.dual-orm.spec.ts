import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * A shortened log releases the slots of the time it drops, named by their whole minute (`getConflictingStartTimes`).
 * A slot is stored at the start it was generated from: the desktop's at `:00.000`, the web timer's with the
 * milliseconds of the timer's start. An exact `startedAt IN (...)` found only the first shape, and a web slot stayed
 * linked to the shortened log. Both are found by their minute here, on a real SQLite database, with each ORM.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '44444444-4444-4444-8444-444444444441';
const OTHER_EMPLOYEE = '44444444-4444-4444-8444-444444444442';
const LOG = '66666666-6666-4666-8666-666666666661';
const DESKTOP_SLOT = '77777777-7777-4777-8777-777777777771';
const WEB_SLOT = '77777777-7777-4777-8777-777777777772';
const KEPT_SLOT = '77777777-7777-4777-8777-777777777773';
const OTHER_EMPLOYEE_SLOT = '77777777-7777-4777-8777-777777777774';

/** The whole minutes the release names: 09:40 and 09:50. */
const RELEASED_MINUTES = [new Date('2026-01-05T09:40:00.000Z'), new Date('2026-01-05T09:50:00.000Z')];

/** A week of ten-minute starts, as a log moved by a week releases: more terms than SQLite takes in one expression. */
const WEEK_OF_STARTS = Array.from(
	{ length: 1008 },
	(_, step) => new Date(Date.UTC(2026, 0, 6) + step * 10 * 60 * 1000)
);
const LONG_RELEASE = [...RELEASED_MINUTES, ...WEEK_OF_STARTS];

type Found = { mikroOrm: string[]; typeOrm: string[]; mikroOrmLong: string[]; typeOrmLong: string[] };

async function measure(): Promise<Found> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-release-lookup-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as Found;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../../../core/utils');
			const { TimeSlot } = require('../../../time-slot/time-slot.entity');
			const {
				TypeOrmTimeSlotRepository
			} = require('../../../time-slot/repository/type-orm-time-slot.repository');
			const {
				MikroOrmTimeSlotRepository
			} = require('../../../time-slot/repository/mikro-orm-time-slot.repository');
			const { TimeLogUpdateHandler } = require('./time-log-update.handler');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();
			// The placeholders below fill NOT NULL references with rows that do not exist: what is read here is which
			// slots a start lookup finds, not the integrity of the rows around them.
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
							? '2026-01-01 00:00:00.000'
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
			const insertSlot = async (id: string, employeeId: string, startedAt: string) => {
				await insert('time_slot', {
					id,
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					employeeId,
					startedAt,
					duration: 600
				});
				await insert('time_slot_time_logs', { timeSlotId: id, timeLogId: LOG });
			};

			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('employee', { id: EMPLOYEE, tenantId: TENANT, organizationId: ORGANIZATION });
			await insert('time_log', {
				id: LOG,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				source: 'WEB_TIMER',
				logType: 'TRACKED',
				startedAt: '2026-01-05 09:43:27.123',
				stoppedAt: '2026-01-05 10:10:00.000',
				isRunning: 0
			});
			// As the desktop stores its slots: at the whole minute.
			await insertSlot(DESKTOP_SLOT, EMPLOYEE, '2026-01-05 09:40:00.000');
			// As the web timer's slots are stored: with the milliseconds of the timer's start.
			await insertSlot(WEB_SLOT, EMPLOYEE, '2026-01-05 09:50:00.123');
			// A slot of the log's kept time, and one of another employee in a released minute: neither is asked for.
			await insertSlot(KEPT_SLOT, EMPLOYEE, '2026-01-05 10:00:00.123');
			await insertSlot(OTHER_EMPLOYEE_SLOT, OTHER_EMPLOYEE, '2026-01-05 09:50:00.000');

			// What the lookup answers, or its error: each ORM is read on its own.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const found = async (handler: any, minutes: Date[] = RELEASED_MINUTES): Promise<string[]> => {
				try {
					const slots = await handler.findTimeSlots(TENANT, ORGANIZATION, EMPLOYEE, minutes);
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					return slots.map((slot: any) => slot.id).sort();
				} catch (error) {
					return [`failed: ${error?.message ?? error}`];
				}
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const handlerWith = (typeOrmTimeSlotRepository: any, mikroOrmTimeSlotRepository: any, ormType: unknown) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const handler: any = new TimeLogUpdateHandler(
					{},
					{},
					typeOrmTimeSlotRepository,
					mikroOrmTimeSlotRepository,
					{}
				);
				handler.ormType = ormType;
				return handler;
			};

			const mikroOrm = await MikroORM.init({
				...dbMikroOrmConnectionConfig,
				dbName: file,
				entities: coreEntities,
				allowGlobalContext: true,
				colors: false,
				discovery: { warnWhenNoEntities: false }
			});
			try {
				const mikroOrmHandler = handlerWith(
					{},
					new MikroOrmTimeSlotRepository(mikroOrm.em.fork(), TimeSlot),
					MultiORMEnum.MikroORM
				);
				measurement.mikroOrm = await found(mikroOrmHandler);
				measurement.mikroOrmLong = await found(mikroOrmHandler, LONG_RELEASE);
			} finally {
				await mikroOrm.close(true);
			}

			const typeOrmHandler = handlerWith(
				new TypeOrmTimeSlotRepository(dataSource.getRepository(TimeSlot)),
				{},
				MultiORMEnum.TypeORM
			);
			measurement.typeOrm = await found(typeOrmHandler);
			measurement.typeOrmLong = await found(typeOrmHandler, LONG_RELEASE);
		});
	} finally {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		fs.rmSync(file, { force: true });
	}

	return measurement;
}

describe('TimeLogUpdateHandler, the slots a shortened log releases, found by their minute', () => {
	let measured: Found;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it("finds a slot stored at the whole minute and one stored with the milliseconds of the timer's start", () => {
			expect(measured[orm]).toEqual([DESKTOP_SLOT, WEB_SLOT].sort());
		});

		it('finds them among a week of released starts, more terms than SQLite takes in one expression', () => {
			expect(measured[`${orm}Long`]).toEqual([DESKTOP_SLOT, WEB_SLOT].sort());
		});
	});
});

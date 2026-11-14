import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The conflict read run for real on SQLite with both ORMs (#11920). A run that posted no heartbeat is closed ten
 * seconds after its start and keeps no time slot. A break set in the past inside those ten seconds must still find it,
 * which is why the timer asks for slotless work logs (`includeSlotless`) when it checks a past break.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '44444444-4444-4444-8444-444444444441';
const SLOTLESS_RUN = '66666666-6666-4666-8666-666666666661';

type Reads = { withSlotless: string[]; withoutSlotless: string[] };

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-conflict-slotless-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Reads; typeOrm: Reads };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../../../core/entities');
			const { dbMikroOrmConnectionConfig, DatabaseTypeEnum } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../../../core/utils');
			const { RequestContext } = require('../../../../core/context');
			const { TimeLog } = require('../../time-log.entity');
			const { TypeOrmTimeLogRepository } = require('../../repository/type-orm-time-log.repository');
			const { MikroOrmTimeLogRepository } = require('../../repository/mikro-orm-time-log.repository');
			const { IGetConflictTimeLogCommand } = require('../get-conflict-time-log.command');
			const { GetConflictTimeLogHandler } = require('./get-conflict-time-log.handler');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();
			// Placeholders fill NOT NULL references with rows that do not exist: what is read here is the overlap.
			await dataSource.query('PRAGMA foreign_keys = OFF');

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					const isNumber = /int|bool|numeric|decimal|real|float/.test(type);
					const isDate = /date|time/.test(type);
					let placeholder: unknown = 'x';
					if (isNumber) {
						placeholder = 0;
					} else if (isDate) {
						placeholder = '2026-01-01 00:00:00';
					}
					values[column.name] = placeholder;
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
			// A web run that posted no heartbeat: closed ten seconds after its start, without a time slot
			await insert('time_log', {
				id: SLOTLESS_RUN,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				source: 'WEB_TIMER',
				logType: 'TRACKED',
				startedAt: '2026-01-05 12:00:00.000',
				stoppedAt: '2026-01-05 12:00:10.000',
				isRunning: 0
			});

			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			// A break set to start inside those ten seconds, up to later that day
			const conflictsOf = async (handler: { execute: (command: unknown) => Promise<{ id: string }[]> }, includeSlotless: boolean) =>
				(
					await handler.execute(
						new IGetConflictTimeLogCommand({
							employeeId: EMPLOYEE,
							organizationId: ORGANIZATION,
							tenantId: TENANT,
							startDate: '2026-01-05T12:00:05.000Z',
							endDate: '2026-01-05T13:00:00.000Z',
							includeSlotless
						})
					)
				).map(({ id }) => id);
			const reads = async (handler: { execute: (command: unknown) => Promise<{ id: string }[]> }): Promise<Reads> => ({
				withSlotless: await conflictsOf(handler, true),
				withoutSlotless: await conflictsOf(handler, false)
			});
			const config = { dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } };
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const handlerWith = (typeOrmRepository: any, mikroOrmRepository: any, ormType: unknown) => {
				const handler = new GetConflictTimeLogHandler(typeOrmRepository, mikroOrmRepository, config);
				Object.assign(handler, { ormType });
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
				measurement.mikroOrm = await reads(
					handlerWith({}, new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog), MultiORMEnum.MikroORM)
				);
			} finally {
				await mikroOrm.close(true);
			}

			measurement.typeOrm = await reads(
				handlerWith(new TypeOrmTimeLogRepository(dataSource.getRepository(TimeLog)), {}, MultiORMEnum.TypeORM)
			);
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

	return measurement;
}

describe('GetConflictTimeLogHandler, a slotless run closed at its ten seconds (#11920)', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it('finds it for a break set to start inside its ten seconds, as the timer asks (includeSlotless)', () => {
			expect(measured[orm].withSlotless).toEqual([SLOTLESS_RUN]);
		});
	});

	it('is what the timer asks for: without includeSlotless, TypeORM leaves a slotless work log out', () => {
		expect(measured.typeOrm.withoutSlotless).toEqual([]);
	});
});

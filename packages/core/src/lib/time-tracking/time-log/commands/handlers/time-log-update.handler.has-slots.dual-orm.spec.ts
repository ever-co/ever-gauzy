import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * ever-co/ever-gauzy#11843: a stop gives an Ever Teams or mobile run the time slots of its range only when it has none.
 * Whether a run has slots is read here on a real SQLite database, with each ORM: a slot counts once it is linked to the
 * run in `time_slot_time_logs`, and only inside the run's tenant.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '11111111-1111-4111-8111-111111111112';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const EMPLOYEE = '44444444-4444-4444-8444-444444444441';
const RUN_WITH_SLOT = '66666666-6666-4666-8666-666666666661';
const RUN_WITHOUT_SLOT = '66666666-6666-4666-8666-666666666662';
const SLOT = '77777777-7777-4777-8777-777777777771';

type Reads = { withSlot: boolean; withoutSlot: boolean; inAnotherTenant: boolean };

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-run-slots-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Reads; typeOrm: Reads };
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
			// The placeholders below fill NOT NULL references (the employee's user, for one) with rows that do not
			// exist: what is read here is the slot link, not the integrity of the rows around it.
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
			await insert('tenant', { id: OTHER_TENANT, name: 'Other tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('employee', { id: EMPLOYEE, tenantId: TENANT, organizationId: ORGANIZATION });
			for (const id of [RUN_WITH_SLOT, RUN_WITHOUT_SLOT]) {
				await insert('time_log', {
					id,
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					employeeId: EMPLOYEE,
					source: 'TEAMS',
					logType: 'TRACKED',
					startedAt: '2026-01-05 09:00:00',
					stoppedAt: '2026-01-05 09:00:00',
					isRunning: 1
				});
			}
			await insert('time_slot', {
				id: SLOT,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				employeeId: EMPLOYEE,
				startedAt: '2026-01-05 09:00:00',
				duration: 60
			});
			await insert('time_slot_time_logs', { timeSlotId: SLOT, timeLogId: RUN_WITH_SLOT });

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const reads = async (handler: any): Promise<Reads> => ({
				withSlot: await handler.hasTimeSlots({ id: RUN_WITH_SLOT, tenantId: TENANT }),
				withoutSlot: await handler.hasTimeSlots({ id: RUN_WITHOUT_SLOT, tenantId: TENANT }),
				inAnotherTenant: await handler.hasTimeSlots({ id: RUN_WITH_SLOT, tenantId: OTHER_TENANT })
			});
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
				measurement.mikroOrm = await reads(
					handlerWith({}, new MikroOrmTimeSlotRepository(mikroOrm.em.fork(), TimeSlot), MultiORMEnum.MikroORM)
				);
			} finally {
				await mikroOrm.close(true);
			}

			measurement.typeOrm = await reads(
				handlerWith(new TypeOrmTimeSlotRepository(dataSource.getRepository(TimeSlot)), {}, MultiORMEnum.TypeORM)
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
		fs.rmSync(file, { force: true });
	}

	return measurement;
}

describe('TimeLogUpdateHandler, whether a run has time slots (#11843)', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it('finds the slot linked to a run', () => {
			expect(measured[orm].withSlot).toBe(true);
		});

		it('finds none for a run without a linked slot', () => {
			expect(measured[orm].withoutSlot).toBe(false);
		});

		it("does not count a slot outside the run's tenant", () => {
			expect(measured[orm].inAnotherTenant).toBe(false);
		});
	});
});

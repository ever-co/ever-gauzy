import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestContext } from '@gauzy/core';
import { DataSource } from 'typeorm';
import { WakatimeService, splitDuration } from './wakatime.service';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';

/**
 * The scaffold asked Nest to build the service with no providers at all, which cannot work for a
 * dual-ORM service: it takes a TypeORM repository and a MikroORM one, and Nest answers "can't resolve
 * dependencies" instead of a defined service — the suite failed to load rather than failing an
 * assertion. The pair is doubled here, because nothing in this suite reads or writes: what it asserts
 * is that the class is constructible from the collaborators it declares.
 */
describe('WakatimeService', () => {
	let service: WakatimeService;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WakatimeService,
				{ provide: TypeOrmWakatimeRepository, useValue: {} },
				{ provide: MikroOrmWakatimeRepository, useValue: {} }
			]
		}).compile();
		service = module.get(WakatimeService);
	});
	it('should be defined', () => {
		expect(service).toBeTruthy();
	});
});

describe('splitDuration (WakaTime summary)', () => {
	it('gives the minutes left over after the hours, not the total minutes', () => {
		expect(splitDuration(3700)).toEqual({ totalSeconds: 3700, hours: 1, minutes: 1 });
		expect(splitDuration(4000)).toEqual({ totalSeconds: 4000, hours: 1, minutes: 6 });
	});

	it('handles durations under an hour', () => {
		expect(splitDuration(600)).toEqual({ totalSeconds: 600, hours: 0, minutes: 10 });
	});

	it('treats a day without heartbeats (null sum) and numeric strings from the driver', () => {
		expect(splitDuration(null)).toEqual({ totalSeconds: 0, hours: 0, minutes: 0 });
		expect(splitDuration('7260')).toEqual({ totalSeconds: 7260, hours: 2, minutes: 1 });
	});

	it('counts a non-numeric, infinite or negative value as 0', () => {
		for (const seconds of ['abc', Infinity, -120] as const) {
			expect(splitDuration(seconds)).toEqual({ totalSeconds: 0, hours: 0, minutes: 0 });
		}
	});
});

describe('WakatimeService.getSummaries', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-1');
	});

	afterEach(() => jest.restoreAllMocks());

	// Both repositories return the rows, so the tests hold whichever ORM (DB_ORM) the service was loaded with
	const summaryFor = async (rows: any[]) => {
		const query = jest.fn().mockResolvedValue(rows);
		const knex = { raw: jest.fn().mockResolvedValue(rows) };
		const service = new WakatimeService({ query } as any, { getKnex: () => knex } as any);
		const { data } = await service.getSummaries({});
		return data[0].grand_total;
	};

	it('counts only the caller’s own heartbeats', async () => {
		const query = jest.fn().mockResolvedValue([{ seconds: 60 }]);
		const raw = jest.fn().mockResolvedValue([{ seconds: 60 }]);
		const service = new WakatimeService({ query } as any, { getKnex: () => ({ raw }) } as any);

		await service.getSummaries({});

		const [sql, parameters] = (query.mock.calls[0] ?? raw.mock.calls[0]) as [string, unknown[]];
		expect(sql).toContain('"employeeId" = ?');
		expect(parameters).toEqual(['employee-1']);
	});

	it('refuses a caller with no employee record, without reading', async () => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);
		const query = jest.fn();
		const service = new WakatimeService({ query } as any, { getKnex: () => ({ raw: query }) } as any);

		await expect(service.getSummaries({})).rejects.toBeInstanceOf(ForbiddenException);
		expect(query).not.toHaveBeenCalled();
	});

	it('sums the caller’s own coding time on SQLite, not everyone’s', async () => {
		const dbPath = path.join(os.tmpdir(), `gauzy-wakatime-summaries-${process.pid}-${Date.now()}.sqlite3`);
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: dbPath,
			synchronize: false,
			logging: false
		});
		await dataSource.initialize();
		try {
			await dataSource.query(
				'CREATE TABLE "heartbeats" ("id" integer PRIMARY KEY, "employeeId" varchar, "time" integer, "entities" varchar)'
			);
			const now = Math.floor(Date.now() / 1000);
			// Today: two heartbeats of mine on two files, three of a coworker's on three files.
			await dataSource.query(
				`INSERT INTO "heartbeats" ("employeeId", "time", "entities") VALUES
					('employee-1', ${now}, 'a.ts'), ('employee-1', ${now}, 'b.ts'),
					('employee-2', ${now}, 'c.ts'), ('employee-2', ${now}, 'd.ts'), ('employee-2', ${now}, 'e.ts')`
			);
			const service = new WakatimeService(
				{ query: (sql: string, parameters?: unknown[]) => dataSource.query(sql, parameters) } as any,
				{
					getKnex: () => ({ raw: (sql: string, parameters?: unknown[]) => dataSource.query(sql, parameters) })
				} as any
			);

			const { data } = await service.getSummaries({});

			expect(data[0].grand_total.total_seconds).toBe(2);
		} finally {
			await dataSource.destroy();
			fs.rmSync(dbPath, { force: true });
		}
	});

	it('shows the minutes left over after the hours, zero-padded', async () => {
		expect(await summaryFor([{ seconds: 3700 }])).toMatchObject({
			digital: '1:01',
			hours: 1,
			minute: 1,
			total_seconds: 3700
		});
	});

	it('shows 0:00 for a day without heartbeats (null sum)', async () => {
		expect(await summaryFor([{ seconds: null }])).toMatchObject({ digital: '0:00', minute: 0, total_seconds: 0 });
	});

	it('shows 0:00 when the query returns no row', async () => {
		expect(await summaryFor([])).toMatchObject({ digital: '0:00', minute: 0, total_seconds: 0 });
	});
});

describe('WakatimeService under MikroORM', () => {
	/**
	 * The ORM is read once when the service module loads (`DB_ORM`), so the MikroORM service is loaded in an
	 * isolated registry with `DB_ORM=mikro-orm`. Its collaborators are stubbed so nothing touches a database.
	 */
	const loadMikroOrmService = (): typeof WakatimeService => {
		const previous = process.env.DB_ORM;
		let Service!: typeof WakatimeService;
		process.env.DB_ORM = 'mikro-orm';
		try {
			jest.isolateModules(() => {
				jest.doMock('@gauzy/core', () => ({
					MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
					getORMType: () => process.env.DB_ORM,
					// A signed-in employee: `parameterSanitize` files heartbeats under the caller's own
					// employee once ever-co/ever-gauzy#11328 lands, and reads it from the request context.
					RequestContext: {
						currentEmployeeId: () => 'employee-1',
						currentUser: () => ({ employeeId: 'employee-1' })
					}
				}));
				jest.doMock('./wakatime.entity', () => ({ Wakatime: class {} }));
				jest.doMock('./repository/type-orm-wakatime.repository', () => ({
					TypeOrmWakatimeRepository: class {}
				}));
				jest.doMock('./repository/mikro-orm-wakatime.repository', () => ({
					MikroOrmWakatimeRepository: class {}
				}));
				Service = require('./wakatime.service').WakatimeService;
			});
		} finally {
			if (previous === undefined) {
				delete process.env.DB_ORM;
			} else {
				process.env.DB_ORM = previous;
			}
		}
		return Service;
	};

	const knexStub = () => {
		const ignore = jest.fn().mockResolvedValue([]);
		const onConflict = jest.fn().mockReturnValue({ ignore });
		const insert = jest.fn().mockReturnValue({ onConflict });
		const knex = jest.fn().mockReturnValue({ insert });
		return { knex, insert };
	};

	it('getSummaries counts only the caller’s heartbeats through knex', async () => {
		const Service = loadMikroOrmService();
		const raw = jest.fn().mockResolvedValue([{ seconds: 1 }]);
		const query = jest.fn();
		const service = new Service({ query } as any, { getKnex: () => ({ raw }) } as any);

		await service.getSummaries({});

		expect(query).not.toHaveBeenCalled();
		expect(raw).toHaveBeenCalledWith(expect.stringContaining('"employeeId" = ?'), ['employee-1']);
	});

	it('bulkSave reports one identifier per heartbeat, like TypeORM', async () => {
		const Service = loadMikroOrmService();
		const { knex, insert } = knexStub();
		const service = new Service({} as any, { getKnex: () => knex } as any);

		const result = await service.bulkSave([{ entities: 'a.ts' }, { entities: 'b.ts' }] as any);

		expect(knex).toHaveBeenCalledWith('heartbeats');
		expect(insert).toHaveBeenCalledWith([{ entities: 'a.ts' }, { entities: 'b.ts' }]);
		expect(result?.identifiers).toHaveLength(2);
	});

	it('save reports one identifier for the heartbeat', async () => {
		const Service = loadMikroOrmService();
		const { knex } = knexStub();
		const service = new Service({} as any, { getKnex: () => knex } as any);

		const result = await service.save({ entities: 'a.ts' } as any);

		expect(result?.identifiers).toHaveLength(1);
	});

	it('lets POST /heartbeats.bulk accept the payload (identifiers match the payload length)', async () => {
		const Service = loadMikroOrmService();
		const { knex } = knexStub();
		const service = new Service({} as any, { getKnex: () => knex } as any);
		const payload = [
			{ entity: 'a.ts', time: 1 },
			{ entity: 'b.ts', time: 2 }
		];

		const result: any = await service.parameterSanitize(payload, {});

		expect(result.identifiers.length).toBe(payload.length);
	});
});

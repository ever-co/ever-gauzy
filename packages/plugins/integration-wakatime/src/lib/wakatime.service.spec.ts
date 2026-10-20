import { Test, TestingModule } from '@nestjs/testing';
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
	// Both repositories return the rows, so the tests hold whichever ORM (DB_ORM) the service was loaded with
	const summaryFor = async (rows: any[]) => {
		const query = jest.fn().mockResolvedValue(rows);
		const knex = { raw: jest.fn().mockResolvedValue(rows) };
		const service = new WakatimeService({ query } as any, { getKnex: () => knex } as any);
		const { data } = await service.getSummaries({});
		return data[0].grand_total;
	};

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
					getORMType: () => process.env.DB_ORM
				}));
				jest.doMock('./wakatime.entity', () => ({ Wakatime: class {} }));
				jest.doMock('./repository/type-orm-wakatime.repository', () => ({ TypeOrmWakatimeRepository: class {} }));
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

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

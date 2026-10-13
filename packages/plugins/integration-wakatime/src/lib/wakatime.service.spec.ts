import { Test } from '@nestjs/testing';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';
import { WakatimeService, splitDuration } from './wakatime.service';

describe('WakatimeService', () => {
	let service: WakatimeService;
	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [
				WakatimeService,
				// The repositories the constructor injects; being constructible is all this spec checks.
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
	// The tests run with the default ORM (TypeORM), so the sum comes from `typeOrmWakatimeRepository.query`
	const summaryFor = async (rows: any[]) => {
		const query = jest.fn().mockResolvedValue(rows);
		const service = new WakatimeService({ query } as any, {} as any);
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

import '../core/entities/internal';

import { Brackets, FindOperator } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TimeOffRequestService } from './time-off-request.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * The TypeORM time-off list keeps every request overlapping the window: started by its end and ended by its
 * start. It used to keep a request only when its start or its end fell inside the window, which left out
 * one spanning the whole window.
 */
describe('TimeOffRequestService.pagination date window (TypeORM)', () => {
	const { tenantA } = createCrossTenantFixture();
	const window = { startDate: '2026-02-01 00:00:00', endDate: '2026-02-28 23:59:59' };

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	/** The `{ start, end }` criterion the date window adds, read by running every bracket the list adds. */
	const dateWindow = async (): Promise<{ start: FindOperator<string>; end: FindOperator<string> }> => {
		let brackets: Brackets[] = [];
		const qb = {
			alias: 'time_off_request',
			andWhere: jest.fn((condition: unknown) => {
				if (condition instanceof Brackets) brackets.push(condition);
			})
		};
		const query = {
			alias: 'time_off_request',
			setFindOptions: jest.fn(),
			leftJoin: jest.fn(),
			where: jest.fn((callback: (builder: typeof qb) => void) => callback(qb)),
			getManyAndCount: jest.fn().mockResolvedValue([[], 0])
		};
		const service = new TimeOffRequestService(
			{
				metadata: { tableName: 'time_off_request' },
				createQueryBuilder: jest.fn().mockReturnValue(query)
			} as any,
			{} as any,
			{} as any
		);

		await service.pagination({ where: { organizationId: tenantA.organizationId, ...window } });

		let criteria: any[] = [];
		const web = { where: jest.fn((c) => criteria.push(c)), andWhere: jest.fn((c) => criteria.push(c)) };
		brackets.forEach((bracket) => bracket.whereFactory(web as any));
		return criteria.find((criterion) => criterion && typeof criterion === 'object' && 'start' in criterion);
	};

	it('compares the start with the window end and the end with the window start', async () => {
		const { start, end } = await dateWindow();

		expect(start.type).toBe('lessThanOrEqual');
		expect(start.value).toBe(window.endDate);
		expect(end.type).toBe('moreThanOrEqual');
		expect(end.value).toBe(window.startDate);
	});

	it('keeps a request spanning the whole window, and none outside it', async () => {
		const { start, end } = await dateWindow();
		const kept = (request: { start: string; end: string }) =>
			request.start <= start.value && request.end >= end.value;

		expect(kept({ start: '2026-01-25 00:00:00', end: '2026-03-05 00:00:00' })).toBe(true);
		expect(kept({ start: '2026-02-10 00:00:00', end: '2026-02-12 00:00:00' })).toBe(true);
		expect(kept({ start: '2026-01-10 00:00:00', end: '2026-01-20 00:00:00' })).toBe(false);
		expect(kept({ start: '2026-03-02 00:00:00', end: '2026-03-04 00:00:00' })).toBe(false);
	});
});

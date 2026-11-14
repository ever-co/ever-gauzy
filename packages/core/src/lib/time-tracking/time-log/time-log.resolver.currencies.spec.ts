// Must stay first: loads the entity graph before the resolver pulls an entity (see activity.controller.spec.ts).
import '../../core/entities/internal';

import { TimeLogResolver } from './time-log.resolver';

/**
 * The weekly report and the owed chart state their amounts per currency (`spentByCurrency`, `valueByCurrency`), so a
 * week or a day priced in two currencies is never read as one sum: GraphQL carries them as the REST routes answer them.
 */
describe('TimeLogResolver: amounts per currency', () => {
	const EUR_AND_USD = [
		{ currency: 'EUR', amount: 40 },
		{ currency: 'USD', amount: 60 }
	];

	function resolverAnswering(weekly: unknown[], chart: unknown[], owed: unknown[] = []) {
		const timeLogService = {
			getWeeklyReport: jest.fn(async () => weekly),
			getOwedAmountReportCharts: jest.fn(async () => chart),
			getOwedAmountReport: jest.fn(async () => owed)
		};
		const resolver = Object.create(TimeLogResolver.prototype) as TimeLogResolver;
		Object.assign(resolver, { timeLogService, _timeLogService: timeLogService });
		return resolver as any;
	}

	it("passes a week's amounts per currency through, an empty list for a week without any rate", async () => {
		const weekly = [
			{
				employee: { id: 'marie' },
				dates: {},
				sum: 7200,
				activity: 0,
				spent: null,
				currency: null,
				spentByCurrency: EUR_AND_USD
			},
			{
				employee: { id: 'paul' },
				dates: {},
				sum: 3600,
				activity: 0,
				spent: null,
				currency: null,
				spentByCurrency: []
			}
		];
		const resolver = resolverAnswering(weekly, []);

		const [marie, paul] = await resolver.timeLogWeeklyReport('organization-1');

		expect(marie.spentByCurrency).toEqual(EUR_AND_USD);
		expect(paul.spentByCurrency).toEqual([]);
	});

	it("passes a chart day's totals per currency through beside its value", async () => {
		const resolver = resolverAnswering([], [{ date: '2026-10-05', value: 100, valueByCurrency: EUR_AND_USD }]);

		const [day] = await resolver.timeLogOwedAmountReportChart('organization-1');

		expect(day).toEqual({ date: '2026-10-05', value: 100, valueByCurrency: EUR_AND_USD });
	});

	it('states the currency of each owed line, as a day priced in two currencies has one line per currency', async () => {
		const owed = [
			{
				date: '2026-10-05',
				employees: [
					{ employee: { id: 'marie' }, duration: 3600, amount: 40, currency: 'EUR' },
					{ employee: { id: 'marie' }, duration: 1800, amount: 30, currency: 'USD' }
				]
			}
		];
		const resolver = resolverAnswering([], [], owed);

		const [day] = await resolver.timeLogOwedAmountReport('organization-1');

		expect(day.employees).toEqual([
			{ employeeId: 'marie', duration: 3600, amount: 40, currency: 'EUR' },
			{ employeeId: 'marie', duration: 1800, amount: 30, currency: 'USD' }
		]);
	});
});

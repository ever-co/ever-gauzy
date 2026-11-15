import { DurationRoundingDirectionEnum, InvoiceScheduleGroupingEnum } from '@gauzy/contracts';
import {
	billableEntriesOf,
	durationRoundingRuleOf,
	invoiceTimeOf,
	lineAmountOf,
	linePriceOf,
	oneCurrencyInvoiceOf,
	roundedSecondsOf,
	totalOfLines
} from './invoice-schedule-pricing';

const WEBSITE = 'project-website';
const APP = 'project-app';
const MARIE = 'employee-marie';
const PAUL = 'employee-paul';
const HOUR = 3600;

const projects = new Set([WEBSITE, APP]);

/** A stopped billable log of `hours` on a project. */
function log(id: string, employeeId: string, projectId: string, hours: number, taskId: string | null = null) {
	const startedAt = new Date('2026-10-05T09:00:00Z');
	const stoppedAt = new Date(startedAt.getTime() + hours * HOUR * 1000);
	return { id, employeeId, projectId, taskId, isBillable: true, duration: hours * HOUR, startedAt, stoppedAt };
}

describe('scheduled invoice pricing', () => {
	it('counts only billable time of the client projects, with a member, that makes time', () => {
		const entries = billableEntriesOf(
			[
				log('a', MARIE, WEBSITE, 2),
				{ ...log('b', MARIE, WEBSITE, 1), isBillable: false },
				log('c', MARIE, 'project-of-another-client', 3),
				{ ...log('d', MARIE, WEBSITE, 1), employeeId: null },
				{ ...log('e', MARIE, WEBSITE, 0), duration: 0 },
				log('f', MARIE, WEBSITE, 1)
			],
			projects,
			null
		);

		expect(entries).toEqual([
			{ projectId: WEBSITE, employeeId: MARIE, taskId: null, seconds: 3 * HOUR, timeLogIds: ['a', 'f'] }
		]);
	});

	it('bills no timer still running: its time is not over', () => {
		const running = { ...log('a', MARIE, WEBSITE, 2), isRunning: true, stoppedAt: null };

		expect(
			billableEntriesOf([running, { ...log('b', MARIE, WEBSITE, 1), isRunning: true }], projects, null)
		).toEqual([]);
	});

	it('reads a log without a duration from its start to its stop', () => {
		const entries = billableEntriesOf(
			[
				{
					id: 'a',
					employeeId: MARIE,
					projectId: WEBSITE,
					isBillable: true,
					startedAt: '2026-10-05T09:00:00Z',
					stoppedAt: '2026-10-05T10:30:00Z'
				}
			],
			projects,
			null
		);

		expect(entries[0].seconds).toBe(1.5 * HOUR);
	});

	it("rounds each log by the organization's rule before the time adds up", () => {
		const rule = durationRoundingRuleOf({
			durationRoundingInterval: 15,
			durationRoundingDirection: DurationRoundingDirectionEnum.UP
		});
		expect(rule).toEqual({ intervalMinutes: 15, direction: DurationRoundingDirectionEnum.UP });
		expect(roundedSecondsOf(16 * 60, rule)).toBe(30 * 60);
		expect(roundedSecondsOf(16 * 60, { ...rule, direction: DurationRoundingDirectionEnum.DOWN })).toBe(15 * 60);
		expect(roundedSecondsOf(23 * 60, { ...rule, direction: DurationRoundingDirectionEnum.NEAREST })).toBe(30 * 60);

		const entries = billableEntriesOf(
			[
				{ ...log('a', MARIE, WEBSITE, 0), duration: 16 * 60 },
				{ ...log('b', MARIE, WEBSITE, 0), duration: 16 * 60 }
			],
			projects,
			rule
		);
		expect(entries[0].seconds).toBe(60 * 60);
	});

	it('rounds nothing for a rule it does not know, or half a rule', () => {
		expect(durationRoundingRuleOf({ durationRoundingInterval: 7, durationRoundingDirection: 'UP' })).toBeNull();
		expect(durationRoundingRuleOf({ durationRoundingInterval: 15 })).toBeNull();
		expect(durationRoundingRuleOf(null)).toBeNull();
	});

	it("bills the member's client rate on the project, else the project's, else their own, else the default", () => {
		const organizationCurrency = 'USD';
		const base = { organizationCurrency, projectCurrency: 'EUR', employeeCurrency: 'GBP' };

		expect(linePriceOf({ ...base, memberRate: '90.00', projectRate: 80, employeeRate: 70 })).toEqual({
			rate: 90,
			source: 'member',
			currency: 'EUR'
		});
		// A client rate of 0 is a rate: the client is billed nothing for that time
		expect(linePriceOf({ ...base, memberRate: 0, projectRate: 80 })).toMatchObject({ rate: 0, source: 'member' });
		expect(linePriceOf({ ...base, projectRate: 80, employeeRate: 70 })).toMatchObject({
			rate: 80,
			currency: 'EUR'
		});
		expect(linePriceOf({ ...base, employeeRate: 70 })).toEqual({ rate: 70, source: 'employee', currency: 'GBP' });
		// A member's own rate stored as 0 is no rate
		expect(linePriceOf({ ...base, employeeRate: 0, defaultRate: { value: 50, currency: null } })).toEqual({
			rate: 50,
			source: 'default',
			currency: 'USD'
		});
		expect(linePriceOf({ ...base, employeeRate: 0 })).toEqual({ rate: null, source: null, currency: null });
		expect(linePriceOf({ organizationCurrency, projectRate: 80 })).toMatchObject({ currency: 'USD' });
	});

	it('states an amount as hours times rate, to the cent, half up', () => {
		expect(lineAmountOf(1.15, 12.5)).toBe(14.38);
		expect(lineAmountOf(10, 80)).toBe(800);
	});

	describe('lines', () => {
		const entries = [
			{ projectId: WEBSITE, employeeId: MARIE, taskId: 'task-1', seconds: 2 * HOUR, timeLogIds: ['a'] },
			{ projectId: WEBSITE, employeeId: MARIE, taskId: 'task-2', seconds: 1 * HOUR, timeLogIds: ['b'] },
			{ projectId: WEBSITE, employeeId: PAUL, taskId: 'task-1', seconds: 1 * HOUR, timeLogIds: ['c'] }
		];
		const rates: Record<string, number> = { [MARIE]: 100, [PAUL]: 40 };
		const priceOf = (_projectId: string, employeeId: string) => ({
			rate: rates[employeeId] ?? null,
			currency: 'USD',
			source: 'employee' as const
		});

		it('by task: one line per project, member and task', () => {
			const { lines } = invoiceTimeOf(entries, InvoiceScheduleGroupingEnum.TASK, priceOf);

			expect(lines.map(({ hours, rate, amount, timeLogIds }) => ({ hours, rate, amount, timeLogIds }))).toEqual([
				{ hours: 2, rate: 100, amount: 200, timeLogIds: ['a'] },
				{ hours: 1, rate: 100, amount: 100, timeLogIds: ['b'] },
				{ hours: 1, rate: 40, amount: 40, timeLogIds: ['c'] }
			]);
		});

		it('by member: one line per project and member, whatever the task', () => {
			const { lines } = invoiceTimeOf(entries, InvoiceScheduleGroupingEnum.MEMBER, priceOf);

			expect(lines).toMatchObject([
				{ employeeId: MARIE, taskId: null, hours: 3, rate: 100, amount: 300, timeLogIds: ['a', 'b'] },
				{ employeeId: PAUL, hours: 1, rate: 40, amount: 40, timeLogIds: ['c'] }
			]);
		});

		it('by project: one line at the average rate weighted by time, so hours times rate is the amount', () => {
			const { lines } = invoiceTimeOf(entries, InvoiceScheduleGroupingEnum.PROJECT, priceOf);

			// 3 h at 100 and 1 h at 40: 340 for 4 h, 85 an hour
			expect(lines).toEqual([
				expect.objectContaining({
					projectId: WEBSITE,
					employeeId: null,
					hours: 4,
					rate: 85,
					amount: 340,
					timeLogIds: ['a', 'b', 'c']
				})
			]);
		});

		it('leaves the time without a rate out, and counts it', () => {
			const withoutPaul = (_projectId: string, employeeId: string) =>
				employeeId === PAUL ? { rate: null, currency: null, source: null } : priceOf(_projectId, employeeId);

			const time = invoiceTimeOf(entries, InvoiceScheduleGroupingEnum.PROJECT, withoutPaul);

			expect(time.lines).toMatchObject([{ hours: 3, rate: 100, amount: 300, timeLogIds: ['a', 'b'] }]);
			expect(time.unpricedSeconds).toBe(HOUR);
		});
	});

	it('makes the invoice in the currency that prices the most time, and leaves the others out', () => {
		const line = (key: string, currency: string, hours: number, amount: number) => ({
			key,
			projectId: WEBSITE,
			employeeId: MARIE,
			taskId: null,
			seconds: hours * HOUR,
			hours,
			rate: amount / hours,
			currency,
			amount,
			timeLogIds: [key]
		});

		const invoice = oneCurrencyInvoiceOf([
			line('a', 'EUR', 2, 200),
			line('b', 'USD', 5, 400),
			line('c', 'USD', 1, 80)
		]);

		expect(invoice.currency).toBe('USD');
		expect(invoice.lines.map(({ key }) => key)).toEqual(['b', 'c']);
		expect(invoice.otherCurrencySeconds).toBe(2 * HOUR);
		expect(totalOfLines(invoice.lines)).toBe(480);
		expect(oneCurrencyInvoiceOf([])).toEqual({ currency: null, lines: [], otherCurrencySeconds: 0 });
	});
});

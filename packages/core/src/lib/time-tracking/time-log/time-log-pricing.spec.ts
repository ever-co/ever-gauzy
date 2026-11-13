import { amountsOf, billedRateOf, budgetCostOf, owedLinesOf, owedRateOfLog, rateOfReportRow } from './time-log-pricing';

const HOUR = 3600;

describe('time log pricing', () => {
	describe('amountsOf', () => {
		it('prices each log at its own rate: October at 40 stays 400 after a raise to 50', () => {
			const october = Array.from({ length: 10 }, () => ({ duration: HOUR, rate: 40, currency: 'EUR' }));
			const november = [{ duration: HOUR, rate: 50, currency: 'EUR' }];

			const amounts = amountsOf([...october, ...november], (log) => log);

			expect(amounts).toEqual([{ currency: 'EUR', amount: 450 }]);
			expect(amountsOf(october, (log) => log)).toEqual([{ currency: 'EUR', amount: 400 }]);
		});

		it('prices the time of one rate once, as a week was priced at one rate, so cents add up as before', () => {
			// 3 x 20 min at 20.15 is one hour: 20.15, where pricing each third apart would give 3 x 6.72 = 20.16
			const thirds = Array.from({ length: 3 }, () => ({ duration: 1200, rate: '20.15', currency: 'EUR' }));

			expect(amountsOf(thirds, (log) => log)).toEqual([{ currency: 'EUR', amount: 20.15 }]);
		});

		it('never adds two currencies, and leaves out time without a rate', () => {
			const logs = [
				{ duration: HOUR, rate: 40, currency: 'EUR' },
				{ duration: HOUR, rate: 60, currency: 'USD' },
				{ duration: HOUR, rate: null, currency: 'EUR' }
			];

			expect(amountsOf(logs, (log) => log)).toEqual([
				{ currency: 'EUR', amount: 40 },
				{ currency: 'USD', amount: 60 }
			]);
		});

		it('answers no amount for time without any rate', () => {
			expect(amountsOf([{ duration: HOUR, rate: undefined, currency: null }], (log) => log)).toEqual([]);
		});
	});

	describe('owedRateOfLog', () => {
		const employee = { id: 'marie', billRateValue: 50, billRateCurrency: 'USD' } as any;

		it('prices a log that stores its rates at its stored pay rate, else at its stored billing rate', () => {
			const log = { ratesStored: true, billRateValue: 40, billRateCurrency: null, employee } as any;

			expect(owedRateOfLog(log, { payRateValue: 25, payRateCurrency: null }, undefined, 'EUR')).toEqual({
				rate: 25,
				currency: 'EUR',
				rateSource: 'pay'
			});
			expect(owedRateOfLog(log, { payRateValue: null, payRateCurrency: null }, undefined, 'EUR')).toEqual({
				rate: 40,
				currency: 'EUR',
				rateSource: 'billing'
			});
		});

		it('prices at the billing rate when the caller may not read the pay rate (none is given)', () => {
			const log = { ratesStored: true, billRateValue: 40, billRateCurrency: 'USD', employee } as any;

			expect(owedRateOfLog(log, undefined, undefined, 'EUR')).toMatchObject({ rate: 40, rateSource: 'billing' });
		});

		it("prices a log that stores no rate at the member's current rates, as before", () => {
			const log = { ratesStored: null, employee } as any;
			const livePayRate = { id: 'marie', payRateValue: 30, payRateCurrency: 'USD' } as any;

			expect(owedRateOfLog(log, undefined, livePayRate, 'EUR')).toEqual({
				rate: 30,
				currency: 'USD',
				rateSource: 'pay'
			});
			expect(owedRateOfLog(log, undefined, undefined, 'EUR')).toEqual({
				rate: 50,
				currency: 'USD',
				rateSource: 'billing'
			});
		});
	});

	describe('owedLinesOf', () => {
		it('gives one line of a day as before when one rate prices it all', () => {
			const logs = [
				{ duration: HOUR, rate: 25, currency: 'EUR', rateSource: 'pay' as const },
				{ duration: HOUR, rate: 25, currency: 'EUR', rateSource: 'pay' as const }
			];

			expect(owedLinesOf(logs, (log) => log)).toEqual([
				{ amount: 50, duration: 2 * HOUR, rateSource: 'pay', currency: 'EUR' }
			]);
		});

		it('gives one line per currency, and says billing when part of the time is priced at the billing rate', () => {
			const logs = [
				{ duration: HOUR, rate: 25, currency: 'EUR', rateSource: 'pay' as const },
				{ duration: HOUR, rate: 40, currency: 'EUR', rateSource: 'billing' as const },
				{ duration: HOUR, rate: 60, currency: 'USD', rateSource: 'billing' as const }
			];

			expect(owedLinesOf(logs, (log) => log)).toEqual([
				{ amount: 65, duration: 2 * HOUR, rateSource: 'billing', currency: 'EUR' },
				{ amount: 60, duration: HOUR, rateSource: 'billing', currency: 'USD' }
			]);
		});

		it('owes nothing, as a number, for time without a rate', () => {
			const logs = [{ duration: HOUR, rate: null, currency: 'EUR', rateSource: 'billing' as const }];

			expect(owedLinesOf(logs, (log) => log)).toEqual([
				{ amount: 0, duration: HOUR, rateSource: 'billing', currency: 'EUR' }
			]);
		});
	});

	describe('billedRateOf and budgetCostOf', () => {
		it("prices at the stored rate, the organization's currency when it states none", () => {
			const log = { ratesStored: true, billRateValue: 40, billRateCurrency: null, duration: 5400 } as any;

			expect(billedRateOf(log, 'EUR')).toEqual({ rate: 40, currency: 'EUR' });
			expect(budgetCostOf(log)).toBe(60);
		});

		it('costs nothing without a rate', () => {
			expect(budgetCostOf({ ratesStored: true, billRateValue: null, duration: 3600 } as any)).toBe(0);
		});
	});

	describe('rateOfReportRow', () => {
		it('states the rate a log stores, or the current rate of the member for a log that stores none', () => {
			const employee = { billRateValue: 50, billRateCurrency: 'USD' } as any;

			expect(
				rateOfReportRow({ ratesStored: true, billRateValue: 40, billRateCurrency: 'EUR', employee } as any)
			).toEqual({
				billRateValue: 40,
				billRateCurrency: 'EUR'
			});
			expect(rateOfReportRow({ ratesStored: null, employee } as any)).toEqual({
				billRateValue: 50,
				billRateCurrency: 'USD'
			});
			expect(
				rateOfReportRow({ ratesStored: true, billRateValue: '40.00', billRateCurrency: null } as any)
			).toEqual({
				billRateValue: 40,
				billRateCurrency: null
			});
		});
	});
});

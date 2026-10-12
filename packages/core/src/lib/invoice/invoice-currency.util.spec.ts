import { CurrencyPosition } from '@gauzy/contracts';
import { formatCurrencyAmount } from './invoice-currency.util';

describe('formatCurrencyAmount', () => {
	it('puts the currency before the amount when the organization position is LEFT', () => {
		expect(formatCurrencyAmount(100, 'USD', CurrencyPosition.LEFT)).toBe('USD 100');
	});

	it('puts the currency after the amount when the organization position is RIGHT', () => {
		expect(formatCurrencyAmount(100, 'EUR', CurrencyPosition.RIGHT)).toBe('100 EUR');
	});

	it('defaults to the LEFT layout when the organization has no position set', () => {
		expect(formatCurrencyAmount(12.5, 'GBP', undefined)).toBe('GBP 12.5');
		expect(formatCurrencyAmount(12.5, 'GBP', null)).toBe('GBP 12.5');
	});
});

import { dealProbabilityBadge, dealProbabilityLevel } from './deal-probability';

describe('dealProbabilityLevel', () => {
	it.each([
		[1, 'low'],
		[2, 'low'],
		[3, 'medium'],
		[4, 'medium'],
		[5, 'high'],
		['5', 'high'],
		[0, 'unknown'],
		[6, 'unknown'],
		[null, 'unknown'],
		[undefined, 'unknown']
	])('reads %p as %s', (probability, level) => {
		expect(dealProbabilityLevel(probability as number)).toBe(level);
	});
});

describe('dealProbabilityBadge', () => {
	it('gives each level the chip class and label the deals table always used', () => {
		expect(dealProbabilityBadge(1)).toEqual({
			level: 'low',
			className: 'badge-danger',
			labelKey: 'PIPELINE_DEALS_PAGE.LOW'
		});
		expect(dealProbabilityBadge(3)).toEqual({
			level: 'medium',
			className: 'badge-warning',
			labelKey: 'PIPELINE_DEALS_PAGE.MEDIUM'
		});
		expect(dealProbabilityBadge(5)).toEqual({
			level: 'high',
			className: 'badge-success',
			labelKey: 'PIPELINE_DEALS_PAGE.HIGH'
		});
		expect(dealProbabilityBadge(null)).toEqual({
			level: 'unknown',
			className: 'badge-primary',
			labelKey: 'PIPELINE_DEALS_PAGE.UNKNOWN'
		});
	});
});

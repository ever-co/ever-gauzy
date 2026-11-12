import { chunks } from './chunks';

describe('chunks', () => {
	it('splits an array into chunks of the given size', () => {
		expect(chunks([1, 2, 3, 4, 5, 6], 2)).toEqual([
			[1, 2],
			[3, 4],
			[5, 6]
		]);
	});

	it('keeps a shorter final chunk', () => {
		expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});

	it('returns no chunks for an empty array', () => {
		expect(chunks([], 3)).toEqual([]);
	});

	it('returns one chunk when the size exceeds the length, or is Infinity', () => {
		expect(chunks([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
		expect(chunks([1, 2, 3], Infinity)).toEqual([[1, 2, 3]]);
	});

	it('rejects zero and negative sizes', () => {
		expect(() => chunks([1, 2, 3], 0)).toThrow('Size must be a positive integer.');
		expect(() => chunks([1, 2, 3], -1)).toThrow('Size must be a positive integer.');
	});

	it('rejects NaN instead of returning one empty chunk', () => {
		expect(() => chunks([1, 2, 3], NaN)).toThrow('Size must be a positive integer.');
	});

	it('rejects fractional sizes instead of returning empty or repeated chunks', () => {
		expect(() => chunks([1, 2, 3], 0.5)).toThrow('Size must be a positive integer.');
		expect(() => chunks([1, 2, 3], 1.5)).toThrow('Size must be a positive integer.');
	});
});

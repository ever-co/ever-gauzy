import { trimIfNotEmpty } from './trim-if-not-empty';

describe('trimIfNotEmpty', () => {
	it('trims surrounding whitespace from a value', () => {
		expect(trimIfNotEmpty('  example  ')).toBe('example');
	});

	it('keeps inner whitespace', () => {
		expect(trimIfNotEmpty(' a b ')).toBe('a b');
	});

	it('returns an already trimmed value unchanged', () => {
		expect(trimIfNotEmpty('true')).toBe('true');
	});

	it('returns undefined for a whitespace-only value', () => {
		expect(trimIfNotEmpty('   ')).toBeUndefined();
		expect(trimIfNotEmpty('\t\n ')).toBeUndefined();
	});

	it('returns undefined for an empty string', () => {
		expect(trimIfNotEmpty('')).toBeUndefined();
	});

	it('returns undefined when no value is given', () => {
		expect(trimIfNotEmpty(undefined)).toBeUndefined();
		expect(trimIfNotEmpty()).toBeUndefined();
	});
});
